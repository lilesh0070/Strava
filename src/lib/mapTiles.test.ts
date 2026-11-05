import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutTiles, routeLines, worldX, worldY, TILE } from './mapTiles.ts';

test('web mercator world pixels', () => {
  assert.equal(worldX(0, 0), 128);
  assert.ok(Math.abs(worldY(0, 0) - 128) < 1e-9);
  assert.equal(worldX(-180, 1), 0);
  assert.equal(worldX(180, 1), 512);
  assert.ok(worldY(60, 0) < 128 && worldY(-60, 0) > 128); // north is up
});

test('layoutTiles: the route fills the fit box, tiles cover the whole canvas, one tile pixel ≈ one device pixel', () => {
  // a ~1.2 km × 0.4 km loop in Delhi, on a 360 × 640 dp story at pixel ratio 3
  const loop = [{ lat: 28.5100, lng: 77.2300 }, { lat: 28.5136, lng: 77.2300 }, { lat: 28.5136, lng: 77.2423 }, { lat: 28.5100, lng: 77.2423 }];
  const fit = { x: 20, y: 40, w: 320, h: 300 };
  const L = layoutTiles(loop, { w: 360, h: 640 }, fit, 3)!;
  assert.ok(L.z >= 14 && L.z <= 17, `zoom ${L.z}`);
  assert.ok(L.size * 3 > TILE / Math.SQRT2 - 1 && L.size * 3 < TILE * Math.SQRT2 + 1, `tile drawn at ${L.size * 3} px`);
  const xs = loop.map((p) => L.project(p.lat, p.lng)[0]), ys = loop.map((p) => L.project(p.lat, p.lng)[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  assert.ok(Math.abs((Math.max(...xs) + Math.min(...xs)) / 2 - 180) < 0.5, 'centred horizontally in the fit box');
  assert.ok(Math.abs((Math.max(...ys) + Math.min(...ys)) / 2 - 190) < 0.5, 'centred vertically in the fit box');
  assert.ok(Math.abs(w - 320 * 0.76) < 0.5 || Math.abs(h - 300 * 0.76) < 0.5, `fills the box: ${w.toFixed(1)} × ${h.toFixed(1)}`);
  assert.ok(w <= 320 * 0.76 + 0.5 && h <= 300 * 0.76 + 0.5);
  // north is up: the northern edge is drawn higher
  assert.ok(L.project(28.5136, 77.23)[1] < L.project(28.51, 77.23)[1]);
  // every point of the canvas is under some tile
  for (const [x, y] of [[0, 0], [359, 0], [0, 639], [359, 639], [180, 320]]) {
    assert.ok(L.tiles.some((t) => x >= t.left && x < t.left + L.size && y >= t.top && y < t.top + L.size), `(${x}, ${y}) uncovered`);
  }
  assert.ok(L.tiles.length < 60, `${L.tiles.length} tiles`);
  assert.match(L.tiles[0].url, /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
  assert.equal(routeLines([loop], L.project).length, 1);
});

test('layoutTiles: a single point is shown at street level; nothing to show → null', () => {
  const L = layoutTiles([{ lat: 19.07, lng: 72.87 }], { w: 300, h: 300 }, { x: 0, y: 0, w: 300, h: 300 }, 2)!;
  assert.equal(L.z, 17);
  const [x, y] = L.project(19.07, 72.87);
  assert.ok(Math.abs(x - 150) < 1e-6 && Math.abs(y - 150) < 1e-6);
  assert.equal(layoutTiles([], { w: 300, h: 300 }, { x: 0, y: 0, w: 300, h: 300 }, 2), null);
  // tile x wraps around the antimeridian
  const W = layoutTiles([{ lat: 0, lng: 179.999 }], { w: 600, h: 100 }, { x: 0, y: 0, w: 600, h: 100 }, 1, { maxZ: 3 })!;
  assert.ok(W.tiles.every((t) => /\/3\/[0-7]\/\d+\.png$/.test(t.url)));
});
