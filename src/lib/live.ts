// Live-tracking maths: GPS smoothing, rolling pace, laps and pace coaching. Pure → unit-tested.
import { pointGap, type Point } from './geo';

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

/**
 * Position measurement noise. The reported accuracy is a ~68 % radius (per-axis σ ≈ 0.66 of it), but phone
 * errors are correlated over 10-60 s, not white; trusting positions a little less (σ = 1.0·acc) stops the
 * filter following that slow wander (simulator: walking/standing error roughly halved).
 */
const posSigma = (acc: number | null) => Math.max(acc ?? 15, 2.5);

/**
 * Velocity measurement from the fix, or null when the chip didn't give a trustworthy one.
 * `recentDoppler`: the filter saw real Doppler in the last few seconds (see hasDoppler()).
 */
export function fixVelocity(f: GpsFix, currentSpeed = 0, recentDoppler = false): { ve: number; vn: number; sd: number } | null {
  const spd = f.spd;
  if (spd == null || !Number.isFinite(spd) || spd < 0) return null; // iOS: -1 = invalid
  if ((f.acc ?? 99) > 25) return null; // Wi-Fi / cell fixes carry no real Doppler speed
  const h = f.hdg;
  if (spd < STOPPED_MS) {
    if (spd === 0 && currentSpeed > 1) return null; // an exact 0 while clearly moving: a glitch, not a stop
    // Two conventions for "speed 0, no course":
    //  • iOS reports speed 0 with course -1 whenever the iPhone stands still → a real stop.
    //  • Android reports 0 with bearing 0 when the fix simply has no speed. On a chip that was giving
    //    Doppler a moment ago that means stopped; on a phone that never did (many budget models) it is no
    //    measurement at all — treating it as a stop pinned a walker's velocity at 0 and lost half the distance.
    if (spd === 0 && (h == null || h === 0) && !recentDoppler) return null;
    if (h != null && h > 0 && h <= 360 && spd > 0) { // a slow walker's 0.3 m/s is a measurement, not a stop
      const a = (h * Math.PI) / 180;
      return { ve: spd * Math.sin(a), vn: spd * Math.cos(a), sd: 0.3 };
    }
    return { ve: 0, vn: 0, sd: 0.3 };
  }
  if (h == null || !Number.isFinite(h) || h <= 0 || h > 360) return null; // no course: position only
  const a = (h * Math.PI) / 180;
  // phone Doppler is good to ~0.2-0.5 m/s at any speed; the old 0.3 + 0.12·v under-trusted it when fast
  return { ve: spd * Math.sin(a), vn: spd * Math.cos(a), sd: 0.25 + 0.05 * spd };
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
    // keep dopT: one rejected spike must not make a standing Android phone lose its "stopped" Doppler chain
    return { lat, lng, ve, vn, pp, pv, vv, t: f.t, n: s.n, rej: (s.rej ?? 0) + 1, vs: s.vs, outlier: true, dopT: s.dopT };
  }
  const kp = pp / S, kv = pv / S;
  lng += (ex * kp) / kx; lat += (ny * kp) / ky; ve += ex * kv; vn += ny * kv;
  [pp, pv, vv] = [(1 - kp) * pp, (1 - kp) * pv, vv - kv * pv];

  // velocity update (Doppler)
  const m = fixVelocity(f, Math.hypot(ve, vn), hasDoppler(s, f.t));
  if (m) {
    const S2 = vv + m.sd * m.sd, kp2 = pv / S2, kv2 = vv / S2;
    const de = m.ve - ve, dn = m.vn - vn;
    lng += (de * kp2) / kx; lat += (dn * kp2) / ky; ve += de * kv2; vn += dn * kv2;
    [pp, pv, vv] = [pp - kp2 * pv, (1 - kv2) * pv, (1 - kv2) * vv];
  }

  const speed = Math.hypot(ve, vn);
  const vs = s.vs + (1 - Math.exp(-dt / 3)) * (speed - s.vs);
  const dopT = m ? f.t : s.dopT; // a measured stop is Doppler too (iOS reports exactly that while standing)
  return { lat, lng, ve, vn, pp, pv, vv, t: f.t, n: s.n + 1, rej: 0, vs, dopT };
}

/** True while the chip has been giving Doppler velocity recently (so speed, not just position, is trusted). */
export const hasDoppler = (s: KalmanState | null | undefined, now: number) => s?.dopT != null && now - s.dopT <= 10_000;

/** Process noise per sport: riders change speed and direction faster than walkers. */
export const processNoise = (sport: string) => (sport === 'ride' ? 4 : sport === 'run' ? 2 : 1);

// ---------- distance ----------
// How far each filtered fix adds to the recorded distance. Called for EVERY filtered fix (not only the
// points kept for the route), so a stop never leaves a gap to integrate across. Tuned on a simulator with
// realistic GPS noise (slow drift + jitter + multipath spikes, 1 Hz) over city grids with traffic-light
// stops, standing still, a 400 m track, curves, intervals and a 60 s outage, for three phone conventions
// (Android and iPhone Doppler, no Doppler):
//  • On foot with Doppler: the filtered speed integrated over each fix interval (trapezoid). Position noise
//    after the filter is still ~1-2 m per second, which at walking speed inflated distance by 3-6 %;
//    velocity is far steadier. Speed counts as 0 while the "still" state (hysteresis below) is active, so
//    standing at a light adds nothing. A gap between fixes longer than MAX_GAP_SEC (tunnel, bridge) gets the
//    straight line instead, capped by a plausible speed.
//  • Riding with Doppler: the filtered position, credited whenever it has moved 3 m past the last anchor.
//  • No Doppler (many budget Android phones report speed 0): a second, speed-aware smoother on the position
//    plus an anchor gate that scales with the reported accuracy. The smoother is skipped when fast, because
//    an exponential average cuts bends.
export type DistanceState = {
  /** Local metres-per-degree frame at the route's start. */
  lat0?: number; lng0?: number; kx?: number;
  /** Previous filtered fix: position (m east/north), time, speed credited. */
  fx?: number; fy?: number; ft?: number; fv?: number;
  /** Second-stage smoothed position (no-Doppler path). */
  sx?: number; sy?: number; st?: number;
  /** Last credited anchor (chord paths: rides and no Doppler). */
  ax?: number; ay?: number;
  /** Position to store for the route (the smoothed one on the no-Doppler path). */
  tx?: number; ty?: number;
  /** Standing still, with hysteresis: entered after 3 slow fixes, left after 2 fast ones, 5 slow-but-moving ones or a real move. */
  still?: boolean; slowN?: number; fastN?: number; midN?: number; midSum?: number; qx?: number; qy?: number; stillT?: number;
};

/** Longer than this between fixes and the speed integral gives way to the straight line. */
export const MAX_GAP_SEC = 5;
/** Filtered speed needed (twice in a row) to leave the still state. */
export const MOVING_MS = 0.8;
/**
 * Below this on three fixes in a row the still state begins. A real stop settles at ~0.1 m/s within a few
 * seconds; a 0.5 m/s hiker's filtered speed (σ ≈ 0.15) rarely dips under it three times running.
 */
export const STILL_MS = 0.25;

const cur = (ds: DistanceState) => (ds.st != null ? [ds.sx, ds.sy] : [ds.fx, ds.fy]);

/** Distance a chord path still holds back (smoothed position past the last credited anchor). */
export function distancePending(ds: DistanceState | undefined): number {
  if (!ds || ds.ax == null || ds.ay == null) return 0;
  const [cx, cy] = cur(ds);
  if (cx == null || cy == null) return 0;
  return Math.hypot(cx - ds.ax, cy - ds.ay);
}

/** Credit what distancePending() holds and move the anchor there; called when a segment ends. */
export function settlePending(ds: DistanceState | undefined): number {
  const rest = distancePending(ds);
  if (ds && rest > 0) { [ds.ax, ds.ay] = cur(ds) as [number, number]; }
  return rest;
}

export type DistanceResult = {
  /** Metres to add (0 = nothing this fix). */
  add: number;
  /** Standing still (points are not stored and the auto-pause clock runs). */
  still: boolean;
  /** Where to put the route point for this fix. */
  lat: number; lng: number;
};

/** Feed one filtered (non-outlier) fix. Mutates `ds` so the session can persist it. */
export function distanceStep(ds: DistanceState, kf: KalmanState, f: GpsFix, sport: string): DistanceResult {
  if (ds.lat0 == null || ds.lng0 == null || ds.kx == null) {
    ds.lat0 = kf.lat; ds.lng0 = kf.lng; ds.kx = M_PER_DEG * Math.cos((kf.lat * Math.PI) / 180);
  }
  const px = (kf.lng - ds.lng0) * ds.kx, py = (kf.lat - ds.lat0) * M_PER_DEG;
  const acc = f.acc ?? 10;
  const raw = Math.hypot(kf.ve, kf.vn);

  // the first fixes after a (re)start can be tens of metres off: no credit and no anchor until settled
  const warm = kf.n >= 3 || acc <= 15;
  const dt = ds.ft == null ? 0 : Math.max(0, (f.t - ds.ft) / 1000);
  let add = 0;

  // Fixes stopped for a while (tunnel, bridge, provider hiccup): the straight line from the last fix, capped
  // by a plausible speed, and every stage restarts from here. Nothing is credited for a stop (short chord).
  if (ds.ft != null && dt > MAX_GAP_SEC) {
    const chord = ds.fx != null && ds.fy != null ? Math.hypot(px - ds.fx, py - ds.fy) : 0;
    if (warm && chord >= Math.max(3, 0.8 * acc)) add = Math.min(chord, (sport === 'ride' ? 45 : 12) * dt);
    ds.st = undefined; ds.sx = undefined; ds.sy = undefined; ds.ax = undefined; ds.ay = undefined;
    ds.still = false; ds.slowN = 0; ds.fastN = 0; ds.midN = 0; ds.midSum = 0;
  }

  // still state with hysteresis: one spurious fix must neither start nor end a stop
  const wasStill = !!ds.still;
  let retro = 0; // speed counted as 0 while "still" that turned out to be a slow start
  if (!ds.still) {
    ds.slowN = raw < STILL_MS ? (ds.slowN ?? 0) + 1 : 0;
    if (ds.slowN >= 3) { ds.still = true; ds.stillT = f.t; ds.qx = px; ds.qy = py; ds.fastN = 0; ds.midN = 0; ds.midSum = 0; }
  } else {
    ds.fastN = raw >= MOVING_MS ? (ds.fastN ?? 0) + 1 : 0;
    if (raw >= 0.5) { ds.midN = (ds.midN ?? 0) + 1; ds.midSum = (ds.midSum ?? 0) + raw * dt; } else { ds.midN = 0; ds.midSum = 0; }
    const hop = ds.qx != null && ds.qy != null ? Math.hypot(px - ds.qx, py - ds.qy) : 0;
    const movedOut = hop >= Math.max(8, 0.8 * acc);
    if (ds.fastN >= 2 || ds.midN >= 5 || movedOut) {
      ds.still = false; ds.slowN = 0;
      // What moved while "still" counted as 0. Credit the slow-but-moving fixes, or the whole hop from the
      // stop point when it was covered at a walking rate (a 0.5 m/s hiker on a steep trail dips under the
      // threshold all the time); a real stop's wander is slower than that and stays uncredited.
      const sec = ds.stillT != null ? (f.t - ds.stillT) / 1000 : 0;
      retro = Math.max(ds.midSum ?? 0, sec > 0 && hop / sec >= 0.3 && hop >= acc ? hop : 0);
    }
  }
  const still = !!ds.still;
  const speed = still ? 0 : raw;
  const doppler = hasDoppler(kf, f.t);
  let tx = px, ty = py;

  if (doppler && sport !== 'ride') {
    ds.st = undefined; ds.ax = undefined; // leave the chord path idle
    if (ds.ft != null && warm && dt <= MAX_GAP_SEC) add += 0.5 * ((ds.fv ?? speed) + speed) * dt + retro;
  } else {
    let cx = px, cy = py;
    if (!doppler) {
      if (ds.st == null || ds.sx == null || ds.sy == null) { ds.sx = px; ds.sy = py; }
      else {
        const sdt = Math.max(0, (f.t - ds.st) / 1000);
        // time constant ~10 s at 2 m/s and ±8 m, longer when slower or less accurate (standing still it
        // barely moves), shorter when fast so bends are not cut
        const tc = 10 * Math.max(0.5, Math.min(3, acc / 8)) * Math.max(0.25, Math.min(3, 2 / Math.max(raw, 0.5)));
        const a = 1 - Math.exp(-sdt / tc);
        ds.sx += a * (px - ds.sx); ds.sy += a * (py - ds.sy);
      }
      ds.st = f.t; cx = ds.sx; cy = ds.sy;
    } else ds.st = undefined;
    if (warm) {
      if (ds.ax == null || ds.ay == null) { ds.ax = cx; ds.ay = cy; }
      else if (doppler && wasStill && !still) { ds.ax = cx; ds.ay = cy; } // a ride stop: drop the wander, start afresh
      else if (!still) {
        const d = Math.hypot(cx - ds.ax, cy - ds.ay);
        const gate = doppler ? 3 : Math.min(14, Math.max(3, 0.8 * acc));
        if (d >= gate) { add += d; ds.ax = cx; ds.ay = cy; }
      }
    }
    tx = cx; ty = cy;
  }
  ds.fx = px; ds.fy = py; ds.ft = f.t; ds.fv = speed; ds.tx = tx; ds.ty = ty;
  return { add, still, lat: ds.lat0 + ty / M_PER_DEG, lng: ds.lng0 + tx / ds.kx };
}

// ---------- speed from the recorded distance ----------
/** (time, recorded distance) sample for every filtered fix; see creditedSpeed(). */
export type CreditSample = { t: number; d: number };
/**
 * Average speed (m/s) over the last `windowSec` of recorded distance, or null without enough data. Agrees with
 * the headline distance instead of re-measuring stored points (which read 20-40 % too fast without Doppler).
 */
export function creditedSpeed(samples: CreditSample[], windowSec: number): number | null {
  const last = samples[samples.length - 1];
  if (!last) return null;
  let i = samples.length - 1;
  while (i > 0 && last.t - samples[i - 1].t <= windowSec * 1000) i--;
  const span = (last.t - samples[i].t) / 1000;
  if (span < Math.min(10, windowSec / 2)) return null;
  return (last.d - samples[i].d) / span;
}

// ---------- rolling pace ----------
/** Average speed (m/s) over the last `windowSec` seconds of a segment, or null if not enough data. */
export function rollingSpeed(seg: Point[], windowSec = 30): number | null {
  if (seg.length < 2) return null;
  const end = seg[seg.length - 1];
  let d = 0;
  let i = seg.length - 1;
  while (i > 0 && end.t - seg[i - 1].t <= windowSec * 1000) { d += pointGap(seg[i - 1], seg[i]); i--; }
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
      const dd = pointGap(seg[i - 1], seg[i]), dt = (seg[i].t - seg[i - 1].t) / 1000;
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
