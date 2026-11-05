// OpenStreetMap raster tiles for share images: which tiles cover a card, and where a route lands on them.
// Web Mercator, the projection every slippy map uses. Pure (no React Native) so it is unit-tested.
//
// The share card draws tiles as plain <Image>s plus an SVG route, because react-native-view-shot can't
// capture the Leaflet WebView (it comes out blank). Tiles are fetched once per share and cached.

export const TILE = 256;
export const MIN_Z = 3;
export const MAX_Z = 17;

type LatLng = { lat: number; lng: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Tile = { key: string; url: string; left: number; top: number };
export type TileLayout = {
  z: number;
  /** Drawn size of one tile, in layout units (dp). */
  size: number;
  tiles: Tile[];
  /** A coordinate on the card, in layout units. */
  project: (lat: number, lng: number) => [number, number];
};

/** World pixel coordinates at zoom z. */
export const worldX = (lng: number, z: number) => ((lng + 180) / 360) * TILE * 2 ** z;
export function worldY(lat: number, z: number) {
  const s = Math.min(0.9999, Math.max(-0.9999, Math.sin((lat * Math.PI) / 180)));
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
}

export const osmTileUrl = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/**
 * Tiles covering a `canvas` (layout units) with the route centred in `fit` and as large as it fits with
 * `pad` (fraction of the fit box) around it. `pr` is the pixel ratio: one tile pixel lands on about one
 * device pixel (zoom is rounded to whole levels, tiles scaled by up to √2 either way), so the map stays
 * sharp at any export size. A single point (or a tiny route) is shown at street level (MAX_Z).
 */
export function layoutTiles(points: LatLng[], canvas: { w: number; h: number }, fit: Rect, pr: number,
  opts: { pad?: number; maxZ?: number; url?: (z: number, x: number, y: number) => string } = {}): TileLayout | null {
  const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!pts.length || canvas.w <= 0 || canvas.h <= 0 || fit.w <= 0 || fit.h <= 0 || !(pr > 0)) return null;
  const pad = opts.pad ?? 0.12, maxZ = opts.maxZ ?? MAX_Z, url = opts.url ?? osmTileUrl;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    const x = worldX(p.lng, 0), y = worldY(p.lat, 0);
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  // continuous zoom at which the route's box fills the fit box (device pixels per world pixel = 2^zf)
  const fwPx = fit.w * pr * (1 - 2 * pad), fhPx = fit.h * pr * (1 - 2 * pad);
  const zf = Math.log2(Math.min(fwPx / Math.max(maxX - minX, 1e-12), fhPx / Math.max(maxY - minY, 1e-12)));
  let z: number, k: number; // k: device pixels per world pixel at zoom z
  if (zf >= maxZ) { z = maxZ; k = 1; } else { z = Math.max(MIN_Z, Math.round(zf)); k = 2 ** (zf - z); }
  const n = 2 ** z, dpPerWorld = k / pr;
  const cx = ((minX + maxX) / 2) * n, cy = ((minY + maxY) / 2) * n;
  const ox = fit.x + fit.w / 2, oy = fit.y + fit.h / 2;
  const project = (lat: number, lng: number): [number, number] =>
    [ox + (worldX(lng, z) - cx) * dpPerWorld, oy + (worldY(lat, z) - cy) * dpPerWorld];
  // world pixels at the canvas edges
  const wx0 = cx + (0 - ox) / dpPerWorld, wx1 = cx + (canvas.w - ox) / dpPerWorld;
  const wy0 = cy + (0 - oy) / dpPerWorld, wy1 = cy + (canvas.h - oy) / dpPerWorld;
  const tiles: Tile[] = [];
  for (let ty = Math.floor(wy0 / TILE); ty <= Math.floor((wy1 - 1e-9) / TILE); ty++) {
    if (ty < 0 || ty >= n) continue; // above / below the world
    for (let tx = Math.floor(wx0 / TILE); tx <= Math.floor((wx1 - 1e-9) / TILE); tx++) {
      const wrapped = ((tx % n) + n) % n;
      tiles.push({
        key: `${z}/${tx}/${ty}`, url: url(z, wrapped, ty),
        left: ox + (tx * TILE - cx) * dpPerWorld, top: oy + (ty * TILE - cy) * dpPerWorld,
      });
    }
  }
  return { z, size: TILE * dpPerWorld, tiles, project };
}

/** SVG polyline point lists for each segment (layout units, one decimal). */
export const routeLines = (segments: LatLng[][], project: TileLayout['project']) =>
  segments.filter((s) => s.length > 1).map((s) => s.map((p) => project(p.lat, p.lng).map((v) => v.toFixed(1)).join(',')).join(' '));
