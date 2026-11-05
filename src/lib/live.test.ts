import assert from 'node:assert/strict';
import { test } from 'node:test';
import { haversine, type Point } from './geo.ts';
import {
  STOPPED_MS, creditedSpeed, distancePending, distanceStep, fixVelocity, gpsHealth, hasDoppler, kalmanStep, lapsFromMarks, paceAdvice, parsePace, rollingSpeed, settlePending, type KalmanState,
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

test('fixVelocity: the two "speed 0" conventions — Android no-measurement vs iPhone stop', () => {
  const f = (spd: number | null, hdg: number | null) => ({ ...pt(0, 0, 0, 6), spd, hdg });
  // Android, chip without Doppler: 0 with bearing 0 → no measurement (a walker must not be pinned at 0)
  assert.equal(fixVelocity(f(0, 0), 0.3), null);
  assert.equal(fixVelocity(f(0, 0), 0), null);
  // Android, chip that gave Doppler a moment ago → a real stop
  assert.deepEqual(fixVelocity(f(0, 0), 0.3, true), { ve: 0, vn: 0, sd: 0.3 });
  // iPhone standing still: speed 0, course -1 → a real stop, even on the very first fix
  assert.deepEqual(fixVelocity(f(0, -1)), { ve: 0, vn: 0, sd: 0.3 });
  assert.deepEqual(fixVelocity(f(0, 90)), { ve: 0, vn: 0, sd: 0.3 }); // 0 with a course: a stop
  // a slow hiker's 0.3 m/s with a course is a measurement, not a stop
  const slow = fixVelocity(f(0.3, 90))!;
  assert.ok(Math.abs(slow.ve - 0.3) < 1e-9 && Math.abs(slow.vn) < 1e-9 && slow.sd === 0.3);
});

test('kalman: an iPhone standing still (speed 0, course -1) reads as stopped from the first fix', () => {
  let k: KalmanState | null = null;
  for (let i = 0; i < 60; i++) {
    k = kalmanStep(k, { ...pt(19 + noise(i) * 5 / M, 72.8 + noise(i + 500) * 5 / M, i * 1000, 6), spd: 0, hdg: -1 }, 2);
    if (i > 3) assert.ok(Math.hypot(k.ve, k.vn) < STOPPED_MS, `moving at ${Math.hypot(k.ve, k.vn)} m/s`);
  }
  assert.equal(hasDoppler(k, 60_000), true); // a measured stop is Doppler too: the speed path stays in use
});

test('kalman without Doppler still tracks walking speed', () => {
  let k: KalmanState | null = null;
  const speeds: number[] = [];
  for (let i = 0; i <= 90; i++) {
    const f = { ...pt(19 + (1.3 * i + noise(i) * 5) / M, 72.8 + noise(i + 300) * 5 / M, i * 1000, 8), spd: 0, hdg: 0 };
    k = kalmanStep(k, f, 1);
    if (i > 30) speeds.push(Math.hypot(k.ve, k.vn));
  }
  const median = speeds.sort((a, b) => a - b)[Math.floor(speeds.length / 2)];
  assert.ok(median > 0.8 && median < 2.0, `median filtered speed ${median} m/s for a 1.3 m/s walk`);
  assert.equal(hasDoppler(k, 90_000), false);
});

// ---------- distance stage ----------
const kfAt = (lat: number, lng: number, ve: number, vn: number, t: number, n = 10, dopT?: number): KalmanState =>
  ({ lat, lng, ve, vn, pp: 4, pv: 0, vv: 1, t, n, rej: 0, vs: Math.hypot(ve, vn), dopT });

test('distanceStep: on foot with Doppler the filtered speed is integrated per fix, rides use the position', () => {
  const ds = {};
  const f = (t: number, lat: number) => ({ ...pt(lat, 72.8, t, 5), spd: 3, hdg: 0 });
  // 3 m/s north, 1 Hz, positions 3.4 m apart (noise): speed × time wins
  let d = 0;
  for (let i = 0; i < 10; i++) d += distanceStep(ds, kfAt(19 + (3.4 * i) / M, 72.8, 0, 3, i * 1000, 10, i * 1000), f(i * 1000, 19 + (3.4 * i) / M), 'run').add;
  assert.ok(Math.abs(d - 27) < 0.05, `${d} m for 9 s at 3 m/s`);
  // a ride credits the position once it has moved 3 m past the anchor
  const rs = {};
  let r = 0;
  for (let i = 0; i < 10; i++) r += distanceStep(rs, kfAt(19 + (7.6 * i) / M, 72.8, 0, 8, i * 1000, 10, i * 1000), { ...pt(19 + (7.6 * i) / M, 72.8, i * 1000, 5), spd: 8, hdg: 0 }, 'ride').add;
  assert.ok(Math.abs(r - 7.6 * 9) < 0.1, `${r} m for 9 fixes 7.6 m apart`);
});

test('distanceStep: standing still adds (almost) nothing, however long, and a restart is credited', () => {
  const ds = {};
  let d = 0;
  let kf: KalmanState | null = null;
  const at = (i: number, lat: number, spd: number, hdg: number) => {
    const f = { ...pt(lat + noise(i) * 4 / M, 72.8 + noise(i + 700) * 4 / M, i * 1000, 6), spd, hdg };
    kf = kalmanStep(kf, f, 2);
    if (!kf.outlier) d += distanceStep(ds, kf, f, 'run').add;
  };
  for (let i = 0; i < 30; i++) at(i, 19 + (3 * i) / M, 3, 0.5); // 30 s run north (course 0.5°: Android's 0 means none)
  const before = d;
  for (let i = 30; i < 630; i++) at(i, 19 + 90 / M, Math.abs(noise(i)) * 0.3, 0); // 10 min at a light: small spurious speeds
  assert.ok(d - before < 5, `${(d - before).toFixed(1)} m crept in while standing`);
  assert.equal((ds as { still?: boolean }).still, true);
  for (let i = 630; i < 660; i++) at(i, 19 + (90 + 3 * (i - 629)) / M, 3, 0.5); // off again
  assert.ok(d > before + 80 && d < before + 95, `${(d - before).toFixed(1)} m for the 90 m after the stop`);
});

test('distanceStep: slow hikers who dip under the stop threshold are not clipped', () => {
  for (const v of [0.5, 0.7]) {
    const ds = {};
    let d = 0;
    let kf: KalmanState | null = null;
    for (let i = 0; i < 600; i++) {
      const spd = Math.max(0, v + noise(i) * 0.45); // ±0.45 m/s of Doppler noise: often under STOPPED_MS for a fix or two
      const f = { ...pt(19 + (v * i + noise(i + 11) * 3) / M, 72.8 + noise(i + 900) * 3 / M, i * 1000, 8), spd, hdg: 0.5 };
      kf = kalmanStep(kf, f, 1);
      if (!kf.outlier) d += distanceStep(ds, kf, f, 'hike').add;
    }
    const truth = v * 599;
    assert.ok(Math.abs(d - truth) / truth < 0.06, `${d.toFixed(0)} m for a ${truth.toFixed(0)} m hike at ${v} m/s`);
  }
});

test('distanceStep: a GPS outage while moving credits the straight line; while stopped nothing', () => {
  const walk = (gapM: number) => {
    const ds = {};
    let d = 0;
    let kf: KalmanState | null = null;
    const step = (i: number, lat: number) => {
      const f = { ...pt(lat, 72.8, i * 1000, 5), spd: 3, hdg: 0.5 };
      kf = kalmanStep(kf, f, 2);
      d += distanceStep(ds, kf, f, 'run').add;
    };
    for (let i = 0; i < 20; i++) step(i, 19 + (3 * i) / M);
    const before = d;
    for (let i = 80; i < 100; i++) step(i, 19 + (60 + gapM + 3 * (i - 80)) / M); // fixes resume 60 s later
    return d - before;
  };
  assert.ok(walk(180) > 0.8 * (180 + 57), `credited ${walk(180)} m for a 180 m outage + 57 m`); // ran on under the bridge
  assert.ok(walk(0) < 70, `credited ${walk(0)} m after standing under the bridge`);
});

test('distanceStep without Doppler credits a steady walk within a few percent', () => {
  const ds = {};
  let dist = 0;
  for (let i = 1; i <= 300; i++) {
    const lat = 19 + (1.3 * i) / M;
    const k: KalmanState = { lat, lng: 72.8, ve: 0, vn: 1.3, pp: 4, pv: 0, vv: 1, t: i * 1000, n: i, rej: 0, vs: 1.3 };
    const f = { ...pt(lat, 72.8, i * 1000, 8), spd: 0, hdg: 0 };
    dist += distanceStep(ds, k, f, 'walk').add;
  }
  // the smoother lags a little behind (held back until the next anchor / the end of the segment)
  assert.ok(dist > 390 * 0.9 && dist <= 390 * 1.03, `credited ${dist} m for 390 m`);
  dist += settlePending(ds);
  // the smoother's start-up lag costs a fixed ~20 m per segment (0.4 % of a 5 km walk)
  assert.ok(Math.abs(dist - 390) / 390 < 0.07, `with the pending rest: ${dist} m for 390 m`);
  assert.equal(distancePending(ds), 0);
});

test('creditedSpeed: Δdistance/Δtime over the window, null until there is enough of it', () => {
  const samples = Array.from({ length: 61 }, (_, i) => ({ t: i * 1000, d: i * 1.3 })); // 1.3 m/s for 60 s
  assert.ok(Math.abs(creditedSpeed(samples, 30)! - 1.3) < 1e-9);
  assert.equal(creditedSpeed(samples.slice(0, 5), 30), null); // 4 s: too little
  assert.equal(creditedSpeed([], 30), null);
  // chunky credits (no-Doppler anchor path) still average out
  const chunky = Array.from({ length: 61 }, (_, i) => ({ t: i * 1000, d: Math.floor(i / 5) * 6.5 }));
  assert.ok(Math.abs(creditedSpeed(chunky, 30)! - 1.3) < 0.15, String(creditedSpeed(chunky, 30)));
});

test('laps never add up to more than the moving time once a lap mark is clamped', () => {
  // a lap pressed while already standing (mark at 600 s) after auto-pause back-dated the pause to 590 s
  const marks = [{ distanceM: 1000, movingSec: 600 }].map((l) => (l.movingSec > 590 ? { ...l, movingSec: 590 } : l));
  const laps = lapsFromMarks(marks, 1000, 590);
  assert.equal(laps.reduce((s, l) => s + l.durationSec, 0), 590);
});

test('kalman: a rejected spike keeps the Doppler history (a standing Android phone stays "stopped")', () => {
  let k: KalmanState | null = null;
  for (let i = 0; i < 20; i++) k = kalmanStep(k, { ...pt(19, 72.8, i * 1000, 5), spd: 0.6, hdg: 10 }, 2);
  for (let i = 20; i < 25; i++) k = kalmanStep(k, { ...pt(19, 72.8, i * 1000, 5), spd: 0, hdg: 0 }, 2);
  const spike = kalmanStep(k, { ...pt(19 + 200 / M, 72.8, 25_000, 5), spd: 0, hdg: 0 }, 2);
  assert.equal(spike.outlier, true);
  assert.equal(spike.dopT, k!.dopT);
  const after = kalmanStep(spike, { ...pt(19, 72.8, 26_000, 5), spd: 0, hdg: 0 }, 2);
  assert.equal(after.dopT, 26_000); // still read as a measured stop
});
