import assert from 'node:assert/strict';
import { test } from 'node:test';
import { simplify, totalDistance, type Point } from './geo.ts';
import { kmCueHi, translate } from './strings.ts';

test('simplify keeps shape with far fewer points', () => {
  // a 2 km straight line with tiny noise plus one 90° corner
  const pts: Point[] = [];
  for (let i = 0; i <= 1000; i++) pts.push({ lat: 19 + i * 0.00001 + (i % 2 ? 0.0000005 : 0), lng: 72.8, alt: null, acc: 5, t: i * 1000 });
  for (let i = 1; i <= 1000; i++) pts.push({ lat: 19.01, lng: 72.8 + i * 0.00001, alt: null, acc: 5, t: (1000 + i) * 1000 });
  const s = simplify(pts, 6);
  assert.ok(s.length <= 5, String(s.length));
  assert.ok(Math.abs(totalDistance([s]) - totalDistance([pts])) / totalDistance([pts]) < 0.01);
  assert.equal(s[0], pts[0]);
  assert.equal(s[s.length - 1], pts[pts.length - 1]);
});

test('hindi strings and fallback', () => {
  assert.equal(translate('hi', 'tab.feed'), 'इतिहास');
  assert.equal(translate('en', 'tab.feed'), 'History');
  assert.match(kmCueHi(2, 660, true), /^2 किलोमीटर पूरे। समय 11 मिनट। औसत पेस 5 मिनट 30 सेकंड प्रति किलोमीटर।$/);
});
