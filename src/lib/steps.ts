// Steps for on-foot activities. Measured by the phone's step-counter sensor while recording (a
// hardware counter, so it costs almost no battery); for older activities, or when the phone has no
// sensor or the permission was declined, estimated from distance and speed and shown with "≈".
// Pure so it is unit-tested.
import type { Activity, Sport } from './types';

export const isOnFoot = (s: Sport) => s !== 'ride';

/** Typical step length (m): walking ≈ 0.72, hiking ≈ 0.65, running grows with speed (≈ 1.05 m at 3 m/s). */
export function stepLength(sport: Sport, speedMs: number): number {
  if (sport === 'run') return Math.min(1.5, Math.max(0.85, 0.6 + 0.15 * speedMs));
  return sport === 'hike' ? 0.65 : 0.72;
}

export function estimateSteps(a: Pick<Activity, 'sport' | 'distanceM' | 'movingSec'>): number | null {
  if (!isOnFoot(a.sport) || a.distanceM <= 0 || a.movingSec <= 0) return null;
  return Math.round(a.distanceM / stepLength(a.sport, a.distanceM / a.movingSec));
}

/** Measured steps when the activity has them, otherwise an estimate. */
export function activitySteps(a: Activity): { steps: number; estimated: boolean } | null {
  if (!isOnFoot(a.sport)) return null;
  if (typeof a.steps === 'number' && a.steps > 0) return { steps: a.steps, estimated: false };
  const e = estimateSteps(a);
  return e ? { steps: e, estimated: true } : null;
}

/** Average cadence in steps per minute of moving time. */
export function cadence(a: Activity): number | null {
  const s = activitySteps(a);
  return s && a.movingSec >= 60 ? Math.round(s.steps / (a.movingSec / 60)) : null;
}

export const fmtSteps = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * The sensor reports a running total since we subscribed (it restarts at 0 after a re-subscribe, e.g.
 * when the app is restarted mid-run). Returns the steps to add for this reading.
 */
export function stepDelta(prevTotal: number | null, total: number): number {
  if (!Number.isFinite(total)) return 0;
  return Math.max(0, total - (prevTotal ?? 0));
}
