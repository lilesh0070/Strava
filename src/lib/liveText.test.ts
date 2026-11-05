import assert from 'node:assert/strict';
import { test } from 'node:test';
import { liveSummary, liveTitle } from './liveText.ts';
import type { Session } from './types.ts';

const base: Session = { sport: 'run', startedAt: 0, status: 'recording', pausedMs: 0, pauseStartedAt: null, distanceM: 2340, lastCueKm: 2, workout: null, segments: [[]] };

test('live notification text: run pace, current pace, paused state, Hindi', () => {
  assert.equal(liveTitle(base, 'en'), 'Recording · Run');
  assert.equal(liveSummary(base, 725, 1000 / 310), '2.34 km · 12:05 · 5:10 /km · now 5:10 /km');
  // standing still: no "now" part
  assert.equal(liveSummary(base, 725, 0.2), '2.34 km · 12:05 · 5:10 /km');
  assert.equal(liveSummary(base, 725, null), '2.34 km · 12:05 · 5:10 /km');
  // paused: title says so and the current speed is dropped
  const paused: Session = { ...base, status: 'paused' };
  assert.equal(liveTitle(paused, 'en'), 'Paused · Run');
  assert.equal(liveSummary(paused, 725, 3), '2.34 km · 12:05 · 5:10 /km');
  // rides show speed
  const ride: Session = { ...base, sport: 'ride', distanceM: 12_500 };
  assert.equal(liveSummary(ride, 1800, 7), '12.5 km · 30:00 · 25.0 km/h · now 25.2 km/h');
  // Hindi labels, same numbers
  assert.equal(liveTitle(base, 'hi'), 'रिकॉर्डिंग · दौड़');
  assert.equal(liveSummary(base, 725, 1000 / 310, 'hi'), '2.34 km · 12:05 · 5:10 /km · अभी 5:10 /km');
  // nothing yet: placeholders, no crash
  assert.equal(liveSummary({ ...base, distanceM: 0 }, 0, null), '0.00 km · 0:00 · –:–– /km');
});
