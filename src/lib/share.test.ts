import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Point } from './geo.ts';
import { projectRoute, routeAspect } from './routeShape.ts';
import { availableStats, defaultStats, statRows, statValue } from './shareStats.ts';
import type { Activity } from './types.ts';

const pt = (lat: number, lng: number): Point => ({ lat, lng, alt: null, acc: 5, t: 0 });
const run = (p: Partial<Activity> = {}): Activity => ({
  id: 'x', name: 'Morning Run', sport: 'run', startedAt: 0, movingSec: 1800, elapsedSec: 1900,
  distanceM: 6000, elevGainM: 0, segments: [], ...p,
});

test('route shape keeps the true proportions and fits the box', () => {
  // 1 km north, ~0.5 km east at the equator → taller than wide
  const segs = [[pt(0, 0), pt(0.009, 0), pt(0.009, 0.0045)]];
  assert.ok(Math.abs(routeAspect(segs)! - 2) < 0.01);
  const s = projectRoute(segs, 100, 200, 0)!;
  const xy = s.lines[0].split(' ').map((p) => p.split(',').map(Number));
  for (const [x, y] of xy) assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 200);
  assert.deepEqual(xy[0], [0, 200]); // start: south-west corner at the bottom left
  assert.deepEqual(xy[1], [0, 0]); // north is up
  assert.deepEqual(xy[2], [100, 0]); // then east
  assert.equal(routeAspect([[pt(1, 1)]]), null);
  assert.equal(projectRoute([], 10, 10), null);
});

test('share stats: pace only where it makes sense, formatted values', () => {
  assert.deepEqual(defaultStats(run()), ['distance', 'time', 'pace', 'speed', 'steps']);
  assert.deepEqual(statValue(run({ steps: 5321 }), 'steps'), { value: '5,321', unit: '' });
  assert.equal(statValue(run(), 'steps').value.startsWith('≈'), true); // estimated
  assert.deepEqual(defaultStats(run({ sport: 'ride' })), ['distance', 'time', 'speed']);
  assert.ok(availableStats(run({ elevGainM: 40 })).includes('elevation'));
  assert.ok(!availableStats(run()).includes('elevation'));
  assert.deepEqual(statValue(run(), 'distance'), { value: '6.00', unit: 'km' });
  assert.deepEqual(statValue(run(), 'time'), { value: '30:00', unit: '' });
  assert.deepEqual(statValue(run(), 'pace'), { value: '5:00', unit: '/km' });
  assert.deepEqual(statValue(run(), 'speed'), { value: '12.0', unit: 'km/h' });
  assert.equal(statValue(run(), 'calories', 70).unit, 'kcal');
});

test('stat grid rows', () => {
  assert.deepEqual(statRows([1, 2, 3]), [[1, 2, 3]]);
  assert.deepEqual(statRows([1, 2, 3, 4]), [[1, 2], [3, 4]]);
  assert.deepEqual(statRows([1, 2, 3, 4, 5]), [[1, 2, 3], [4, 5]]);
  assert.deepEqual(statRows([]), []);
});
