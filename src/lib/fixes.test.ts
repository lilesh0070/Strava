// Regression tests for the audit fixes (streaks, badges, DST week keys, workout clock, lap cue).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateAchievements, newlyEarned } from './achievements.ts';
import { longestWeekStreak, mondayOf, weekStreak } from './coach.ts';
import { compareWeeks } from './records.ts';
import { voicePhrases } from './strings.ts';
import { sessionMovingSec, workoutSec, type Activity, type Session } from './types.ts';

const DAY = 86400000;
const act = (startedAt: number, o: Partial<Activity> = {}): Activity => ({
  id: `a${startedAt}`, name: 'x', sport: 'run', startedAt, movingSec: 1800, elapsedSec: 1800,
  distanceM: 5000, elevGainM: 0, segments: [], ...o,
});
const badge = (acts: Activity[], id: string) => evaluateAchievements(acts).find((b) => b.id === id)!;

test('week keys stay stable across a DST change at midnight', () => {
  const tz = process.env.TZ;
  process.env.TZ = 'America/Santiago'; // clocks jump 00:00 → 01:00 on Sunday 6 Sep 2026
  try {
    const sunday = new Date(2026, 8, 6, 10).getTime();
    const monday = new Date(2026, 8, 1, 10).getTime(); // same week
    assert.equal(mondayOf(sunday), mondayOf(monday));
    // active on that Sunday and the Sunday before, checked the next Wednesday → a 2-week streak
    const wed = new Date(2026, 8, 9, 12).getTime();
    assert.equal(weekStreak([sunday, new Date(2026, 7, 30, 10).getTime()], wed), 2);
  } finally {
    if (tz == null) delete process.env.TZ; else process.env.TZ = tz;
  }
});

test('longest week streak and when it reached the target', () => {
  const base = new Date(2026, 0, 5, 9).getTime(); // a Monday
  const times = [0, 7, 14, 21].map((d) => base + d * DAY);
  assert.deepEqual(longestWeekStreak(times, 4), { best: 4, reachedAt: times[3] });
  assert.equal(longestWeekStreak([base, base + 2 * DAY, base + 14 * DAY]).best, 1); // same week twice, then a gap
  assert.equal(longestWeekStreak([]).best, 0);
});

test('"On a roll" stays earned after a break, and is not "new" again', () => {
  const base = new Date(2026, 0, 5, 9).getTime();
  const streak = [0, 7, 14, 21].map((d) => act(base + d * DAY));
  const later = act(base + 120 * DAY); // months later, after a long break
  const b = badge([...streak, later], 'streak4');
  assert.ok(b.earned);
  assert.equal(b.earnedAt, base + 21 * DAY);
  assert.ok(!newlyEarned([...streak], later).some((x) => x.id === 'streak4'));
});

test('badge dates use the earliest qualifying activity, even from a newest-first list', () => {
  const jan = new Date(2026, 0, 3, 5).getTime(), oct = new Date(2026, 9, 20, 5).getTime();
  const list = [act(oct, { elevGainM: 600 }), act(jan, { elevGainM: 700 })]; // newest first, like listActivities()
  assert.equal(badge(list, 'early').earnedAt, jan);
  assert.equal(badge(list, 'climber').earnedAt, jan);
});

test('week comparison still works with the shared week start', () => {
  const now = new Date(2026, 2, 11, 12).getTime(); // a Wednesday
  const r = compareWeeks([act(now - DAY), act(now - 7 * DAY)], now);
  assert.equal(r.thisCount, 1);
  assert.equal(r.lastCount, 1);
});

test('workout clock counts auto-paused time but not manual pauses', () => {
  const t0 = 1_000_000;
  const s: Session = { sport: 'run', startedAt: t0, status: 'recording', pausedMs: 0, pauseStartedAt: null, segments: [[]] };
  // standing rest: auto-paused 60 s after 100 s of running
  s.status = 'paused'; s.autoPaused = true; s.pauseStartedAt = t0 + 100_000;
  assert.equal(sessionMovingSec(s, t0 + 160_000), 100);
  assert.equal(workoutSec(s, t0 + 160_000), 160); // the rest keeps counting down
  // manual pause instead: both clocks stop
  s.autoPaused = false;
  assert.equal(workoutSec(s, t0 + 160_000), 100);
  // after an auto-pause has ended, its time stays in the workout clock
  const done: Session = { ...s, status: 'recording', autoPaused: false, pauseStartedAt: null, pausedMs: 60_000, autoPausedMs: 60_000 };
  assert.equal(sessionMovingSec(done, t0 + 200_000), 140);
  assert.equal(workoutSec(done, t0 + 200_000), 200);
});

test('English lap cue never says "60 seconds"', () => {
  assert.equal(voicePhrases.en.lap(1, '0.40', 119.7), 'Lap 1. 0.40 kilometres in 2 minutes 0 seconds.');
  assert.equal(voicePhrases.en.lap(2, '1.00', 59.6), 'Lap 2. 1.00 kilometres in 1 minute 0 seconds.');
  assert.equal(voicePhrases.en.lap(3, '1.00', 61.2), 'Lap 3. 1.00 kilometres in 1 minute 1 second.');
});
