// Live-tracking maths: GPS smoothing, rolling pace, laps and pace coaching. Pure → unit-tested.
import { haversine, type Point } from './geo';

// ---------- Kalman filter ----------
// Constant-velocity Kalman filter in a local east/north plane (metres, m/s). Every fix updates the
// position with its reported accuracy as measurement noise, and — when the chip provides them — the
// velocity with the GPS Doppler speed + course, which phones measure far more precisely than position.
// Result: no zig-zag (which inflates distance by 3-8 %), no lag behind the runner, no corner cutting,
// no creeping distance while standing still, and an instant, steady "pace now".
// Both axes share one 2x2 covariance [pp pv; pv vv]: the noise model is isotropic, so it stays identical.

/** A raw fix as it arrives from the OS, before smoothing. */
export type GpsFix = Point & {
  spd?: number | null; // Doppler ground speed m/s (iOS: -1 = invalid; Android: 0 when the fix has none)
  hdg?: number | null; // course over ground, degrees from north (iOS: -1 = invalid; Android: 0 when none)
};

export type KalmanState = {
  lat: number; lng: number;
  ve: number; vn: number; // velocity east / north, m/s
  pp: number; pv: number; vv: number; // per-axis covariance
  t: number;
  n: number; // fixes since the last reset
  rej: number; // consecutive outliers
  vs: number; // speed for display, lightly smoothed (m/s)
  outlier?: boolean; // true when this step's fix was rejected
  /** Time of the last fix that carried a usable Doppler velocity (phones without one never set it). */
  dopT?: number;
};

const M_PER_DEG = (6371000 * Math.PI) / 180; // same earth radius as haversine()
const RESET_GAP_MS = 20_000;
const GATE = 16; // χ² (2 dof) ≈ 4 σ
/** Below this the athlete is standing still: the filter is told so and "pace now" shows –:––. */
export const STOPPED_MS = 0.4;

/** Horizontal accuracy is a ~68 % radius; per-axis σ of a 2-D Gaussian is about 0.66 of that. */
const posSigma = (acc: number | null) => Math.max(acc ?? 15, 2.5) * 0.66;

/** Velocity measurement from the fix, or null when the chip didn't give a trustworthy one. */
export function fixVelocity(f: GpsFix, currentSpeed = 0): { ve: number; vn: number; sd: number } | null {
  const spd = f.spd;
  if (spd == null || !Number.isFinite(spd) || spd < 0) return null;
  if ((f.acc ?? 99) > 25) return null; // Wi-Fi / cell fixes carry no real Doppler speed
  if (spd < STOPPED_MS) {
    // Android reports exactly 0 (and no course) when the fix simply has no speed. Treating that as
    // "standing still" pinned the velocity at 0 on phones without Doppler, so a walker was dropped as
    // stopped and distance came out far too short. A real stop reports a small non-zero speed, or 0 with
    // a course; the position gate catches true stops anyway.
    if (spd === 0 && (f.hdg == null || f.hdg <= 0)) return null;
    if (spd === 0 && currentSpeed > 1) return null;
    return { ve: 0, vn: 0, sd: 0.3 };
  }
  const h = f.hdg;
  if (h == null || !Number.isFinite(h) || h <= 0 || h > 360) return null; // no course: position only
  const a = (h * Math.PI) / 180;
  return { ve: spd * Math.sin(a), vn: spd * Math.cos(a), sd: 0.3 + 0.12 * spd };
}

function freshState(f: GpsFix): KalmanState {
  const sd = posSigma(f.acc);
  const v = fixVelocity(f);
  return {
    lat: f.lat, lng: f.lng, ve: v?.ve ?? 0, vn: v?.vn ?? 0,
    pp: sd * sd, pv: 0, vv: v ? Math.max(v.sd * v.sd, 1) : 9,
    t: f.t, n: 1, rej: 0, vs: v ? Math.hypot(v.ve, v.vn) : 0,
  };
}

/**
 * Feed one fix. `q` is the process noise (how hard the athlete can accelerate, m²/s³), see processNoise().
 * Outliers (multipath jumps) are rejected with `outlier: true`; three in a row reset the filter, so a
 * genuinely moved position is never fought for long.
 */
export function kalmanStep(state: KalmanState | null | undefined, f: GpsFix, q = 2): KalmanState {
  const s = state;
  if (!s || typeof s.ve !== 'number' || !Number.isFinite(s.pp) || f.t - s.t > RESET_GAP_MS || (s.rej ?? 0) >= 3) {
    return freshState(f);
  }
  const dt = Math.max(0, (f.t - s.t) / 1000);
  const kx = M_PER_DEG * Math.cos((s.lat * Math.PI) / 180), ky = M_PER_DEG;

  // predict
  let lat = s.lat + (s.vn * dt) / ky, lng = s.lng + (s.ve * dt) / kx, ve = s.ve, vn = s.vn;
  let pp = s.pp + 2 * dt * s.pv + dt * dt * s.vv + (q * dt ** 3) / 3;
  let pv = s.pv + dt * s.vv + (q * dt * dt) / 2;
  let vv = s.vv + q * dt;

  // position update, gated against outliers
  const sd = posSigma(f.acc);
  const ex = (f.lng - lng) * kx, ny = (f.lat - lat) * ky;
  const S = pp + sd * sd, d2 = ex * ex + ny * ny;
  if (d2 > GATE * S && d2 > 100) {
    return { lat, lng, ve, vn, pp, pv, vv, t: f.t, n: s.n, rej: (s.rej ?? 0) + 1, vs: s.vs, outlier: true };
  }
  const kp = pp / S, kv = pv / S;
  lng += (ex * kp) / kx; lat += (ny * kp) / ky; ve += ex * kv; vn += ny * kv;
  [pp, pv, vv] = [(1 - kp) * pp, (1 - kp) * pv, vv - kv * pv];

  // velocity update (Doppler)
  const m = fixVelocity(f, Math.hypot(ve, vn));
  if (m) {
    const S2 = vv + m.sd * m.sd, kp2 = pv / S2, kv2 = vv / S2;
    const de = m.ve - ve, dn = m.vn - vn;
    lng += (de * kp2) / kx; lat += (dn * kp2) / ky; ve += de * kv2; vn += dn * kv2;
    [pp, pv, vv] = [pp - kp2 * pv, (1 - kv2) * pv, (1 - kv2) * vv];
  }

  const speed = Math.hypot(ve, vn);
  const vs = s.vs + (1 - Math.exp(-dt / 3)) * (speed - s.vs);
  const dopT = m && Math.hypot(m.ve, m.vn) >= STOPPED_MS ? f.t : s.dopT;
  return { lat, lng, ve, vn, pp, pv, vv, t: f.t, n: s.n + 1, rej: 0, vs, dopT };
}

/** True while the chip has been giving Doppler velocity recently (so speed, not just position, is trusted). */
export const hasDoppler = (s: KalmanState | null | undefined, now: number) => s?.dopT != null && now - s.dopT <= 10_000;

/** Process noise per sport: riders change speed and direction faster than walkers. */
export const processNoise = (sport: string) => (sport === 'ride' ? 4 : sport === 'run' ? 2 : 1);

// ---------- distance ----------
// How far a fix adds to the recorded distance. Tuned on a simulator with realistic GPS noise (slow
// drift + jitter + multipath spikes, 1 Hz) over city grids with stops, a 400 m track, curves and intervals:
//  • On foot with Doppler: the filtered speed integrated over time. Position noise after the filter is
//    still ~1-2 m per second, which at walking speed inflated distance by 3-6 %; velocity is far steadier.
//    Walk +4.1 % → +2.3 %, hike +5.9 % → −0.6 %, run ±1 %, intervals +1.7 % → +0.1 %.
//  • Riding with Doppler: the filtered position (already within ~1 %).
//  • No Doppler (many budget Android phones report speed 0): a second, speed-aware smoother on the position
//    plus a gate that scales with the reported accuracy. Over-count +9 % (up to +21 % at ±12 m) → ~±2 %.
export type DistanceState = {
  /** Second-stage smoothed position, metres east/north of the first point (no-Doppler path). */
  sx?: number; sy?: number; st?: number;
  /** Last position that was credited (no-Doppler path). */
  ax?: number; ay?: number;
  /** Local metres-per-degree at the route's latitude. */
  kx?: number; lat0?: number; lng0?: number;
};

/** Distance the no-Doppler path still holds back (smoothed position past the last credited anchor). */
export function distancePending(ds: DistanceState | undefined): number {
  if (!ds || ds.sx == null || ds.sy == null || ds.ax == null || ds.ay == null) return 0;
  return Math.hypot(ds.sx - ds.ax, ds.sy - ds.ay);
}

/**
 * Distance to add for this filtered fix, in metres (0 = nothing to add). `prevSpeed` is the filtered
 * speed at the previous kept fix. Mutates `ds` so the session can persist it.
 */
export function distanceStep(
  ds: DistanceState, kf: KalmanState, f: GpsFix, sport: string, prevSpeed: number, dtSec: number, dPos: number,
): number {
  const speed = Math.hypot(kf.ve, kf.vn);
  if (hasDoppler(kf, f.t)) {
    ds.st = undefined; ds.ax = undefined; // leave the no-Doppler path idle
    if (sport === 'ride') return dPos;
    return 0.5 * (prevSpeed + speed) * dtSec; // trapezoid of the filtered speed
  }
  // no Doppler: smooth the position again, with a time constant that grows when slow or inaccurate
  if (ds.lat0 == null || ds.lng0 == null || ds.kx == null) {
    ds.lat0 = kf.lat; ds.lng0 = kf.lng; ds.kx = M_PER_DEG * Math.cos((kf.lat * Math.PI) / 180);
  }
  const px = (kf.lng - ds.lng0) * ds.kx, py = (kf.lat - ds.lat0) * M_PER_DEG;
  if (ds.st == null || ds.sx == null || ds.sy == null || f.t - ds.st > RESET_GAP_MS) {
    ds.sx = px; ds.sy = py; ds.st = f.t; ds.ax = px; ds.ay = py;
    return 0;
  }
  const dt = Math.max(0, (f.t - ds.st) / 1000);
  // time constant ~10 s at 2 m/s and ±8 m, longer when slower or less accurate (calibrated on the
  // simulator: mean error 6.7 % → 1.6 % across walk/run/ride, curves are not cut by more than ~3 %)
  const tc = 10 * Math.max(0.5, Math.min(3, (f.acc ?? 8) / 8)) * Math.max(0.5, Math.min(3, 2 / Math.max(speed, 0.5)));
  const a = 1 - Math.exp(-dt / tc);
  ds.sx += a * (px - ds.sx); ds.sy += a * (py - ds.sy); ds.st = f.t;
  if (ds.ax == null || ds.ay == null) { ds.ax = ds.sx; ds.ay = ds.sy; return 0; }
  const d = Math.hypot(ds.sx - ds.ax, ds.sy - ds.ay);
  const gate = Math.min(14, Math.max(3, 0.8 * (f.acc ?? 10)));
  if (d < gate) return 0;
  ds.ax = ds.sx; ds.ay = ds.sy;
  return d;
}

// ---------- rolling pace ----------
/** Average speed (m/s) over the last `windowSec` seconds of a segment, or null if not enough data. */
export function rollingSpeed(seg: Point[], windowSec = 30): number | null {
  if (seg.length < 2) return null;
  const end = seg[seg.length - 1];
  let d = 0;
  let i = seg.length - 1;
  while (i > 0 && end.t - seg[i - 1].t <= windowSec * 1000) { d += haversine(seg[i - 1], seg[i]); i--; }
  const dt = (end.t - seg[i].t) / 1000;
  if (dt < Math.min(10, windowSec / 2)) return null;
  return d / dt;
}

// ---------- laps ----------
export type LapMark = { distanceM: number; movingSec: number };
export type Lap = { n: number; distanceM: number; durationSec: number };

/** Turn lap boundaries (cumulative distance/time at each press) into lap rows, including the open lap. */
export function lapsFromMarks(marks: LapMark[], totalDistanceM: number, totalMovingSec: number): Lap[] {
  const pts = [{ distanceM: 0, movingSec: 0 }, ...marks, { distanceM: totalDistanceM, movingSec: totalMovingSec }];
  const out: Lap[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i].distanceM - pts[i - 1].distanceM, t = pts[i].movingSec - pts[i - 1].movingSec;
    if (i === pts.length - 1 && d < 10 && t < 5) break; // empty trailing lap
    out.push({ n: out.length + 1, distanceM: Math.max(0, d), durationSec: Math.max(0, t) });
  }
  return out;
}

// ---------- pace coach ----------
export type PaceAdvice = 'faster' | 'slower' | null;
/** Compare current pace (sec/km) against a target with a tolerance band. */
export function paceAdvice(currentSecPerKm: number | null, targetSecPerKm: number, toleranceSec = 15): PaceAdvice {
  if (currentSecPerKm == null || !Number.isFinite(currentSecPerKm)) return null;
  if (currentSecPerKm > targetSecPerKm + toleranceSec) return 'faster';
  if (currentSecPerKm < targetSecPerKm - toleranceSec) return 'slower';
  return null;
}

/** Parse "5:30" → 330 seconds. */
export function parsePace(s: string): number | null {
  const m = /^\s*(\d{1,2}):([0-5]\d)\s*$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// ---------- signal health ----------
export type GpsHealth = 'good' | 'weak' | 'lost';
export function gpsHealth(lastFix: Point | null, now: number): GpsHealth {
  if (!lastFix || now - lastFix.t > 15_000) return 'lost';
  return (lastFix.acc ?? 99) <= 20 ? 'good' : 'weak';
}

// ---------- pace series for charts ----------
/** Speed (m/s) sampled every `stepM` metres along the activity, lightly smoothed. */
export function speedSeries(segments: Point[][], stepM = 100): { d: number; v: number }[] {
  const out: { d: number; v: number }[] = [];
  let dist = 0, bucketD = 0, bucketT = 0;
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) {
      const dd = haversine(seg[i - 1], seg[i]), dt = (seg[i].t - seg[i - 1].t) / 1000;
      dist += dd; bucketD += dd; bucketT += dt;
      if (bucketD >= stepM) {
        if (bucketT > 0) out.push({ d: dist, v: bucketD / bucketT });
        bucketD = 0; bucketT = 0;
      }
    }
  }
  // 3-point moving average
  return out.map((p, i) => {
    const w = out.slice(Math.max(0, i - 1), i + 2);
    return { d: p.d, v: w.reduce((s, x) => s + x.v, 0) / w.length };
  });
}
