import assert from 'node:assert/strict';
import { test } from 'node:test';
import { haversine, type Point } from './geo.ts';
import {
  STOPPED_MS, fixVelocity, gpsHealth, kalmanStep, lapsFromMarks, paceAdvice, parsePace, rollingSpeed, type KalmanState,
} from './live.ts';

const pt = (lat: number, lng: number, t: number, acc = 5): Point => ({ lat, lng, alt: null, acc, t });
const M = 111195; // metres per degree of latitude
const len = (ps: Pick<Point, 'lat' | 'lng'>[]) => ps.slice(1).reduce((s, p, i) => s + haversine(ps[i], p), 0);
/** Deterministic pseudo-noise in [-1, 1]. */
const noise = (i: number) => Math.sin(i * 12.9898 + 78.233) * 43758.5453 % 1;

test('kalman smoothing shortens a zig-zag path', () => {
  // walk north at ~1.1 m/s with ±8 m east-west noise, no Doppler
  const raw: Point[] = Array.from({ length: 60 }, (_, i) => pt(19 + i * 0.00001, 72.8 + (i % 2 ? 0.00008 : -0.00008), i * 1000, 10));
  let k: KalmanState | null = null;
  const smooth = raw.map((p) => { k = kalmanStep(k, p, 1); return { ...p, lat: k.lat, lng: k.lng }; });
  assert.ok(len(smooth) < len(raw) * 0.5, `${len(smooth)} vs ${len(raw)}`);
});

test('kalman resets after a long gap, and on a state saved by an older version', () => {
  const k = kalmanStep(kalmanStep(null, pt(0, 0, 0)), pt(1, 1, 120_000), 2);
  assert.equal(k.lat, 1);
  const old = { lat: 0, lng: 0, variance: 1, t: 0 } as unknown as KalmanState;
  assert.equal(kalmanStep(old, pt(1, 1, 1000)).lat, 1);
});

test('kalman: standing still with Doppler ≈ 0 stays put and reads as stopped', () => {
  let k: KalmanState | null = null;
  let raw = 0, worst = 0;
  const here = pt(19, 72.8, 0);
  for (let i = 0; i < 120; i++) {
    const f = { ...pt(19 + noise(i) * 5 / M, 72.8 + noise(i + 500) * 5 / M, i * 1000, 6), spd: 0.1, hdg: 0 };
    k = kalmanStep(k, f, 2);
    raw = Math.max(raw, haversine(f, here));
    if (i > 5) {
      worst = Math.max(worst, haversine(k, here));
      assert.ok(Math.hypot(k.ve, k.vn) < STOPPED_MS, `moving at ${Math.hypot(k.ve, k.vn)} m/s`); // tracker adds no distance
    }
  }
  assert.ok(worst < raw / 2 && worst < 3, `wandered ${worst} m (raw ${raw} m)`);
});

test('kalman: Doppler speed gives live pace and no lag on a straight run', () => {
  let k: KalmanState | null = null;
  for (let i = 0; i <= 120; i++) {
    const f = { ...pt(19 + (3.5 * i + noise(i) * 4) / M, 72.8 + noise(i + 900) * 4 / M, i * 1000, 5), spd: 3.5, hdg: 0.5 };
    k = kalmanStep(k, f, 2);
  }
  const truth = pt(19 + (3.5 * 120) / M, 72.8, 0);
  assert.ok(haversine(k!, truth) < 4, `${haversine(k!, truth)} m behind`);
  assert.ok(Math.abs(k!.vs - 3.5) < 0.15, String(k!.vs));
});

test('kalman rejects a GPS jump, and accepts a real move after three in a row', () => {
  let k: KalmanState | null = null;
  for (let i = 0; i < 20; i++) k = kalmanStep(k, { ...pt(19, 72.8, i * 1000, 4), spd: 0, hdg: 0 }, 2);
  const jump = { ...pt(19 + 200 / M, 72.8, 20_000, 4), spd: 0, hdg: 0 };
  const a = kalmanStep(k, jump, 2);
  assert.equal(a.outlier, true);
  assert.ok(haversine(a, pt(19, 72.8, 0)) < 2);
  const b = kalmanStep(kalmanStep(a, { ...jump, t: 21_000 }, 2), { ...jump, t: 22_000 }, 2);
  const c = kalmanStep(b, { ...jump, t: 23_000 }, 2);
  assert.ok(!c.outlier && haversine(c, jump) < 1, String(haversine(c, jump)));
});

test('fixVelocity ignores speeds and courses the chip did not really measure', () => {
  const f = (spd: number | null, hdg: number | null, acc = 5) => ({ ...pt(0, 0, 0, acc), spd, hdg });
  assert.equal(fixVelocity(f(-1, -1)), null); // iOS invalid
  assert.equal(fixVelocity(f(3, 0)), null); // Android: no bearing
  assert.equal(fixVelocity(f(3, 90, 40)), null); // Wi-Fi fix
  assert.equal(fixVelocity(f(0, 0), 3), null); // Android "no speed" while clearly moving
  assert.deepEqual(fixVelocity(f(0.1, 0)), { ve: 0, vn: 0, sd: 0.3 }); // standing still
  const v = fixVelocity(f(4, 90))!;
  assert.ok(Math.abs(v.ve - 4) < 1e-9 && Math.abs(v.vn) < 1e-9);
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
