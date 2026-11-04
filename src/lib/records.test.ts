import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareWeeks, monthKm, newRecords, personalRecords } from './records.ts';
import type { Point } from './geo.ts';
import type { Activity } from './types.ts';

const line = (n: number, secPerStep: number, t0 = 0): Point[] =>
  Array.from({ length: n }, (_, i) => ({ lat: 19 + i * 0.001, lng: 72.8, alt: null, acc: 5, t: t0 + i * secPerStep * 1000 }));
const act = (id: string, o: Partial<Activity>): Activity => ({
  id, name: id, sport: 'run', startedAt: 0, movingSec: 0, elapsedSec: 0, distanceM: 0, elevGainM: 0, segments: [], ...o,
});

test('personal records and new PRs', () => {
  const slow = act('slow', { segments: [line(12, 40)], distanceM: 1223 });
  const fast = act('fast', { segments: [line(12, 25)], distanceM: 1223 });
  assert.equal(personalRecords([slow]).get('run-1k')!.activityId, 'slow');
  const prs = newRecords([slow], fast).map((r) => r.key);
  assert.ok(prs.includes('run-1k'));
  // a first-ever activity sets values but is not a "PR"
  assert.deepEqual(newRecords([], slow), []);
  // a slower run is not a PR
  assert.ok(!newRecords([fast], slow).some((r) => r.key === 'run-1k'));
});

test('week comparison is like-for-like mid-week', () => {
  const day = 86400000;
  const now = new Date(2026, 10, 4, 12).getTime(); // Wed noon
  const acts = [
    act('a', { startedAt: now - 1 * day, distanceM: 6000 }),        // this Tue
    act('b', { startedAt: now - 8 * day, distanceM: 4000 }),        // last Tue → counts
    act('c', { startedAt: now - 5 * day, distanceM: 10000 }),       // last Fri → not yet comparable
  ];
  const c = compareWeeks(acts, now);
  assert.equal(c.thisKm, 6);
  assert.equal(c.lastKm, 4);
  assert.equal(c.changePct, 50);
  assert.equal(monthKm(acts, now), 6);
});
