// Badges computed from activity history (nothing stored, so they can never get out of sync).
import { longestWeekStreak } from './coach';
import { badgeDetailKey, badgeKey, translate } from './strings';
import type { Activity } from './types';

export type Achievement = {
  id: string;
  /** English title/detail (strings.ts `badge.<id>` / `badge.<id>.d`); screens translate with badgeTitle(t, id) / badgeDetail(t, id). */
  title: string;
  detail: string;
  icon: string;
  earned: boolean;
  progress: number; // 0..1
  earnedAt?: number;
};

/** The title and detail live in strings.ts under `badge.<id>` and `badge.<id>.d`, so the ids are part of the dictionary. */
type Rule = { id: string; icon: string; target: number; measure: (acts: Activity[]) => { value: number; at?: number } };

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
  { id: 'first', icon: 'shoe-print', target: 1, // record your first activity
    measure: (a) => ({ value: a.length, at: a.length ? Math.min(...a.map((x) => x.startedAt)) : undefined }) },
  { id: '5k', icon: 'numeric-5-circle-outline', target: 5, measure: (a) => longestBy(runs(a), 5) }, // run 5 km in one go
  { id: '10k', icon: 'medal-outline', target: 10, measure: (a) => longestBy(runs(a), 10) }, // run 10 km in one go
  { id: 'half', icon: 'trophy-outline', target: 21.0975, measure: (a) => longestBy(runs(a), 21.0975) }, // half marathon
  { id: 'century', icon: 'bike-fast', target: 100, // ride 100 km in one go
    measure: (a) => longestBy(a.filter((x) => x.sport === 'ride'), 100) },
  { id: 'early', icon: 'weather-sunset-up', target: 1, // start before 6 am
    measure: (a) => { const e = a.filter((x) => new Date(x.startedAt).getHours() < 6); return { value: e.length, at: firstAt(e) }; } },
  { id: 'climber', icon: 'image-filter-hdr', target: 500, // 500 m of climbing in one activity
    measure: (a) => ({ value: Math.max(0, ...a.map((x) => x.elevGainM)), at: firstAt(a.filter((x) => x.elevGainM >= 500)) }) },
  { id: 'streak4', icon: 'fire', target: 4, // active 4 weeks in a row
    // the longest streak ever, so a later break never takes the badge away again
    measure: (a) => { const s = longestWeekStreak(a.map((x) => x.startedAt), 4); return { value: s.best, at: s.reachedAt }; } },
  { id: '100km', icon: 'map-marker-distance', target: 100, measure: (a) => totalKm(a, 100) }, // 100 km in total
  { id: '500km', icon: 'earth', target: 500, measure: (a) => totalKm(a, 500) }, // 500 km in total
  { id: 'ten', icon: 'calendar-check-outline', target: 10, // 10 activities
    measure: (a) => ({ value: a.length, at: [...a].sort((x, y) => x.startedAt - y.startedAt)[9]?.startedAt }) },
];

export function evaluateAchievements(acts: Activity[]): Achievement[] {
  return RULES.map((r) => {
    const { value, at } = r.measure(acts);
    const earned = value >= r.target;
    return { id: r.id, title: translate('en', badgeKey(r.id)), detail: translate('en', badgeDetailKey(r.id)), icon: r.icon,
      earned, progress: Math.min(1, value / r.target), earnedAt: earned ? at : undefined };
  });
}

/** Badges newly earned by adding `latest` to `before`. */
export function newlyEarned(before: Activity[], latest: Activity): Achievement[] {
  const had = new Set(evaluateAchievements(before).filter((x) => x.earned).map((x) => x.id));
  return evaluateAchievements([...before, latest]).filter((x) => x.earned && !had.has(x.id));
}
