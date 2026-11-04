import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateAchievements, newlyEarned } from './achievements.ts';
import { estimateCalories, metFor } from './calories.ts';
import { speedSeries } from './live.ts';
import { parseDuration } from './parse.ts';
import { advance, PRESETS, remaining, startProgress, stepCue } from './workouts.ts';
import type { Activity } from './types.ts';

const act = (o: Partial<Activity>): Activity => ({
  id: Math.random().toString(36), name: 'x', sport: 'run', startedAt: Date.UTC(2026, 0, 1, 8), movingSec: 1800, elapsedSec: 1800,
  distanceM: 5000, elevGainM: 0, segments: [], ...o,
});

test('calories', () => {
  assert.equal(metFor('run', 10), 11);
  assert.equal(estimateCalories('run', 5000, 1800, 70), 385); // 11 MET × 70 kg × 0.5 h
  assert.equal(estimateCalories('run', 5000, 0, 70), 0);
});

test('parse duration', () => {
  assert.equal(parseDuration('45'), 2700);
  assert.equal(parseDuration('32:10'), 1930);
  assert.equal(parseDuration('1:05:30'), 3930);
  assert.equal(parseDuration('5:75'), null);
  assert.equal(parseDuration('abc'), null);
});

test('achievements', () => {
  const list = evaluateAchievements([act({ distanceM: 5200 })]);
  assert.ok(list.find((a) => a.id === 'first')!.earned);
  assert.ok(list.find((a) => a.id === '5k')!.earned);
  assert.ok(!list.find((a) => a.id === '10k')!.earned);
  assert.equal(list.find((a) => a.id === '10k')!.progress, 0.52);
  const fresh = newlyEarned([act({ distanceM: 6000 })], act({ distanceM: 10500 }));
  assert.deepEqual(fresh.map((x) => x.id), ['10k']);
});

test('interval workout steps advance by time and distance', () => {
  const w = PRESETS.find((x) => x.id === '400s')!;
  let p = startProgress(w.id, 0, 0);
  assert.match(stepCue(w, p), /Warm up/);
  assert.equal(advance(w, p, 500, 599).changed, false);
  ({ p } = advance(w, p, 1500, 600)); // warm-up done
  assert.equal(p.index, 1);
  assert.match(stepCue(w, p), /Interval 1 of 6\. Go hard for 400 metres/);
  assert.equal(remaining(w, p, 1700, 700), 200);
  ({ p } = advance(w, p, 1900, 690));
  assert.match(stepCue(w, p), /Recover\. 90 seconds easy/);
  // run through to the end
  let guard = 0, d = 1900, t = 690;
  while (!p.done && guard++ < 100) { d += 1000; t += 1000; ({ p } = advance(w, p, d, t)); }
  assert.ok(p.done);
  assert.match(stepCue(w, p), /complete/);
});

test('speed series', () => {
  const seg = Array.from({ length: 200 }, (_, i) => ({ lat: 19 + i * 0.00003, lng: 72.8, alt: null, acc: 5, t: i * 1000 }));
  const s = speedSeries([seg]);
  assert.ok(s.length >= 6);
  assert.ok(s.every((p) => Math.abs(p.v - 3.34) < 0.1));
});
