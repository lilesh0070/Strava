import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { fmtPace } from '../lib/geo';
import { useT } from '../lib/i18n';
import { speedSeries } from '../lib/live';
import type { Point } from '../lib/geo';
import { useTheme } from '../lib/theme';
import { IconWell, NeuCard } from './Neu';

/** Pace (or speed) along the route. Faster is drawn higher for both. */
function PaceChart({ segments, usesPace, width }: { segments: Point[][]; usesPace: boolean; width: number }) {
  const { C, F } = useTheme();
  const { t } = useT();
  const s = useMemo(() => speedSeries(segments), [segments]);
  if (s.length < 4) return null;
  const height = 110;
  const vs = s.map((p) => p.v).sort((a, b) => a - b);
  const lo = vs[Math.floor(vs.length * 0.05)], hi = vs[Math.ceil(vs.length * 0.95) - 1]; // ignore outliers
  const maxD = s[s.length - 1].d;
  const avg = s.reduce((a, p) => a + p.v, 0) / s.length;
  const x = (d: number) => (d / maxD) * width;
  const y = (v: number) => height - 6 - ((Math.min(hi, Math.max(lo, v)) - lo) / Math.max(hi - lo, 0.1)) * (height - 12);
  const line = s.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const fmt = (v: number) => (usesPace ? `${fmtPace(1000, 1000 / v)}/km` : `${(v * 3.6).toFixed(1)} km/h`);
  return (
    <NeuCard radius={28} style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconWell icon="chart-bell-curve-cumulative" />
        <View style={{ flex: 1 }}>
          <Text style={F.h2}>{t(usesPace ? 'act.pace' : 'act.speed')}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{t('chart.fastest').replace('{a}', fmt(hi)).replace('{b}', fmt(avg))}</Text>
        </View>
      </View>
      <NeuCard inset radius={18} padding={8}>
        <Svg width={width} height={height}>
          <Line x1={0} x2={width} y1={y(avg)} y2={y(avg)} stroke={C.muted} strokeDasharray="4 4" strokeWidth={1} />
          <Path d={`${line} L${width},${height} L0,${height} Z`} fill={C.accent} opacity={0.15} />
          <Path d={line} stroke={C.accent} strokeWidth={2} fill="none" />
        </Svg>
      </NeuCard>
    </NeuCard>
  );
}

export default memo(PaceChart);
