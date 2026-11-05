// Lightweight route preview drawn with SVG (cheap enough for long lists, unlike a WebView map).
import { memo, useMemo } from 'react';
import Svg, { Polyline, Rect } from 'react-native-svg';
import type { Point } from '../lib/geo';
import { projectRoute } from '../lib/routeShape';
import { useTheme } from '../lib/theme';

function RouteThumb({ segments, width, height }: { segments: Point[][]; width: number; height: number }) {
  const { C } = useTheme();
  const shape = useMemo(() => projectRoute(segments, width, height), [segments, width, height]);
  return (
    <Svg width={width} height={height}>
      <Rect width={width} height={height} rx={16} fill={C.bg} />
      {shape?.lines.map((pts, i) => (
        <Polyline key={i} points={pts} fill="none" stroke={C.route} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </Svg>
  );
}

export default memo(RouteThumb);
