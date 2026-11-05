// Badges computed from activity history (nothing stored, so they can never get out of sync).
import { longestWeekStreak } from './coach';
import type { Activity } from './types';

export type Achievement = {
  id: string;
  title: string;
  detail: string;
  icon: string;
  earned: boolean;
  progress: number; // 0..1
  earnedAt?: number;
};

type Rule = { id: string; title: string; detail: string; icon: string; target: number; measure: (acts: Activity[]) => { value: number; at?: number } };

const runs = (a: Activity[]) => a.filter((x) => x.sport === 'run');
/** When the earliest of these activities started (lists arrive newest first). */
const firstAt = (a: Activity[]) => (a.length ? Math.min(...a.map((x) => x.startedAt)) : undefined);
const longestBy = (acts: Activity[], km: number) => {
  const hit = [...acts].sort((x, y) => x.startedAt - y.startedAt).find((x) => x.distanceM >= km * 1000);
  return { value: Math.max(0, ...acts.map((x) => x.distanceM / 1000)), at: hit?.startedAt };
};
const totalKm = (acts: Activity[], target: number) => {
  let sum = 0, at: number | undefined;
  for (const a of [...acts].sort((x, y) => x.startedAt - y.startedAt)) {
    sum += a.distanceM / 1000;
    if (at == null && sum >= target) at = a.startedAt;
  }
  return { value: sum, at };
};

const RULES: Rule[] = [
  { id: 'first', title: 'First steps', detail: 'Record your first activity', icon: 'shoe-print', target: 1,
    measure: (a) => ({ value: a.length, at: a.length ? Math.min(...a.map((x) => x.startedAt)) : undefined }) },
  { id: '5k', title: '5K finisher', detail: 'Run 5 km in one go', icon: 'numeric-5-circle-outline', target: 5, measure: (a) => longestBy(runs(a), 5) },
  { id: '10k', title: '10K club', detail: 'Run 10 km in one go', icon: 'medal-outline', target: 10, measure: (a) => longestBy(runs(a), 10) },
  { id: 'half', title: 'Half marathon', detail: 'Run 21.1 km in one go', icon: 'trophy-outline', target: 21.0975, measure: (a) => longestBy(runs(a), 21.0975) },
  { id: 'century', title: 'Century ride', detail: 'Ride 100 km in one go', icon: 'bike-fast', target: 100,
    measure: (a) => longestBy(a.filter((x) => x.sport === 'ride'), 100) },
  { id: 'early', title: 'Early bird', detail: 'Start an activity before 6 am', icon: 'weather-sunset-up', target: 1,
    measure: (a) => { const e = a.filter((x) => new Date(x.startedAt).getHours() < 6); return { value: e.length, at: firstAt(e) }; } },
  { id: 'climber', title: 'Climber', detail: '500 m of climbing in one activity', icon: 'image-filter-hdr', target: 500,
    measure: (a) => ({ value: Math.max(0, ...a.map((x) => x.elevGainM)), at: firstAt(a.filter((x) => x.elevGainM >= 500)) }) },
  { id: 'streak4', title: 'On a roll', detail: 'Be active 4 weeks in a row', icon: 'fire', target: 4,
    // the longest streak ever, so a later break never takes the badge away again
    measure: (a) => { const s = longestWeekStreak(a.map((x) => x.startedAt), 4); return { value: s.best, at: s.reachedAt }; } },
  { id: '100km', title: '100 km total', detail: 'Cover 100 km across all activities', icon: 'map-marker-distance', target: 100, measure: (a) => totalKm(a, 100) },
  { id: '500km', title: '500 km total', detail: 'Cover 500 km across all activities', icon: 'earth', target: 500, measure: (a) => totalKm(a, 500) },
  { id: 'ten', title: 'Regular', detail: 'Log 10 activities', icon: 'calendar-check-outline', target: 10,
    measure: (a) => ({ value: a.length, at: [...a].sort((x, y) => x.startedAt - y.startedAt)[9]?.startedAt }) },
];

export function evaluateAchievements(acts: Activity[]): Achievement[] {
  return RULES.map((r) => {
    const { value, at } = r.measure(acts);
    const earned = value >= r.target;
    return { id: r.id, title: r.title, detail: r.detail, icon: r.icon, earned, progress: Math.min(1, value / r.target), earnedAt: earned ? at : undefined };
  });
}

/** Badges newly earned by adding `latest` to `before`. */
export function newlyEarned(before: Activity[], latest: Activity): Achievement[] {
  const had = new Set(evaluateAchievements(before).filter((x) => x.earned).map((x) => x.id));
  return evaluateAchievements([...before, latest]).filter((x) => x.earned && !had.has(x.id));
}
