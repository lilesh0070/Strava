import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kmCue, shouldAutoPause, toGpx, weekStreak } from './coach.ts';

test('km cue for pace and speed', () => {
  assert.equal(kmCue(1, 330, true), '1 kilometre. Time 5 minutes 30 seconds. Average pace 5 minutes 30 seconds per kilometre.');
  assert.equal(kmCue(10, 1200, false), '10 kilometres. Time 20 minutes. Average speed 30.0 kilometres per hour.');
});

test('auto-pause threshold', () => {
  assert.equal(shouldAutoPause(0, 11_999), false);
  assert.equal(shouldAutoPause(0, 12_000), true);
});

test('gpx output escapes names and keeps segments', () => {
  const gpx = toGpx('Run <fun> & "games"', 'run', 0, [
    [{ lat: 19, lng: 72.8, alt: 10, acc: 5, t: 0 }, { lat: 19.001, lng: 72.8, alt: null, acc: 5, t: 1000 }],
    [{ lat: 19.002, lng: 72.8, alt: 12, acc: 5, t: 5000 }],
  ]);
  assert.match(gpx, /<name>Run &lt;fun&gt; &amp; &quot;games&quot;<\/name>/);
  assert.equal((gpx.match(/<trkseg>/g) ?? []).length, 2);
  assert.equal((gpx.match(/<trkpt /g) ?? []).length, 3);
  assert.match(gpx, /<ele>10.0<\/ele><time>1970-01-01T00:00:00.000Z<\/time>/);
});

test('week streak', () => {
  const day = 86_400_000;
  const now = new Date(2026, 10, 4, 12).getTime(); // Wed
  assert.equal(weekStreak([], now), 0);
  assert.equal(weekStreak([now, now - 7 * day, now - 14 * day], now), 3);
  // nothing this week yet, but last two weeks active → streak still alive
  assert.equal(weekStreak([now - 7 * day, now - 14 * day], now), 2);
  assert.equal(weekStreak([now, now - 14 * day], now), 1);
});
