import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Activity } from './types.ts';
import { defaultRecapWeek, weekRecap } from './weekRecap.ts';
import { weekText } from './shareText.ts';

const DAY = 86_400_000;
const mon = new Date(2026, 10, 2, 7).getTime(); // Mon 2 Nov 2026 07:00 local
const act = (o: Partial<Activity>): Activity => ({
  id: Math.random().toString(36), name: 'x', sport: 'run', startedAt: mon, movingSec: 1800, elapsedSec: 1800, distanceM: 5000, elevGainM: 0, segments: [], ...o,
});

test('week recap: per-day km, totals, best pace, change vs last week, streak', () => {
  const acts = [
    act({ startedAt: mon, distanceM: 5000, movingSec: 1500 }), // Mon 5:00/km
    act({ startedAt: mon + 2 * DAY, distanceM: 10_000, movingSec: 3300 }), // Wed 5:30/km
    act({ startedAt: mon + 6 * DAY + 12 * 3600_000, distanceM: 3000, movingSec: 1200, sport: 'walk' }), // Sun
    act({ startedAt: mon - 3 * DAY, distanceM: 12_000 }), // last week
    act({ startedAt: mon - 10 * DAY, distanceM: 1000 }), // two weeks ago
    act({ startedAt: mon + 7 * DAY, distanceM: 99_000 }), // next week: not included
  ];
  const r = weekRecap(acts, mon + 3 * DAY);
  assert.equal(r.count, 3);
  assert.ok(Math.abs(r.km - 18) < 1e-9);
  assert.deepEqual(r.dayKm.map((x) => Math.round(x)), [5, 0, 10, 0, 0, 0, 3]);
  assert.equal(r.bestPaceSec, 300);
  assert.equal(r.prevKm, 12);
  assert.equal(r.changePct, 50);
  assert.equal(r.streak, 3);
  assert.equal(r.sec, 6000);
  // an empty week
  const e = weekRecap(acts, mon + 21 * DAY);
  assert.equal(e.count, 0); assert.equal(e.bestPaceSec, null); assert.equal(e.streak, 0);
});

test('default recap week: last week on Monday/Tuesday or when this week is empty, else this week', () => {
  const acts = [act({ startedAt: mon - 2 * DAY })];
  const mon0 = new Date(2026, 10, 2).getTime(); // Monday 00:00
  assert.equal(defaultRecapWeek(acts, mon + 3600_000), mon0 - 7 * DAY); // Monday morning → last week
  assert.equal(defaultRecapWeek(acts, mon + 3 * DAY), mon0 - 7 * DAY); // Thursday, nothing yet this week → last week
  assert.equal(defaultRecapWeek([...acts, act({ startedAt: mon + 2 * DAY })], mon + 3 * DAY), mon0); // Thursday with a run → this week
});

test('week text block for WhatsApp', () => {
  const r = weekRecap([act({ startedAt: mon, distanceM: 5000, movingSec: 1500 }), act({ startedAt: mon - 2 * DAY, distanceM: 4000 })], mon);
  const text = weekText(r, { title: 'My week', dateText: '2–8 Nov', labels: { activities: 'activities', best: 'best', steps: 'steps', streak: 'week streak', vsLast: 'vs last week', rank: 'among friends' }, rank: 2 });
  assert.equal(text, '🏃 My week · 2–8 Nov\n📏 5.00 km · 1 activities · ⏱️ 25:00\n⚡ best 5:00 /km · 👣 4,545 steps\n▲ 25% vs last week · 🔥 2 week streak · 🥈 #2 among friends\n— TBDI FitTrack');
});
