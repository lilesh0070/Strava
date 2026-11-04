// Lightweight route preview drawn with SVG (cheap enough for long lists, unlike a WebView map).
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import type { Point } from '../lib/geo';
import { C } from '../lib/theme';

export default function RouteThumb({ segments, width, height }: { segments: Point[][]; width: number; height: number }) {
  const pts = segments.flat();
  if (pts.length < 2) {
    return (
      <Svg width={width} height={height}>
        <Rect width={width} height={height} rx={10} fill={C.cardAlt} />
      </Svg>
    );
  }
  const midLat = (Math.min(...pts.map((p) => p.lat)) + Math.max(...pts.map((p) => p.lat))) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180); // equirectangular correction
  const xs = pts.map((p) => p.lng * kx), ys = pts.map((p) => p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 16;
  const scale = Math.min((width - pad * 2) / (maxX - minX || 1e-9), (height - pad * 2) / (maxY - minY || 1e-9));
  const ox = (width - (maxX - minX) * scale) / 2, oy = (height - (maxY - minY) * scale) / 2;
  const proj = (p: Point) => [ox + (p.lng * kx - minX) * scale, height - (oy + (p.lat - minY) * scale)];
  const first = proj(pts[0]), last = proj(pts[pts.length - 1]);
  return (
    <Svg width={width} height={height}>
      <Rect width={width} height={height} rx={10} fill={C.cardAlt} />
      {segments.filter((s) => s.length > 1).map((s, i) => (
        <Polyline key={i} points={s.map((p) => proj(p).join(',')).join(' ')} fill="none"
          stroke={C.route} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      <Circle cx={first[0]} cy={first[1]} r={4} fill="#22c55e" />
      <Circle cx={last[0]} cy={last[1]} r={4} fill="#ef4444" />
    </Svg>
  );
}
