// Route → SVG coordinates. Shared by the list thumbnails and the share sticker, so the route line
// looks the same everywhere. Pure (no React Native) so it is unit-tested.
import type { Point } from './geo';

export type RouteShape = { lines: string[]; first: [number, number]; last: [number, number] };

/** Height ÷ width of the route's bounding box on the ground, or null without a route. */
export function routeAspect(segments: Point[][]): number | null {
  const pts = segments.flat();
  if (pts.length < 2) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of pts) {
    if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng; if (p.lng > maxLng) maxLng = p.lng;
  }
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const w = (maxLng - minLng) * kx, h = maxLat - minLat;
  if (w <= 0 && h <= 0) return null;
  return h / Math.max(w, 1e-9);
}

/** Fit the route into width × height (keeping its true shape), north up. */
export function projectRoute(segments: Point[][], width: number, height: number, pad = 16): RouteShape | null {
  const pts = segments.flat();
  if (pts.length < 2) return null;
  let minLat = Infinity, maxLat = -Infinity;
  for (const p of pts) { if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat; }
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180); // equirectangular correction
  let minX = Infinity, maxX = -Infinity;
  for (const p of pts) { const x = p.lng * kx; if (x < minX) minX = x; if (x > maxX) maxX = x; }
  const scale = Math.min((width - pad * 2) / (maxX - minX || 1e-9), (height - pad * 2) / (maxLat - minLat || 1e-9));
  const ox = (width - (maxX - minX) * scale) / 2, oy = (height - (maxLat - minLat) * scale) / 2;
  const proj = (p: Point): [number, number] => [ox + (p.lng * kx - minX) * scale, height - (oy + (p.lat - minLat) * scale)];
  return {
    lines: segments.filter((s) => s.length > 1).map((s) => s.map((p) => proj(p).map((v) => v.toFixed(1)).join(',')).join(' ')),
    first: proj(pts[0]),
    last: proj(pts[pts.length - 1]),
  };
}
