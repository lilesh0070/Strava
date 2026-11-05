// The share sticker: the activity's orange route line plus chosen stats on a transparent background,
// so it can float over any photo or video (e.g. as an Instagram story sticker). Everything scales with
// `width`, so the on-screen preview and the full-resolution export look identical.
import { forwardRef, useMemo } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { simplify, type Point } from '../lib/geo';
import { useT } from '../lib/i18n';
import { projectRoute, routeAspect } from '../lib/routeShape';
import { statRows, statValue, type ShareStatKey } from '../lib/shareStats';
import type { Key } from '../lib/strings';
import type { Activity } from '../lib/types';
import type { ShareCardHandle } from './ShareCard';

export type OverlayLayout = 'full' | 'stats' | 'route';
export type OverlayTone = 'light' | 'dark';

type Props = {
  a: Activity; width: number; layout: OverlayLayout; tone: OverlayTone; stats: ShareStatKey[];
  showTitle: boolean; showLogo: boolean; weightKg: number; routeColor: string;
};

const StoryOverlay = forwardRef<ShareCardHandle, Props>(function StoryOverlay(
  { a, width, layout, tone, stats, showTitle, showLogo, weightKg, routeColor }, ref) {
  const { t } = useT();
  const k = width / 360; // design unit
  const fg = tone === 'light' ? '#FFFFFF' : '#1B1F29';
  const halo = tone === 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.6)';
  const text = (size: number, weight: TextStyle['fontWeight'] = '800'): TextStyle => ({
    color: fg, fontSize: size * k, fontWeight: weight, textAlign: 'center',
    textShadowColor: halo, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 * k,
  });

  // full-resolution route, lightly simplified (≈2 m) so the SVG stays fast without changing the shape
  const segs = useMemo(() => a.segments.filter((s) => s.length > 1).map((s) => simplify(s, 2)), [a.segments]);
  const hasRoute = segs.length > 0 && layout !== 'stats';
  const inner = width - 32 * k;
  const aspect = routeAspect(segs) ?? 1;
  const routeH = Math.min(Math.max(inner * aspect, inner * 0.45), inner * (layout === 'route' ? 1.4 : 1.0));
  const shape = useMemo(() => (hasRoute ? projectRoute(segs as Point[][], inner, routeH, 10 * k) : null), [hasRoute, segs, inner, routeH, k]);
  const rows = statRows(layout === 'route' ? [] : stats);
  const line = 5 * k;

  return (
    <View ref={ref} collapsable={false} style={{ width, paddingVertical: 16 * k, paddingHorizontal: 16 * k, alignItems: 'center', gap: 14 * k, backgroundColor: 'transparent' }}>
      {showTitle && (
        <View style={{ alignItems: 'center' }}>
          <Text style={text(20)} numberOfLines={1}>{a.name}</Text>
          <Text style={text(12, '600')}>
            {new Date(a.startedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
      )}
      {shape && (
        <Svg width={inner} height={routeH}>
          {/* soft outline so the orange line reads on light and dark photos alike */}
          {shape.lines.map((pts, i) => (
            <Polyline key={`h${i}`} points={pts} fill="none" stroke={halo} strokeWidth={line + 3 * k} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {shape.lines.map((pts, i) => (
            <Polyline key={`l${i}`} points={pts} fill="none" stroke={routeColor} strokeWidth={line} strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </Svg>
      )}
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-around' }}>
          {row.map((key) => {
            const v = statValue(a, key, weightKg);
            return (
              <View key={key} style={{ alignItems: 'center', flex: 1 }}>
                <Text style={[text(10, '700'), { letterSpacing: 1.2 * k, opacity: 0.9 }]} numberOfLines={1}>
                  {t(`sh.${key}` as Key).toUpperCase()}
                </Text>
                <Text style={text(row.length === 3 ? 25 : 30, '900')} numberOfLines={1} adjustsFontSizeToFit>
                  {v.value}{v.unit ? <Text style={text(row.length === 3 ? 12 : 14, '700')}> {v.unit}</Text> : null}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
      {showLogo && <Text style={[text(11, '900'), { letterSpacing: 2.5 * k }]}>TBDI FITTRACK</Text>}
    </View>
  );
});

export default StoryOverlay;
