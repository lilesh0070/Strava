import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activitySteps, cadence, estimateSteps, fmtSteps, stepDelta, stepLength } from './steps.ts';
import type { Activity } from './types.ts';

const act = (p: Partial<Activity>): Activity => ({
  id: 'a', name: 'x', sport: 'run', startedAt: 0, movingSec: 1667, elapsedSec: 1700, distanceM: 5000, elevGainM: 0, segments: [], ...p,
});

test('step estimates give realistic cadences', () => {
  const run = act({}); // 5 km at 3 m/s
  assert.ok(Math.abs(stepLength('run', 3) - 1.05) < 1e-9);
  assert.equal(estimateSteps(run), 4762);
  assert.ok(Math.abs(cadence(run)! - 171) <= 1, String(cadence(run))); // typical running cadence
  const walk = act({ sport: 'walk', movingSec: 3846 }); // 5 km at 1.3 m/s
  assert.equal(estimateSteps(walk), 6944);
  assert.ok(cadence(walk)! > 100 && cadence(walk)! < 115);
  assert.equal(estimateSteps(act({ sport: 'ride' })), null);
  assert.equal(activitySteps(act({ sport: 'ride', steps: 100 })), null);
});

test('measured steps win over the estimate; zero means "not measured"', () => {
  assert.deepEqual(activitySteps(act({ steps: 5100 })), { steps: 5100, estimated: false });
  assert.deepEqual(activitySteps(act({ steps: 0 })), { steps: 4762, estimated: true });
  assert.equal(cadence(act({ movingSec: 30, distanceM: 50 })), null); // too short to be meaningful
});

test('pedometer readings: running total since subscribing, restarts after a re-subscribe', () => {
  let last: number | null = null, total = 0;
  for (const reading of [1, 5, 12, 12, 30]) { total += stepDelta(last, reading); last = reading; }
  assert.equal(total, 30);
  last = null; // app restarted mid-run: the sensor stream starts again from 0
  for (const reading of [3, 8]) { total += stepDelta(last, reading); last = reading; }
  assert.equal(total, 38);
  assert.equal(stepDelta(10, 4), 0); // never negative
  assert.equal(fmtSteps(1234567), '1,234,567');
});
