import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptPoint, bestEffort, elevationGain, fmtDuration, fmtPace, haversine, splits, totalDistance, type Point } from './geo.ts';

// Straight line heading north: 0.001° latitude ≈ 111.2 m
function line(n: number, secPerStep: number, alt?: (i: number) => number): Point[] {
  return Array.from({ length: n }, (_, i) => ({
    lat: 19 + i * 0.001, lng: 72.8, alt: alt ? alt(i) : null, acc: 5, t: i * secPerStep * 1000,
  }));
}

test('haversine ~111 m per 0.001 deg latitude', () => {
  const d = haversine({ lat: 19, lng: 72.8 }, { lat: 19.001, lng: 72.8 });
  assert.ok(Math.abs(d - 111.2) < 0.5, String(d));
});

test('splits and distance', () => {
  const seg = line(46, 30); // 45 steps * 111.2 m ≈ 5.0 km at 30 s/step (≈ 4:30/km)
  const total = totalDistance([seg]);
  assert.ok(Math.abs(total - 5004) < 10, String(total));
  const sp = splits([seg]);
  assert.equal(sp.length, 5);
  for (const s of sp.slice(0, 4)) assert.ok(Math.abs(s.durationSec - 269.8) < 2, String(s.durationSec));
  assert.equal(fmtPace(total, 45 * 30), '4:30');
});

test('paused gap between segments does not count', () => {
  const a = line(10, 30);
  const b = line(10, 30).map((p) => ({ ...p, lat: p.lat + 0.009, t: p.t + 3_600_000 }));
  const sp = splits([a, b]);
  assert.ok(sp[0].durationSec < 300, String(sp[0].durationSec));
});

test('best effort finds fastest km', () => {
  const slow = line(20, 60);
  const fast = line(20, 20).map((p) => ({ ...p, lat: p.lat + 0.019, t: p.t + 19 * 60_000 }));
  const best = bestEffort([[...slow, ...fast.slice(1)]], 1000)!;
  assert.ok(Math.abs(best - 180) < 2, String(best));
  assert.equal(bestEffort([line(3, 10)], 1000), null);
});

test('elevation gain ignores small noise and GPS altitude wander', () => {
  const seg = line(40, 10, (i) => 100 + (i % 2 ? 1.5 : 0) + (i > 20 ? 30 : 0));
  const g = elevationGain([seg]);
  assert.ok(g >= 22 && g <= 33, String(g)); // the 30 m step is smoothed over ~20 s, so a little lags past the end
  // flat road, but the altitude wanders ±6 m in slow waves (typical phone GPS): no climb should be counted
  const flat = line(600, 2.5, (i) => 100 + 6 * Math.sin(i / 9) + (i % 3 - 1) * 2);
  assert.ok(elevationGain([flat]) < 15, String(elevationGain([flat])));
  // a real 50 m climb over 1 km still counts (allow the smoothing to lag a little)
  const climb = line(400, 2.5, (i) => 100 + Math.min(50, i * 0.125) + (i % 2 ? 2 : -2));
  const gc = elevationGain([climb]);
  assert.ok(gc >= 40 && gc <= 60, String(gc));
});

test('point filter', () => {
  const p = line(2, 1);
  assert.equal(acceptPoint(undefined, { ...p[0], acc: 80 }), false);
  assert.equal(acceptPoint(p[0], { ...p[0], lat: p[0].lat + 0.00001, t: 1000 }), false); // ~1 m jitter
  assert.equal(acceptPoint(p[0], { ...p[1], t: 1000 }, 12), false); // 111 m in 1 s for a run
  assert.equal(acceptPoint(p[0], { ...p[1], t: 30000 }, 12), true);
});

test('format duration', () => {
  assert.equal(fmtDuration(59), '0:59');
  assert.equal(fmtDuration(3725), '1:02:05');
});
