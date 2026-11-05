import { memo, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import { smoothAltitude, type Point } from '../lib/geo';
import { useTheme } from '../lib/theme';

/** Altitude profile along the route. Smoothed like the elevation gain, and reduced to about one point per pixel. */
function ElevationChart({ d, segments, width, height }: { d: number[]; segments: Point[][]; width: number; height: number }) {
  const { C } = useTheme();
  const pts = useMemo(() => {
    const alt = segments.flatMap((seg) => smoothAltitude(seg));
    const all = d.map((x, i) => [x, alt[i]] as const).filter((p): p is readonly [number, number] => p[1] != null);
    if (all.length < 2) return all;
    // one sample per pixel column: keeps every hill, drops the 7,000-command paths that lag the UI
    const maxD = all[all.length - 1][0] || 1, cols = Math.max(2, Math.floor(width));
    const out: (readonly [number, number])[] = [all[0]];
    let col = 0, sum = 0, n = 0, dSum = 0;
    for (const p of all) {
      const c = Math.min(cols - 1, Math.floor((p[0] / maxD) * cols));
      if (c !== col) { if (n) out.push([dSum / n, sum / n]); col = c; sum = 0; n = 0; dSum = 0; }
      sum += p[1]; n++; dSum += p[0];
    }
    if (n) out.push([dSum / n, sum / n]);
    return out;
  }, [d, segments, width]);
  if (pts.length < 2) return null;
  const maxD = pts[pts.length - 1][0] || 1;
  const as = pts.map((p) => p[1]);
  const lo = Math.min(...as), hi = Math.max(...as);
  const range = Math.max(hi - lo, 10);
  const x = (v: number) => (v / maxD) * width;
  const y = (v: number) => height - 4 - ((v - lo) / range) * (height - 8);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
  return (
    <Svg width={width} height={height}>
      <Path d={`${line} L${width},${height} L0,${height} Z`} fill={C.route} opacity={0.18} />
      <Path d={line} stroke={C.route} strokeWidth={2} fill="none" />
    </Svg>
  );
}

export default memo(ElevationChart);
