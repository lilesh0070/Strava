// Live-tracking maths: GPS smoothing, rolling pace, laps and pace coaching. Pure → unit-tested.
import { haversine, type Point } from './geo';

// ---------- Kalman filter ----------
// A constant-position Kalman filter on lat/lng. Each fix's reported accuracy is used as the
// measurement noise; process noise grows with time × expected speed. Removes the zig-zag that raw
// phone GPS adds, which otherwise inflates distance by 3-8%.
export type KalmanState = { lat: number; lng: number; variance: number; t: number };

export function kalmanStep(state: KalmanState | null | undefined, p: Point, speedMs: number): KalmanState {
  const acc = Math.max(p.acc ?? 10, 3);
  if (!state || p.t - state.t > 60_000) return { lat: p.lat, lng: p.lng, variance: acc * acc, t: p.t };
  const dt = Math.max(0, (p.t - state.t) / 1000);
  const variance = state.variance + dt * speedMs * speedMs;
  const k = variance / (variance + acc * acc);
  return {
    lat: state.lat + k * (p.lat - state.lat),
    lng: state.lng + k * (p.lng - state.lng),
    variance: (1 - k) * variance,
    t: p.t,
  };
}

export const expectedSpeed = (sport: string) => (sport === 'ride' ? 8 : sport === 'run' ? 4 : 2);

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
