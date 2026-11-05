import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDays, checkinStreak, dailyScore, dayKey, emptyDay, fill, insights, mergeLogs, mondayKey, scoreStreak,
  waterGoalMl, weekSummary, wellnessBadges, type DayLog, type WellnessLog,
} from './health.ts';
import type { Activity } from './types.ts';

const at = (key: string, h = 8) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, h).getTime(); };
const act = (key: string, min: number, km = min / 6): Activity => ({
  id: key + min, name: 'x', sport: 'run', startedAt: at(key, 7), movingSec: min * 60, elapsedSec: min * 60,
  distanceM: km * 1000, elevGainM: 0, segments: [],
});
const day = (p: Partial<DayLog>): DayLog => ({ ...emptyDay(), ...p });
const checkin = (p: Partial<NonNullable<DayLog['checkin']>> = {}) => ({ mood: 4, energy: 3, sleepH: 7.5, stress: 1, at: 0, ...p });

test('date keys: local days, Monday-based weeks', () => {
  assert.equal(dayKey(new Date(2026, 10, 5, 23, 59)), '2026-11-05');
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(mondayKey('2026-11-05'), '2026-11-02'); // Thursday → Monday
  assert.equal(mondayKey('2026-11-08'), '2026-11-02'); // Sunday belongs to the same week
  assert.equal(mondayKey('2026-11-02'), '2026-11-02');
});

test('water goal: 35 ml/kg plus exercise, whole glasses, sane limits', () => {
  assert.equal(waterGoalMl(70), 2500); // 2450 → 10 glasses
  assert.equal(waterGoalMl(70, 60), 3000); // +500 ml for an hour of exercise
  assert.equal(waterGoalMl(30), 1500); // floor
  assert.equal(waterGoalMl(200, 300), 4500); // ceiling
  assert.equal(waterGoalMl(0), 2500); // unknown weight → 70 kg
});

test('daily score weights move 35, water 25, breaks 20, mind 10, check-in 10', () => {
  assert.equal(dailyScore(undefined, 0, 2500).total, 0);
  const full = dailyScore(day({ waterMl: 2500, breaks: 3, eyeBreaks: 1, mindfulMin: 2, checkin: checkin() }), 30, 2500);
  assert.equal(full.total, 100);
  const half = dailyScore(day({ waterMl: 1250, breaks: 2 }), 15, 2500);
  assert.deepEqual(half.parts.map((p) => p.points), [18, 13, 10, 0, 0]);
  assert.equal(dailyScore(day({ waterMl: 9999 }), 999, 2500).total, 60); // capped per part
});

test('wellness streak counts good days and treats today as in progress', () => {
  const good = day({ waterMl: 2500, breaks: 4, checkin: checkin() }); // 25 + 20 + 10 = 55
  const log: WellnessLog = { '2026-11-03': good, '2026-11-04': good };
  assert.equal(scoreStreak(log, {}, 70, '2026-11-05'), 2); // today not done yet: streak still alive
  log['2026-11-05'] = good;
  assert.equal(scoreStreak(log, {}, 70, '2026-11-05'), 3);
  assert.equal(scoreStreak({ '2026-11-01': good }, {}, 70, '2026-11-05'), 0);
});

test('week summary', () => {
  const log: WellnessLog = {
    '2026-11-02': day({ waterMl: 2750, breaks: 2, checkin: checkin({ sleepH: 6, mood: 3 }) }), // 30 min run → goal 2750
    '2026-11-03': day({ waterMl: 1000, eyeBreaks: 1, mindfulMin: 3, checkin: checkin({ sleepH: 8, mood: 5 }) }),
    '2026-11-01': day({ waterMl: 5000, breaks: 9 }), // previous week (Sunday)
  };
  const w = weekSummary(log, [act('2026-11-02', 30, 5), act('2026-11-04', 45, 6), act('2026-10-30', 60)], 70, '2026-11-04');
  assert.deepEqual(w.days, ['2026-11-02', '2026-11-03', '2026-11-04']);
  assert.equal(w.activeMin, 75);
  assert.equal(w.km, 11);
  assert.equal(w.activities, 2);
  assert.equal(w.waterDays, 1);
  assert.equal(w.breaks, 3);
  assert.equal(w.mindfulMin, 3);
  assert.equal(w.avgSleep, 7);
  assert.equal(w.avgMood, 4);
  assert.equal(w.scores.length, 3);
});

test('insights: sleep, stress and WHO progress', () => {
  const now = new Date(2026, 10, 7, 20).getTime(); // Saturday evening
  const log: WellnessLog = {};
  for (let i = 0; i < 4; i++) log[addDays('2026-11-07', -i)] = day({ checkin: checkin({ sleepH: 5.5, stress: 3 }) });
  const ins = insights(log, [act('2026-11-03', 40)], 70, now);
  assert.deepEqual(ins.map((x) => x.key), ['ins.sleepLow', 'ins.stressHigh', 'ins.whoLeft']);
  assert.equal(ins[0].vars.n, 4);
  assert.equal(ins[2].vars.n, 110);
  assert.equal(ins[2].vars.m, 55); // Saturday + Sunday left
  const done = insights({}, [act('2026-11-02', 90), act('2026-11-04', 70)], 70, now);
  assert.equal(done[0].key, 'ins.whoDone');
});

test('insights: active days lift mood, low water, no break yet', () => {
  const log: WellnessLog = {};
  const acts: Activity[] = [];
  for (let i = 1; i <= 8; i++) {
    const k = addDays('2026-11-05', -i);
    const activeDay = i % 2 === 0;
    log[k] = day({ waterMl: 300, checkin: checkin({ mood: activeDay ? 5 : 3 }) });
    if (activeDay) acts.push(act(k, 30));
  }
  const ins = insights(log, acts, 70, new Date(2026, 10, 5, 12).getTime()); // Thursday noon
  const keys = ins.map((x) => x.key);
  assert.ok(keys.includes('ins.waterLow'), keys.join());
  assert.ok(keys.includes('ins.moveMood'), keys.join());
  assert.equal(ins.find((x) => x.key === 'ins.moveMood')!.vars.d, '2.0');
  const fresh = insights({}, [], 70, new Date(2026, 10, 5, 12).getTime());
  assert.ok(fresh.some((x) => x.key === 'ins.noBreak'));
  assert.ok(!insights({}, [], 70, new Date(2026, 10, 8, 12).getTime()).some((x) => x.key === 'ins.noBreak')); // Sunday
});

test('check-in streak and badges', () => {
  const log: WellnessLog = {};
  for (let i = 0; i < 7; i++) log[addDays('2026-11-05', -i)] = day({ breaks: 4, mindfulMin: 5, waterMl: 2500, checkin: checkin() });
  assert.equal(checkinStreak(log, '2026-11-05'), 7);
  const b = Object.fromEntries(wellnessBadges(log, [act('2026-11-03', 160)], 70, '2026-11-05').map((x) => [x.id, x]));
  assert.equal(b['w-hydrated'].earned, true); // 7 water days (160 min day needs more water, still 6 ≥ 5)
  assert.equal(b['w-desk'].earned, true); // 28 breaks
  assert.equal(b['w-calm'].earned, true); // 35 min
  assert.equal(b['w-checkin'].earned, true);
  assert.equal(b['w-who'].earned, true);
  assert.equal(b['w-score'].earned, true);
  assert.equal(b['w-streak'].earned, true);
  const none = wellnessBadges({}, [], 70, '2026-11-05');
  assert.ok(none.every((x) => !x.earned && x.progress === 0));
});

test('merge keeps the larger counts and never drops a check-in', () => {
  const local: WellnessLog = { '2026-11-05': day({ waterMl: 500, breaks: 3, checkin: checkin({ mood: 2 }) }) };
  const incoming = {
    '2026-11-05': day({ waterMl: 1500, breaks: 1, checkin: checkin({ mood: 5 }) }),
    '2026-11-04': day({ mindfulMin: 3 }),
    'garbage': day({ waterMl: 1 }),
  } as WellnessLog;
  const m = mergeLogs(local, incoming);
  assert.equal(m['2026-11-05'].waterMl, 1500);
  assert.equal(m['2026-11-05'].breaks, 3);
  assert.equal(m['2026-11-05'].checkin!.mood, 2);
  assert.equal(m['2026-11-04'].mindfulMin, 3);
  assert.equal(m.garbage, undefined);
});

test('fill placeholders', () => {
  assert.equal(fill('{n} of {of} nights', { n: 3, of: 7 }), '3 of 7 nights');
});

test('merge drops malformed check-ins and silly numbers from a bad file', () => {
  const bad = {
    '2026-11-01': { waterMl: -50, breaks: 'x', eyeBreaks: 1e12, mindfulMin: NaN, checkin: { mood: 9, energy: 2, sleepH: 7, stress: 1 } },
    '2026-11-02': { waterMl: 500, breaks: 1, eyeBreaks: 0, mindfulMin: 0, checkin: { mood: 4, energy: 3, sleepH: 6.5, stress: 2, at: 5 } },
  } as unknown as WellnessLog;
  const m = mergeLogs({}, bad);
  assert.deepEqual([m['2026-11-01'].waterMl, m['2026-11-01'].breaks, m['2026-11-01'].eyeBreaks, m['2026-11-01'].mindfulMin], [0, 0, 100000, 0]);
  assert.equal(m['2026-11-01'].checkin, undefined);
  assert.deepEqual(m['2026-11-02'].checkin, { mood: 4, energy: 3, stress: 2, sleepH: 6.5, at: 5 });
});
