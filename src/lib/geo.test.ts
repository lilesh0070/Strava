import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptPoint, bestEffort, cumulative, elevationGain, fmtDuration, fmtKm, fmtPace, fmtSpeed, haversine, splits, totalDistance, type Point } from './geo.ts';

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

test('best effort never spans a pause: two rested 600 m reps are not a 1 km effort', () => {
  const rep1 = line(6, 36); // ~555 m in 3:00
  const rep2 = line(6, 36).map((p) => ({ ...p, lat: p.lat + 0.02, t: p.t + 15 * 60_000 }));
  assert.equal(bestEffort([rep1, rep2], 1000), null);
  // but a continuous km inside one segment still counts
  assert.ok(bestEffort([line(20, 60)], 1000)! > 0);
  // a 40 s traffic-light auto-pause between two halves does not break the effort (stop time excluded)
  const half1 = line(6, 30); // ~555 m in 2:30
  const half2 = line(6, 30).map((p) => ({ ...p, lat: p.lat + 0.006, t: p.t + 150_000 + 40_000 }));
  const e = bestEffort([half1, half2], 1000)!;
  assert.ok(e > 260 && e < 290, `1 km across a short stop: ${e} s`);
  // with recorded distance, the resume hop between the halves (here 200 m) is not metres covered in 0 s
  const r1 = line(6, 30).map((p, i) => ({ ...p, d: i * 111 }));
  const r2 = line(6, 30).map((p, i) => ({ ...p, lat: p.lat + 0.008, t: p.t + 190_000, d: 555 + 200 + i * 111 }));
  const e2 = bestEffort([r1, r2], 1000)!;
  assert.ok(e2 > 260, `1 km with a 200 m resume hop: ${e2} s (would be ~215 s if the hop counted)`);
});

test('derived stats follow the recorded distance when points carry it', () => {
  // points ~111 m apart by chord but the tracker credited 100 m each (smoothed): splits, totals and best efforts use 100
  const seg = line(20, 60).map((p, i) => ({ ...p, d: i * 100 }));
  const { d } = cumulative([seg]);
  assert.equal(d[d.length - 1], 1900);
  assert.equal(totalDistance([seg]), 1900);
  assert.equal(splits([seg]).length, 2); // one full km + a 900 m remainder (chords would give 2.1 km)
  assert.ok(Math.abs(bestEffort([seg], 1000)! - 600) < 1);
  // an older activity (no d) is still measured from the chords
  const old = line(20, 60);
  assert.ok(Math.abs(cumulative([old]).d[19] - 19 * 111.2) < 5);
});

test('formatters never print NaN', () => {
  assert.equal(fmtDuration(NaN), '–:––');
  assert.equal(fmtKm(NaN), '–');
  assert.equal(fmtKm(-3), '0.00');
  assert.equal(fmtPace(NaN, 10), '–:––');
  assert.equal(fmtSpeed(NaN, 10), '0.0');
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
