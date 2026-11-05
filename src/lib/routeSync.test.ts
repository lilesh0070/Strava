import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Point } from './geo.ts';
import { mapState, routeUpdate } from './routeSync.ts';

const p = (i: number): Point => ({ lat: 19 + i * 1e-4, lng: 72.8, alt: null, acc: 5, t: i * 1000 });

test('live map: only new points are sent while recording', () => {
  const segs: Point[][] = [[p(0), p(1)]];
  assert.equal(routeUpdate({ segs: null, lens: [], cur: '' }, segs, 'a').kind, 'reset'); // first draw
  let st = mapState(segs, 'a');
  assert.deepEqual(routeUpdate(st, segs, 'a'), { kind: 'none' }); // re-render, nothing new
  assert.deepEqual(routeUpdate(st, segs, 'b'), { kind: 'append', segs: [] }); // position moved only
  segs[0].push(p(2), p(3)); // in-place growth, like the tracker
  const u = routeUpdate(st, segs, 'b');
  assert.equal(u.kind, 'append');
  assert.deepEqual(u.kind === 'append' && u.segs.map(([i, pts]) => [i, pts.length]), [[0, 2]]);
  st = mapState(segs, 'b');
  segs.push([p(10)]); // resume after a pause starts a new segment
  const v = routeUpdate(st, segs, 'b');
  assert.deepEqual(v.kind === 'append' && v.segs.map(([i, pts]) => [i, pts.length]), [[1, 1]]);
});

test('live map: a new data set or a shorter route redraws everything', () => {
  const a: Point[][] = [[p(0), p(1), p(2)]];
  const st = mapState(a, '');
  assert.equal(routeUpdate(st, [[p(0)]], '').kind, 'reset'); // different array (new session / discard)
  a[0].pop();
  assert.equal(routeUpdate(st, a, '').kind, 'reset'); // shrank in place
  assert.equal(routeUpdate(mapState(a, ''), a, '', true).kind, 'reset'); // page reloaded
});
