// "My week" recap: the numbers behind the shareable week card (pure, unit-tested).
import { mondayOf, weekStreak } from './coach';
import { activitySteps } from './steps';
import type { Activity } from './types';

const DAY = 86_400_000;

export type WeekRecap = {
  start: number; // Monday 00:00 local
  end: number; // the following Monday 00:00
  dayKm: number[]; // Mon..Sun
  km: number;
  count: number;
  sec: number;
  /** Best average pace (s/km) of a run of at least 1 km this week, or null. */
  bestPaceSec: number | null;
  steps: number;
  prevKm: number; // the whole previous week
  changePct: number | null;
  streak: number; // consecutive active weeks ending with this one
  /** Ids of the activities in the week (for PR / badge lookups). */
  ids: string[];
};

export function weekRecap(acts: Activity[], weekStart: number): WeekRecap {
  const start = mondayOf(weekStart), end = mondayOf(start + 7 * DAY + DAY / 2);
  const inWeek = acts.filter((a) => a.startedAt >= start && a.startedAt < end);
  const prev = acts.filter((a) => a.startedAt >= start - 7 * DAY && a.startedAt < start);
  const dayKm = Array(7).fill(0) as number[];
  for (const a of inWeek) dayKm[Math.min(6, Math.max(0, Math.floor((a.startedAt - start) / DAY)))] += a.distanceM / 1000;
  const km = inWeek.reduce((s, a) => s + a.distanceM, 0) / 1000;
  const prevKm = prev.reduce((s, a) => s + a.distanceM, 0) / 1000;
  const paces = inWeek.filter((a) => a.sport === 'run' && a.distanceM >= 1000 && a.movingSec > 0).map((a) => a.movingSec / (a.distanceM / 1000));
  return {
    start, end, dayKm, km, count: inWeek.length, sec: inWeek.reduce((s, a) => s + a.movingSec, 0),
    bestPaceSec: paces.length ? Math.min(...paces) : null,
    steps: inWeek.reduce((s, a) => s + (activitySteps(a)?.steps ?? 0), 0),
    prevKm, changePct: prevKm > 0 ? Math.round(((km - prevKm) / prevKm) * 100) : null,
    streak: inWeek.length ? weekStreak(acts.filter((a) => a.startedAt < end).map((a) => a.startedAt), start + 3 * DAY) : 0,
    ids: inWeek.map((a) => a.id),
  };
}

/** Whether a recap's week is the one running now (friends ranks only exist for it). */
export const isCurrentWeek = (weekStart: number, now = Date.now()) => mondayOf(weekStart) === mondayOf(now);

/**
 * Which week to recap by default: early in the week (Mon/Tue), or when nothing has been recorded yet this
 * week, the previous full week (the Monday "kitna bhaga?" message is about last week).
 */
export function defaultRecapWeek(acts: Activity[], now = Date.now()): number {
  const thisWeek = mondayOf(now);
  const dow = (new Date(now).getDay() + 6) % 7; // Mon = 0
  const hasThisWeek = acts.some((a) => a.startedAt >= thisWeek && a.startedAt <= now);
  return dow <= 1 || !hasThisWeek ? thisWeek - 7 * DAY : thisWeek;
}
