import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../lib/theme';

export default function ElevationChart({ d, alt, width, height }: { d: number[]; alt: (number | null)[]; width: number; height: number }) {
  const { C } = useTheme();
  const pts = d.map((x, i) => [x, alt[i]] as const).filter((p): p is readonly [number, number] => p[1] != null);
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
