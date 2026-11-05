// Workplace-wellness maths: daily log, water target, wellness score, streaks, weekly summary,
// insights and wellness badges. Pure (no React Native imports) so it is unit-tested with plain Node.
//
// Targets follow public guidance, kept deliberately simple:
//  • WHO: at least 150 minutes of moderate activity a week (≈ 30 min on 5 days).
//  • Break up long sitting: a short movement break every 30–60 min; we aim for 4 logged breaks a day.
//  • Water: about 35 ml per kg of body weight, plus ~500 ml per hour of exercise.
//  • Sleep: adults need 7–9 hours.
// This is wellbeing guidance, not medical advice.
import type { Achievement } from './achievements';
import type { Activity } from './types';

export type CheckIn = {
  mood: number; // 1 (low) … 5 (great)
  energy: number; // 1 … 5
  sleepH: number; // hours slept last night
  stress: number; // 1 low, 2 medium, 3 high
  at: number;
};
export type DayLog = { waterMl: number; breaks: number; eyeBreaks: number; mindfulMin: number; checkin?: CheckIn };
/** Keyed by local date, "YYYY-MM-DD". */
export type WellnessLog = Record<string, DayLog>;

export const GLASS_ML = 250;
export const WHO_WEEKLY_MIN = 150;
export const DAILY_ACTIVE_MIN = 30;
export const DAILY_BREAKS = 4;
export const DAILY_MINDFUL_MIN = 1;
export const GOOD_DAY_SCORE = 50;

export const emptyDay = (): DayLog => ({ waterMl: 0, breaks: 0, eyeBreaks: 0, mindfulMin: 0 });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pad = (n: number) => String(n).padStart(2, '0');

// ---------- dates (local time) ----------
export function dayKey(t: number | Date = Date.now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(key: string, n: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
/** Monday of the week containing `key`. */
export function mondayKey(key: string): string {
  const d = keyToDate(key);
  return addDays(key, -((d.getDay() + 6) % 7));
}

// ---------- targets ----------
/** Daily water target in ml, rounded to whole glasses. */
export function waterGoalMl(weightKg: number, activeMin = 0): number {
  const base = (weightKg > 0 ? weightKg : 70) * 35;
  const exercise = (Math.max(0, activeMin) / 60) * 500;
  return Math.round(clamp(base + exercise, 1500, 4500) / GLASS_ML) * GLASS_ML;
}

/** Moving minutes of activities, per local day they started on. */
export function minutesByDay(acts: Activity[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of acts) {
    const k = dayKey(a.startedAt);
    out[k] = (out[k] ?? 0) + a.movingSec / 60;
  }
  return out;
}

// ---------- daily score ----------
export type ScorePartKey = 'move' | 'water' | 'breaks' | 'mind' | 'checkin';
export type ScorePart = { key: ScorePartKey; points: number; max: number };

/** 0–100: move 35, water 25, breaks 20, mind 10, check-in 10. */
export function dailyScore(day: DayLog | undefined, activeMin: number, waterGoal: number): { total: number; parts: ScorePart[] } {
  const d = day ?? emptyDay();
  const part = (key: ScorePartKey, max: number, ratio: number): ScorePart =>
    ({ key, max, points: Math.round(max * clamp(Number.isFinite(ratio) ? ratio : 0, 0, 1)) });
  const parts = [
    part('move', 35, activeMin / DAILY_ACTIVE_MIN),
    part('water', 25, d.waterMl / Math.max(1, waterGoal)),
    part('breaks', 20, (d.breaks + d.eyeBreaks) / DAILY_BREAKS),
    part('mind', 10, d.mindfulMin / DAILY_MINDFUL_MIN),
    part('checkin', 10, d.checkin ? 1 : 0),
  ];
  return { total: parts.reduce((s, p) => s + p.points, 0), parts };
}

/** Score of any day, using that day's activity minutes for both the move part and the water target. */
export function scoreOn(key: string, log: WellnessLog, minutes: Record<string, number>, weightKg: number): number {
  const m = minutes[key] ?? 0;
  return dailyScore(log[key], m, waterGoalMl(weightKg, m)).total;
}

/** Consecutive good days (score ≥ 50) ending today; today still counts as "in progress" if not reached yet. */
export function scoreStreak(log: WellnessLog, minutes: Record<string, number>, weightKg: number, today = dayKey()): number {
  let k = scoreOn(today, log, minutes, weightKg) >= GOOD_DAY_SCORE ? today : addDays(today, -1);
  let n = 0;
  while (n < 400 && scoreOn(k, log, minutes, weightKg) >= GOOD_DAY_SCORE) { n++; k = addDays(k, -1); }
  return n;
}

// ---------- week ----------
export type WeekSummary = {
  start: string; days: string[]; scores: number[];
  activeMin: number; km: number; activities: number;
  waterDays: number; breaks: number; mindfulMin: number;
  avgSleep: number | null; avgMood: number | null; checkins: number; avgScore: number;
};

/** Monday → `today` of the current week. */
export function weekSummary(log: WellnessLog, acts: Activity[], weightKg: number, today = dayKey()): WeekSummary {
  const start = mondayKey(today);
  const days: string[] = [];
  for (let k = start; k <= today && days.length < 7; k = addDays(k, 1)) days.push(k);
  const set = new Set(days);
  const weekActs = acts.filter((a) => set.has(dayKey(a.startedAt)));
  const minutes = minutesByDay(weekActs);
  const logs = days.map((k) => log[k]).filter((d): d is DayLog => !!d);
  const checks = logs.map((d) => d.checkin).filter((c): c is CheckIn => !!c);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const scores = days.map((k) => scoreOn(k, log, minutes, weightKg));
  return {
    start, days, scores,
    activeMin: Math.round(weekActs.reduce((s, a) => s + a.movingSec / 60, 0)),
    km: weekActs.reduce((s, a) => s + a.distanceM, 0) / 1000,
    activities: weekActs.length,
    waterDays: days.filter((k) => (log[k]?.waterMl ?? 0) >= waterGoalMl(weightKg, minutes[k] ?? 0)).length,
    breaks: logs.reduce((s, d) => s + d.breaks + d.eyeBreaks, 0),
    mindfulMin: logs.reduce((s, d) => s + d.mindfulMin, 0),
    avgSleep: avg(checks.map((c) => c.sleepH)),
    avgMood: avg(checks.map((c) => c.mood)),
    checkins: checks.length,
    avgScore: Math.round(avg(scores) ?? 0),
  };
}

// ---------- insights ----------
export type InsightKey =
  | 'ins.sleepLow' | 'ins.stressHigh' | 'ins.waterLow' | 'ins.moveMood' | 'ins.whoDone' | 'ins.whoLeft' | 'ins.noBreak';
export type Insight = { key: InsightKey; tone: 'warn' | 'good' | 'info'; vars: Record<string, string | number>; action?: 'breathe' | 'stretch' | 'water' };

/** Up to three personal, evidence-based nudges, most important first. */
export function insights(log: WellnessLog, acts: Activity[], weightKg: number, now = Date.now()): Insight[] {
  const today = dayKey(now);
  const last = (n: number) => Array.from({ length: n }, (_, i) => addDays(today, -i));
  const minutes = minutesByDay(acts);
  const out: Insight[] = [];

  const week = last(7).map((k) => log[k]?.checkin).filter((c): c is CheckIn => !!c);
  const short = week.filter((c) => c.sleepH < 7).length;
  if (short >= 3) out.push({ key: 'ins.sleepLow', tone: 'warn', vars: { n: short, of: week.length } });
  const stressed = week.filter((c) => c.stress >= 3).length;
  if (stressed >= 3) out.push({ key: 'ins.stressHigh', tone: 'warn', vars: { n: stressed }, action: 'breathe' });

  const recent = last(3).slice(1); // yesterday and the day before: today isn't over
  const loggedWater = last(7).some((k) => (log[k]?.waterMl ?? 0) > 0);
  if (loggedWater && recent.every((k) => (log[k]?.waterMl ?? 0) < 0.6 * waterGoalMl(weightKg, minutes[k] ?? 0))) {
    out.push({ key: 'ins.waterLow', tone: 'warn', vars: {}, action: 'water' });
  }

  // does moving lift this person's mood? compare check-ins on active vs. quiet days (last 30 days)
  const active: number[] = [], quiet: number[] = [];
  for (const k of last(30)) {
    const c = log[k]?.checkin;
    if (c) ((minutes[k] ?? 0) >= 20 ? active : quiet).push(c.mood);
  }
  if (active.length >= 3 && quiet.length >= 3) {
    const diff = active.reduce((s, x) => s + x, 0) / active.length - quiet.reduce((s, x) => s + x, 0) / quiet.length;
    if (diff >= 0.5) out.push({ key: 'ins.moveMood', tone: 'good', vars: { d: diff.toFixed(1) } });
  }

  const ws = mondayKey(today);
  let weekMin = 0;
  for (let k = ws; k <= today; k = addDays(k, 1)) weekMin += minutes[k] ?? 0;
  weekMin = Math.round(weekMin);
  if (weekMin >= WHO_WEEKLY_MIN) out.push({ key: 'ins.whoDone', tone: 'good', vars: { n: weekMin } });
  else {
    const daysLeft = 7 - ((keyToDate(today).getDay() + 6) % 7); // including today
    const left = WHO_WEEKLY_MIN - weekMin;
    out.push({ key: 'ins.whoLeft', tone: 'info', vars: { n: left, m: Math.ceil(left / daysLeft) } });
  }

  const d = new Date(now), h = d.getHours(), wd = d.getDay();
  const t = log[today];
  if (wd >= 1 && wd <= 5 && h >= 11 && h < 18 && !((t?.breaks ?? 0) + (t?.eyeBreaks ?? 0))) {
    out.push({ key: 'ins.noBreak', tone: 'info', vars: {}, action: 'stretch' });
  }

  const rank = { warn: 0, good: 1, info: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 3);
}

/** Fill "{n}"-style placeholders. */
export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

// ---------- check-in streak ----------
export function checkinStreak(log: WellnessLog, today = dayKey()): number {
  let k = log[today]?.checkin ? today : addDays(today, -1);
  let n = 0;
  while (n < 400 && log[k]?.checkin) { n++; k = addDays(k, -1); }
  return n;
}

// ---------- badges ----------
type Rule = { id: string; title: string; detail: string; icon: string; target: number; value: number };
export function wellnessBadges(log: WellnessLog, acts: Activity[], weightKg: number, today = dayKey()): Achievement[] {
  const minutes = minutesByDay(acts);
  const keys = Object.keys(log);
  const sum = (f: (d: DayLog) => number) => keys.reduce((s, k) => s + f(log[k]), 0);
  const waterHit = keys.filter((k) => log[k].waterMl >= waterGoalMl(weightKg, minutes[k] ?? 0)).length;
  const bestScore = Math.max(0, ...keys.map((k) => scoreOn(k, log, minutes, weightKg)));
  // best calendar week of activity minutes
  const weekMin: Record<string, number> = {};
  for (const [k, m] of Object.entries(minutes)) weekMin[mondayKey(k)] = (weekMin[mondayKey(k)] ?? 0) + m;
  const bestWeek = Math.max(0, ...Object.values(weekMin));
  // longest run of consecutive check-ins / good days ever
  const longest = (ok: (k: string) => boolean) => {
    let best = 0;
    for (const k of keys) {
      if (!ok(k) || ok(addDays(k, -1))) continue; // only start counting at the beginning of a run
      let n = 0, j = k;
      while (ok(j) && n < 1000) { n++; j = addDays(j, 1); }
      best = Math.max(best, n);
    }
    return best;
  };
  const rules: Rule[] = [
    { id: 'w-hydrated', title: 'Hydration hero', detail: 'Hit your water goal on 5 days', icon: 'cup-water', target: 5, value: waterHit },
    { id: 'w-desk', title: 'Desk hero', detail: 'Take 25 stretch or eye breaks', icon: 'human-handsup', target: 25, value: sum((d) => d.breaks + d.eyeBreaks) },
    { id: 'w-calm', title: 'Calm mind', detail: '30 minutes of guided breathing', icon: 'meditation', target: 30, value: sum((d) => d.mindfulMin) },
    { id: 'w-checkin', title: 'Self-aware', detail: 'Check in 7 days in a row', icon: 'emoticon-happy-outline', target: 7, value: longest((k) => !!log[k]?.checkin) },
    { id: 'w-who', title: 'WHO week', detail: '150 active minutes in one week', icon: 'heart-pulse', target: WHO_WEEKLY_MIN, value: bestWeek },
    { id: 'w-score', title: 'Feel-good day', detail: 'Reach a wellness score of 80', icon: 'star-face', target: 80, value: bestScore },
    { id: 'w-streak', title: 'Healthy habit', detail: '7 good wellness days in a row', icon: 'fire', target: 7,
      value: Math.max(scoreStreak(log, minutes, weightKg, today), longest((k) => scoreOn(k, log, minutes, weightKg) >= GOOD_DAY_SCORE)) },
  ];
  return rules.map((r) => ({
    id: r.id, title: r.title, detail: r.detail, icon: r.icon,
    earned: r.value >= r.target, progress: clamp(r.value / r.target, 0, 1),
  }));
}

// ---------- merging (backup restore) ----------
/** A check-in from a file is only kept if every field is in range (a bad file must not break the app). */
function validCheckin(c: unknown): CheckIn | undefined {
  if (!c || typeof c !== 'object') return undefined;
  const x = c as Record<string, unknown>;
  const int = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
  const ok = int(x.mood, 1, 5) && int(x.energy, 1, 5) && int(x.stress, 1, 3)
    && typeof x.sleepH === 'number' && x.sleepH >= 0 && x.sleepH <= 24;
  return ok ? { mood: x.mood as number, energy: x.energy as number, stress: x.stress as number, sleepH: x.sleepH as number,
    at: typeof x.at === 'number' ? x.at : 0 } : undefined;
}

/** Merge two logs without losing anything: counts take the larger value, an existing check-in wins. */
export function mergeLogs(local: WellnessLog, incoming: WellnessLog): WellnessLog {
  const out: WellnessLog = { ...local };
  for (const [k, d] of Object.entries(incoming ?? {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !d || typeof d !== 'object') continue;
    const l = out[k] ?? emptyDay();
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, 100_000) : 0);
    const checkin = l.checkin ?? validCheckin(d.checkin);
    out[k] = {
      waterMl: Math.max(l.waterMl, num(d.waterMl)),
      breaks: Math.max(l.breaks, num(d.breaks)),
      eyeBreaks: Math.max(l.eyeBreaks, num(d.eyeBreaks)),
      mindfulMin: Math.max(l.mindfulMin, num(d.mindfulMin)),
      ...(checkin ? { checkin } : {}),
    };
  }
  return out;
}
