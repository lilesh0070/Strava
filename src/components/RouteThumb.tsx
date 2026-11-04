// Lightweight route preview drawn with SVG (cheap enough for long lists, unlike a WebView map).
import { memo, useMemo } from 'react';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import type { Point } from '../lib/geo';
import { useTheme } from '../lib/theme';

function project(segments: Point[][], width: number, height: number) {
  const pts = segments.flat();
  if (pts.length < 2) return null;
  let minLat = Infinity, maxLat = -Infinity;
  for (const p of pts) { if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat; }
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180); // equirectangular correction
  let minX = Infinity, maxX = -Infinity;
  for (const p of pts) { const x = p.lng * kx; if (x < minX) minX = x; if (x > maxX) maxX = x; }
  const pad = 16;
  const scale = Math.min((width - pad * 2) / (maxX - minX || 1e-9), (height - pad * 2) / (maxLat - minLat || 1e-9));
  const ox = (width - (maxX - minX) * scale) / 2, oy = (height - (maxLat - minLat) * scale) / 2;
  const proj = (p: Point): [number, number] => [ox + (p.lng * kx - minX) * scale, height - (oy + (p.lat - minLat) * scale)];
  return {
    lines: segments.filter((s) => s.length > 1).map((s) => s.map((p) => proj(p).map((v) => v.toFixed(1)).join(',')).join(' ')),
    first: proj(pts[0]),
    last: proj(pts[pts.length - 1]),
  };
}

function RouteThumb({ segments, width, height }: { segments: Point[][]; width: number; height: number }) {
  const { C } = useTheme();
  const shape = useMemo(() => project(segments, width, height), [segments, width, height]);
  return (
    <Svg width={width} height={height}>
      <Rect width={width} height={height} rx={16} fill={C.bg} />
      {shape?.lines.map((pts, i) => (
        <Polyline key={i} points={pts} fill="none" stroke={C.route} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {shape ? <Circle cx={shape.first[0]} cy={shape.first[1]} r={4} fill={C.success} /> : null}
      {shape ? <Circle cx={shape.last[0]} cy={shape.last[1]} r={4} fill={C.danger} /> : null}
    </Svg>
  );
}

export default memo(RouteThumb);
