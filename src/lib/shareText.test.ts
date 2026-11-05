import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Point } from './geo.ts';
import { activityText, routeAsText } from './shareText.ts';
import type { Activity } from './types.ts';

const pt = (lat: number, lng: number, t = 0): Point => ({ lat, lng, alt: null, acc: 5, t });
const labels = { distance: 'Distance', time: 'Time', pace: 'Avg pace', speed: 'Avg speed', steps: 'Steps', elevation: 'Elev gain', calories: 'Calories' };

test('route as Braille: a square loop keeps its shape and size limits', () => {
  const d = 0.005; // ~550 m
  const loop = [pt(0, 0), pt(0, d), pt(d, d), pt(d, 0), pt(0, 0)];
  const text = routeAsText([loop], 8, 4)!;
  const lines = text.split('\n');
  assert.ok(lines.length <= 4 && lines.every((l) => [...l].length <= 8), text);
  assert.ok([...text.replace(/\n/g, '')].every((ch) => ch.charCodeAt(0) >= 0x2800 && ch.charCodeAt(0) <= 0x28ff));
  // a square: as many characters across as lines × 2 (a Braille cell is 2 dots wide, 4 tall)
  assert.equal([...lines[0]].length, lines.length * 2);
  // the outline is drawn: top-left cell has dots, the middle of the square is empty
  assert.notEqual(lines[0].charCodeAt(0), 0x2800);
  assert.equal(lines[1].charCodeAt(2), 0x2800);
});

test('route as Braille: a straight north–south line and no route', () => {
  const ns = routeAsText([[pt(0, 0), pt(0.01, 0)]], 16, 3)!;
  assert.equal(ns.split('\n').length, 3);
  assert.ok(ns.split('\n').every((l) => [...l].length === 1));
  assert.equal(routeAsText([]), null);
  assert.equal(routeAsText([[pt(1, 1)]]), null);
  assert.equal(routeAsText([[pt(1, 1), pt(1, 1)]]), null);
});

test('activity as text: title, chosen stats in order, route, app name', () => {
  const t0 = Date.UTC(2026, 10, 5, 6);
  const a: Activity = { id: 'x', name: 'Morning Run', sport: 'run', startedAt: t0, movingSec: 1694, elapsedSec: 1700,
    distanceM: 5210, elevGainM: 12, segments: [[pt(28.6, 77.2, t0), pt(28.61, 77.21, t0 + 1694000)]] };
  const text = activityText(a, { stats: ['distance', 'time', 'pace'], labels, dateText: 'Thu, 5 Nov' });
  const lines = text.split('\n');
  assert.equal(lines[0], '🏃 Morning Run');
  assert.equal(lines[1], 'Thu, 5 Nov');
  assert.ok(text.includes('📏 Distance: 5.21 km'), text);
  assert.ok(text.includes('⏱️ Time: 28:14'), text);
  assert.ok(text.includes('⚡ Avg pace: 5:25 /km'), text);
  assert.ok(text.indexOf('Distance') < text.indexOf('Time') && text.indexOf('Time') < text.indexOf('Avg pace'));
  assert.ok(/[⠁-⣿]/.test(text), 'route drawn');
  assert.equal(lines[lines.length - 1], '— TBDI FitTrack');
  const noRoute = activityText(a, { stats: ['distance'], labels, route: false });
  assert.ok(!/[⠀-⣿]/.test(noRoute));
});
