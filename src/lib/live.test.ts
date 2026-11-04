import assert from 'node:assert/strict';
import { test } from 'node:test';
import { haversine, type Point } from './geo.ts';
import { gpsHealth, kalmanStep, lapsFromMarks, paceAdvice, parsePace, rollingSpeed, type KalmanState } from './live.ts';

const pt = (lat: number, lng: number, t: number, acc = 5): Point => ({ lat, lng, alt: null, acc, t });

test('kalman smoothing shortens a zig-zag path', () => {
  // walk north at ~1.1 m/s with ±8 m east-west noise
  const raw: Point[] = Array.from({ length: 60 }, (_, i) => pt(19 + i * 0.00001, 72.8 + (i % 2 ? 0.00008 : -0.00008), i * 1000, 10));
  let k: KalmanState | null = null;
  const smooth = raw.map((p) => { k = kalmanStep(k, p, 2); return { ...p, lat: k.lat, lng: k.lng }; });
  const len = (ps: Point[]) => ps.slice(1).reduce((s, p, i) => s + haversine(ps[i], p), 0);
  assert.ok(len(smooth) < len(raw) * 0.5, `${len(smooth)} vs ${len(raw)}`);
});

test('kalman resets after a long gap', () => {
  const k = kalmanStep({ lat: 0, lng: 0, variance: 1, t: 0 }, pt(1, 1, 120_000), 3);
  assert.equal(k.lat, 1);
});

test('rolling speed over last 30 s', () => {
  const seg = Array.from({ length: 61 }, (_, i) => pt(19 + i * 0.00003, 72.8, i * 1000)); // ~3.34 m/s
  const v = rollingSpeed(seg, 30)!;
  assert.ok(Math.abs(v - 3.34) < 0.05, String(v));
  assert.equal(rollingSpeed(seg.slice(0, 3), 30), null);
});

test('laps from marks', () => {
  const laps = lapsFromMarks([{ distanceM: 1000, movingSec: 300 }, { distanceM: 2100, movingSec: 620 }], 2600, 780);
  assert.deepEqual(laps.map((l) => [l.distanceM, l.durationSec]), [[1000, 300], [1100, 320], [500, 160]]);
  assert.equal(lapsFromMarks([{ distanceM: 1000, movingSec: 300 }], 1002, 301).length, 1);
});

test('pace coach and parsing', () => {
  assert.equal(parsePace('5:30'), 330);
  assert.equal(parsePace('5:75'), null);
  assert.equal(paceAdvice(360, 330), 'faster');
  assert.equal(paceAdvice(300, 330), 'slower');
  assert.equal(paceAdvice(335, 330), null);
});

test('gps health', () => {
  assert.equal(gpsHealth(null, 0), 'lost');
  assert.equal(gpsHealth(pt(0, 0, 0, 8), 5000), 'good');
  assert.equal(gpsHealth(pt(0, 0, 0, 30), 5000), 'weak');
  assert.equal(gpsHealth(pt(0, 0, 0, 8), 20000), 'lost');
});
