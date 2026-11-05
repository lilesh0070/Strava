// Share image with the route on a real map, in two looks:
//  • 'map'  — full-bleed street map, the route in orange, a dark fade at the bottom with the name, date and
//             big numbers (the familiar "story" look);
//  • 'card' — the app's own soft UI: the map in a sunken frame, numbers on a raised panel, the app's colours.
// Tiles are plain <Image>s (OpenStreetMap) under an SVG route, so react-native-view-shot captures them; the
// Leaflet WebView used elsewhere would come out blank. Everything scales with `width`, so the on-screen
// preview and the 1080 px export look the same. Without internet the map is left out and the rest still works.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { Image, PixelRatio, Text, View, type TextStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Polyline, Rect, Stop } from 'react-native-svg';
import { simplify } from '../lib/geo';
import { sportName, useT } from '../lib/i18n';
import { layoutTiles, routeLines, type Rect as Box } from '../lib/mapTiles';
import { statRows, statValue, type ShareStatKey } from '../lib/shareStats';
import type { Key } from '../lib/strings';
import { useTheme } from '../lib/theme';
import { sportInfo, type Activity } from '../lib/types';
import type { ShareCardHandle } from './ShareCard';

export type MapCardVariant = 'map' | 'card';
type Props = {
  a: Activity; width: number; height: number; variant: MapCardVariant; stats: ShareStatKey[];
  showLogo: boolean; weightKg: number;
  /** Called once every tile has loaded or failed (or right away when there are none), so a capture can wait. */
  onReady?: () => void;
};

const BRAND = '#F2762E';
// OpenStreetMap's tile policy asks apps to identify themselves
const UA = `TBDIFitTrack/${Constants.expoConfig?.version ?? '1'} (+https://github.com/lilesh0070/Strava)`;

const MapShareCard = forwardRef<ShareCardHandle, Props>(function MapShareCard(
  { a, width, height, variant, stats, showLogo, weightKg, onReady }, ref) {
  const { C, S } = useTheme();
  const { t } = useT();
  const k = width / 360; // design unit
  const info = sportInfo(a.sport);
  const segs = useMemo(() => a.segments.filter((s) => s.length > 1).map((s) => simplify(s, 2)), [a.segments]);
  const rows = statRows(stats.length ? stats : (['distance', 'time'] as ShareStatKey[]));
  const date = new Date(a.startedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  // ---------- geometry ----------
  const pad = 22 * k;
  const statsH = rows.length * 64 * k + 28 * k;
  // 'card': the map frame sits between the header and the stats panel
  const frame: Box = variant === 'card'
    ? { x: pad, y: pad + 46 * k + 18 * k, w: width - 2 * pad, h: height - 2 * pad - 46 * k - 18 * k - statsH - 18 * k - 40 * k }
    : { x: 0, y: 0, w: width, h: height };
  const inset = variant === 'card' ? 6 * k : 0; // the map inside the sunken frame
  const mapBox: Box = { x: 0, y: 0, w: frame.w - 2 * inset, h: frame.h - 2 * inset };
  // where the route is fitted: the upper part of a 'map' story (the lower part is the fade with the numbers)
  const fit: Box = variant === 'map' ? { x: 26 * k, y: height * 0.14, w: width - 52 * k, h: height * 0.44 } : { x: 0, y: 0, w: mapBox.w, h: mapBox.h };
  const tiles = useMemo(
    () => (segs.length ? layoutTiles(segs.flat(), { w: mapBox.w, h: mapBox.h }, fit, PixelRatio.get(), { pad: variant === 'map' ? 0.06 : 0.14 }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segs, mapBox.w, mapBox.h, fit.x, fit.y, fit.w, fit.h, variant],
  );
  const lines = useMemo(() => (tiles ? routeLines(segs, tiles.project) : []), [tiles, segs]);
  const first = tiles && segs.length ? tiles.project(segs[0][0].lat, segs[0][0].lng) : null;
  const lastSeg = segs[segs.length - 1];
  const last = tiles && lastSeg ? tiles.project(lastSeg[lastSeg.length - 1].lat, lastSeg[lastSeg.length - 1].lng) : null;

  // ---------- ready when every tile has settled ----------
  const settled = useRef(new Set<string>());
  const fired = useRef(false);
  const total = tiles?.tiles.length ?? 0;
  const settle = (key: string) => {
    settled.current.add(key);
    if (!fired.current && settled.current.size >= total) { fired.current = true; onReady?.(); }
  };
  useEffect(() => {
    settled.current = new Set();
    fired.current = false;
    if (total === 0) { fired.current = true; onReady?.(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles]);

  const light = variant === 'map' || C.scheme === 'light';
  const wash = variant === 'map' ? 'rgba(236,239,243,0.38)' : light ? 'rgba(233,237,243,0.42)' : 'rgba(38,42,49,0.55)';
  const casing = variant === 'map' ? '#FFFFFF' : C.bg;
  const route = variant === 'map' ? BRAND : C.route;

  const map = (
    <View style={{ width: mapBox.w, height: mapBox.h, overflow: 'hidden', backgroundColor: light ? '#E4E8EE' : '#2B3038' }}>
      {tiles?.tiles.map((tl) => (
        <Image key={tl.key} source={{ uri: tl.url, headers: { 'User-Agent': UA } }} fadeDuration={0}
          onLoadEnd={() => settle(tl.key)} onError={() => settle(tl.key)}
          style={{ position: 'absolute', left: tl.left, top: tl.top, width: tiles.size + 0.5, height: tiles.size + 0.5 }} />
      ))}
      <View style={{ position: 'absolute', left: 0, top: 0, width: mapBox.w, height: mapBox.h, backgroundColor: wash }} />
      {lines.length > 0 && (
        <Svg width={mapBox.w} height={mapBox.h} style={{ position: 'absolute', left: 0, top: 0 }}>
          {lines.map((pts, i) => (
            <Polyline key={`c${i}`} points={pts} fill="none" stroke={casing} strokeOpacity={0.9} strokeWidth={7.5 * k} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {lines.map((pts, i) => (
            <Polyline key={`r${i}`} points={pts} fill="none" stroke={route} strokeWidth={4.5 * k} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {first && <Circle cx={first[0]} cy={first[1]} r={5.5 * k} fill="#FFFFFF" stroke={route} strokeWidth={2.5 * k} />}
          {last && <Circle cx={last[0]} cy={last[1]} r={5.5 * k} fill={route} stroke="#FFFFFF" strokeWidth={2.5 * k} />}
        </Svg>
      )}
      {tiles && (
        <Text style={{ position: 'absolute', right: 6 * k, top: variant === 'map' ? 8 * k : undefined, bottom: variant === 'map' ? undefined : 5 * k,
          fontSize: 8 * k, color: light ? '#4A5260' : '#C9CED8', opacity: 0.85 }}>© OpenStreetMap</Text>
      )}
    </View>
  );

  const stat = (key: ShareStatKey, n: number, onDark: boolean) => {
    const v = statValue(a, key, weightKg);
    const fg = onDark ? '#FFFFFF' : C.text, sub = onDark ? 'rgba(255,255,255,0.78)' : C.muted;
    const big = (n === 1 ? 40 : n === 2 ? 34 : 26) * k;
    return (
      <View key={key} style={{ flex: 1, alignItems: variant === 'map' ? 'flex-start' : 'center' }}>
        <Text style={{ color: sub, fontSize: 12 * k, fontWeight: '700', letterSpacing: 0.6 * k }} numberOfLines={1}>{t(`sh.${key}` as Key)}</Text>
        <Text style={{ color: fg, fontSize: big, fontWeight: '900', fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
          {v.value}{v.unit ? <Text style={{ fontSize: big * 0.48, fontWeight: '800', color: fg }}> {v.unit}</Text> : null}
        </Text>
      </View>
    );
  };

  if (variant === 'map') {
    const txt = (size: number, weight: TextStyle['fontWeight'], color = '#FFFFFF'): TextStyle => ({ color, fontSize: size * k, fontWeight: weight });
    return (
      <View ref={ref} collapsable={false} style={{ width, height, overflow: 'hidden', backgroundColor: '#111318' }}>
        {map}
        {/* the fade that carries the text: clear over the route, dark at the bottom */}
        <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#111318" stopOpacity={0.18} />
              <Stop offset="0.12" stopColor="#111318" stopOpacity={0} />
              <Stop offset="0.55" stopColor="#111318" stopOpacity={0} />
              <Stop offset="0.72" stopColor="#111318" stopOpacity={0.8} />
              <Stop offset="1" stopColor="#111318" stopOpacity={0.97} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#fade)" />
        </Svg>
        <View style={{ position: 'absolute', left: 28 * k, right: 28 * k, bottom: 30 * k, gap: 18 * k }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k }}>
            <View style={{ width: 44 * k, height: 44 * k, borderRadius: 14 * k, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name={info.icon as never} size={26 * k} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={txt(26, '900')} numberOfLines={1} adjustsFontSizeToFit>{a.name}</Text>
              <Text style={txt(13, '600', 'rgba(255,255,255,0.78)')} numberOfLines={1}>{sportName(t, a.sport)} · {date}</Text>
            </View>
          </View>
          {rows.map((row, r) => <View key={r} style={{ flexDirection: 'row', gap: 12 * k }}>{row.map((key) => stat(key, row.length, true))}</View>)}
          {showLogo && (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Text style={{ color: BRAND, fontSize: 20 * k, fontWeight: '900', letterSpacing: 2.5 * k }}>TBDI FITTRACK</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // 'card': the app's own look
  return (
    <View ref={ref} collapsable={false} style={{ width, height, padding: pad, backgroundColor: C.bg, gap: 18 * k }}>
      <View style={{ height: 46 * k, flexDirection: 'row', alignItems: 'center', gap: 12 * k }}>
        <View style={{ width: 46 * k, height: 46 * k, borderRadius: 16 * k, backgroundColor: C.bg, boxShadow: S.well, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name={info.icon as never} size={22 * k} color={C.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 19 * k, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>{a.name}</Text>
          <Text style={{ color: C.muted, fontSize: 12 * k }} numberOfLines={1}>{sportName(t, a.sport)} · {date}</Text>
        </View>
      </View>
      <View style={{ width: frame.w, height: frame.h, borderRadius: 28 * k, padding: inset, backgroundColor: C.bg, boxShadow: S.inset }}>
        <View style={{ flex: 1, borderRadius: 22 * k, overflow: 'hidden' }}>{map}</View>
      </View>
      <View style={{ height: statsH, borderRadius: 26 * k, paddingVertical: 14 * k, paddingHorizontal: 10 * k, backgroundColor: C.bg, boxShadow: S.raised, justifyContent: 'space-around' }}>
        {rows.map((row, r) => <View key={r} style={{ flexDirection: 'row' }}>{row.map((key) => stat(key, row.length, false))}</View>)}
      </View>
      <View style={{ height: 40 * k, alignItems: 'center', justifyContent: 'center' }}>
        {showLogo && <Text style={{ color: C.accentInk, fontWeight: '900', letterSpacing: 2.5 * k, fontSize: 14 * k }}>TBDI FITTRACK</Text>}
        <Text style={{ color: C.muted, fontSize: 10 * k }}>{t('sh.tagline')}</Text>
      </View>
    </View>
  );
});

export default MapShareCard;
