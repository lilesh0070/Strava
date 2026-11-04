// Personal records and week-over-week insights (pure, unit-tested).
import { bestEffort } from './geo';
import type { Activity } from './types';

export type RecordKind = 'effort' | 'longest' | 'climb';
export type PersonalRecord = { key: string; label: string; kind: RecordKind; value: number; activityId: string };

const EFFORTS = [
  { key: 'run-1k', label: 'Fastest 1 km', m: 1000 },
  { key: 'run-5k', label: 'Fastest 5 km', m: 5000 },
  { key: 'run-10k', label: 'Fastest 10 km', m: 10000 },
  { key: 'run-half', label: 'Fastest half marathon', m: 21097.5 },
];

/** Best value per record across activities (efforts: lowest seconds; others: highest). */
export function personalRecords(acts: Activity[]): Map<string, PersonalRecord> {
  const out = new Map<string, PersonalRecord>();
  const consider = (r: PersonalRecord, lowerIsBetter: boolean) => {
    const cur = out.get(r.key);
    if (!cur || (lowerIsBetter ? r.value < cur.value : r.value > cur.value)) out.set(r.key, r);
  };
  for (const a of acts) {
    if (a.sport === 'run' && !a.manual) {
      for (const e of EFFORTS) {
        const t = a.efforts ? a.efforts[e.m] ?? null : bestEffort(a.segments, e.m);
        if (t != null) consider({ key: e.key, label: e.label, kind: 'effort', value: t, activityId: a.id }, true);
      }
    }
    if (a.distanceM > 0) consider({ key: `longest-${a.sport}`, label: `Longest ${a.sport}`, kind: 'longest', value: a.distanceM, activityId: a.id }, false);
    if (a.elevGainM > 0) consider({ key: 'climb', label: 'Biggest climb', kind: 'climb', value: a.elevGainM, activityId: a.id }, false);
  }
  return out;
}

/** Records that `latest` set (or improved) compared with `before`. First-ever values don't count as PRs. */
export function newRecords(before: Activity[], latest: Activity): PersonalRecord[] {
  const old = personalRecords(before);
  const now = personalRecords([...before, latest]);
  return [...now.values()].filter((r) => r.activityId === latest.id && old.has(r.key));
}

// ---------- insights ----------
function monday(t: number) {
  const x = new Date(t); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}

export type WeekCompare = { thisKm: number; lastKm: number; thisCount: number; lastCount: number; thisSec: number; lastSec: number; changePct: number | null };

/** This week so far vs the same number of days last week (a fair comparison mid-week). */
export function compareWeeks(acts: Activity[], now = Date.now()): WeekCompare {
  const start = monday(now);
  const elapsed = now - start;
  const lastStart = monday(start - 86400000);
  const inRange = (a: Activity, from: number, to: number) => a.startedAt >= from && a.startedAt < to;
  const thisW = acts.filter((a) => inRange(a, start, now + 1));
  const lastW = acts.filter((a) => inRange(a, lastStart, lastStart + elapsed + 1));
  const km = (xs: Activity[]) => xs.reduce((s, a) => s + a.distanceM, 0) / 1000;
  const sec = (xs: Activity[]) => xs.reduce((s, a) => s + a.movingSec, 0);
  const thisKm = km(thisW), lastKm = km(lastW);
  return {
    thisKm, lastKm, thisCount: thisW.length, lastCount: lastW.length, thisSec: sec(thisW), lastSec: sec(lastW),
    changePct: lastKm > 0 ? Math.round(((thisKm - lastKm) / lastKm) * 100) : null,
  };
}

/** Total km in the calendar month containing `now`. */
export function monthKm(acts: Activity[], now = Date.now()): number {
  const d = new Date(now);
  return acts.filter((a) => { const x = new Date(a.startedAt); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth(); })
    .reduce((s, a) => s + a.distanceM, 0) / 1000;
}
