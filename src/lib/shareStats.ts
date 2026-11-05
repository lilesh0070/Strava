// Numbers shown on the share sticker / story. Pure so it is unit-tested.
import { estimateCalories } from './calories';
import { fmtDuration, fmtKm, fmtPace, fmtSpeed } from './geo';
import { activitySteps, fmtSteps } from './steps';
import { sportInfo, type Activity } from './types';

export type ShareStatKey = 'distance' | 'time' | 'pace' | 'speed' | 'steps' | 'elevation' | 'calories';

/** Stats that make sense for this activity (no pace for rides, no climb on a flat route). */
export function availableStats(a: Activity): ShareStatKey[] {
  const out: ShareStatKey[] = ['distance', 'time'];
  if (sportInfo(a.sport).usesPace) out.push('pace');
  out.push('speed');
  if (activitySteps(a)) out.push('steps');
  if (a.elevGainM > 0) out.push('elevation');
  out.push('calories');
  return out;
}

/** What a sticker shows by default: distance, time, average pace and steps (on foot), average speed. */
export function defaultStats(a: Activity): ShareStatKey[] {
  return availableStats(a).filter((k) => k === 'distance' || k === 'time' || k === 'pace' || k === 'speed' || k === 'steps');
}

export function statValue(a: Activity, key: ShareStatKey, weightKg = 70): { value: string; unit: string } {
  switch (key) {
    case 'distance': return { value: fmtKm(a.distanceM), unit: 'km' };
    case 'time': return { value: fmtDuration(a.movingSec), unit: '' };
    case 'pace': return { value: fmtPace(a.distanceM, a.movingSec), unit: '/km' };
    case 'speed': return { value: fmtSpeed(a.distanceM, a.movingSec), unit: 'km/h' };
    case 'steps': { const s = activitySteps(a); return { value: s ? `${s.estimated ? '≈' : ''}${fmtSteps(s.steps)}` : '–', unit: '' }; }
    case 'elevation': return { value: String(Math.round(a.elevGainM)), unit: 'm' };
    case 'calories': return { value: String(estimateCalories(a.sport, a.distanceM, a.movingSec, weightKg)), unit: 'kcal' };
  }
}

/** Rows for the stats grid: 1–3 stats in one row, 4 as 2 × 2, 5–6 as rows of 3. */
export function statRows<T>(items: T[]): T[][] {
  const per = items.length <= 3 ? Math.max(1, items.length) : items.length === 4 ? 2 : 3;
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += per) rows.push(items.slice(i, i + per));
  return rows;
}
