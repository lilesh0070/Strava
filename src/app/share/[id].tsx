// Share an activity anywhere: as a transparent sticker (orange route + stats) to drop on top of an
// Instagram story photo or video, or as a ready 9:16 story with the sticker placed over your own photo.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, PanResponder, PixelRatio, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { NeuButton, NeuCard, NeuSegmented } from '../../components/Neu';
import ShareCard, { type ShareCardHandle } from '../../components/ShareCard';
import StoryOverlay, { type OverlayLayout, type OverlayTone } from '../../components/StoryOverlay';
import { useT } from '../../lib/i18n';
import { availableStats, defaultStats, type ShareStatKey } from '../../lib/shareStats';
import { getActivity, getProfile } from '../../lib/storage';
import type { Key } from '../../lib/strings';
import { useTheme } from '../../lib/theme';
import { showToast } from '../../lib/toast';
import type { Activity } from '../../lib/types';

// Exports are rendered at 1080 px wide whatever the screen density, so they stay sharp on stories.
const EXPORT_W = 1080 / PixelRatio.get();
const EXPORT_H = (EXPORT_W * 16) / 9;
const SIZES = { s: 0.6, m: 0.78, l: 0.95 } as const;
const COLORS = ['#111318', '#F2762E', '#1D3557', '#E9EDF3'];
const LIGHT_BG = '#E9EDF3';
type Bg = 'none' | 'photo' | 'color';
type Shot = 'sticker' | 'story' | 'card';
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Shows where the sticker will be transparent (preview only, never exported). */
function Checkerboard({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="chk" width={24} height={24} patternUnits="userSpaceOnUse">
          <Rect width={24} height={24} fill="#3A3F4A" />
          <Rect width={12} height={12} fill="#2C3038" />
          <Rect x={12} y={12} width={12} height={12} fill="#2C3038" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#chk)" />
    </Svg>
  );
}

export default function ShareActivity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { C, F } = useTheme();
  const { t } = useT();
  const { width } = useWindowDimensions();
  const [a, setA] = useState<Activity | null | undefined>(undefined);
  const [weightKg, setWeightKg] = useState(70);
  const [bg, setBg] = useState<Bg>('none');
  const [photo, setPhoto] = useState<string | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [layout, setLayout] = useState<OverlayLayout>('full');
  const [tone, setTone] = useState<OverlayTone>('light');
  const [size, setSize] = useState<keyof typeof SIZES>('m');
  const [stats, setStats] = useState<ShareStatKey[]>([]);
  const [showTitle, setShowTitle] = useState(false);
  const [showLogo, setShowLogo] = useState(true);
  const [pos, setPos] = useState({ fx: 0.5, fy: 0.6 }); // sticker centre as a fraction of the canvas
  const [ovH, setOvH] = useState(0); // sticker height on the preview, px
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null); // which full-size view is mounted off-screen right now
  const shotReady = useRef<(() => void) | null>(null);
  const stickerRef = useRef<ShareCardHandle>(null);
  const storyRef = useRef<ShareCardHandle>(null);
  const cardRef = useRef<ShareCardHandle>(null);

  useEffect(() => {
    getActivity(id).then((x) => {
      setA(x);
      if (x) { setStats(defaultStats(x)); if (!x.segments.some((s) => s.length > 1)) setLayout('stats'); }
    });
    getProfile().then((p) => setWeightKg(p.weightKg || 70));
  }, [id]);

  const PW = Math.min(width - 40, 420), PH = (PW * 16) / 9;
  const dims = useRef({ w: PW, h: PH });
  dims.current = { w: PW, h: PH };
  const pan = useRef(new Animated.ValueXY()).current;
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => setDragging(true),
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      setPos((p) => ({ fx: clamp(p.fx + g.dx / dims.current.w, 0.08, 0.92), fy: clamp(p.fy + g.dy / dims.current.h, 0.06, 0.94) }));
      pan.setValue({ x: 0, y: 0 });
      setDragging(false);
    },
    onPanResponderTerminate: () => { pan.setValue({ x: 0, y: 0 }); setDragging(false); },
  }), [pan]);

  if (a === undefined) return <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />;
  if (!a) return <Text style={[F.body, { padding: 20 }]}>Activity not found.</Text>;

  const hasRoute = a.segments.some((s) => s.length > 1);
  const overlayProps = { a, layout, tone, stats, showTitle, showLogo, weightKg, routeColor: C.route };
  const ow = PW * SIZES[size];
  const isPng = bg === 'none';

  /** Mount a full-size view off-screen, wait until it is drawn, capture it, unmount it again. */
  const capture = async (kind: Shot): Promise<string> => {
    // never hang: if an image fails to report it loaded, capture what is there after 4 s
    await Promise.race([
      new Promise<void>((resolve) => { shotReady.current = resolve; setShot(kind); }),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
    await new Promise((r) => setTimeout(r, 120)); // let SVG and images paint
    const ref = kind === 'sticker' ? stickerRef : kind === 'card' ? cardRef : storyRef;
    const png = kind !== 'story';
    try {
      return await captureRef(ref as unknown as Parameters<typeof captureRef>[0],
        { format: png ? 'png' : 'jpg', quality: png ? 1 : 0.92, result: 'tmpfile' });
    } finally { setShot(null); }
  };
  const ready = () => { const r = shotReady.current; shotReady.current = null; r?.(); };

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { Alert.alert(t('sh.failed'), String((e as Error)?.message ?? e)); } finally { setBusy(false); }
  };
  const share = (kind: Shot) => run(async () => {
    const uri = await capture(kind);
    await Sharing.shareAsync(uri, { mimeType: kind === 'story' ? 'image/jpeg' : 'image/png', dialogTitle: t('sh.share') });
  });
  const save = (kind: Shot) => run(async () => {
    const perm = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
    if (!perm.granted) { Alert.alert(t('sh.noPerm')); return; }
    const uri = await capture(kind);
    await MediaLibrary.Asset.create(uri);
    showToast(`✓ ${t('sh.saved')}`);
  });

  const pick = async (camera: boolean) => {
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return;
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
      const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!r.canceled && r.assets?.[0]?.uri) { setPhoto(r.assets[0].uri); setBg('photo'); setTone('light'); }
    } catch (e) { Alert.alert(t('sh.failed'), String((e as Error)?.message ?? e)); }
  };

  const chip = (key: string, label: string, on: boolean, toggle: () => void) => (
    <NeuButton key={key} small label={label} selected={on} onPress={toggle} />
  );
  const toggleStat = (k: ShareStatKey) =>
    setStats((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : availableStats(a).filter((x) => x === k || cur.includes(x))));

  // where the sticker sits on a canvas of a given width (same fractions for preview and export)
  const place = (cw: number, ch: number) => {
    const w = cw * SIZES[size], h = ovH * (cw / PW);
    return { left: pos.fx * cw - w / 2, top: pos.fy * ch - h / 2, width: w };
  };
  const background = (onLoaded?: () => void) => (
    bg === 'photo' && photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" onLoadEnd={onLoaded} />
      : bg === 'color' ? <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />
        : <Checkerboard width={PW} height={PH} />
  );
  const prev = place(PW, PH);

  return (
    <>
      <Stack.Screen options={{ title: t('sh.title') }} />
      <ScrollView scrollEnabled={!dragging} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 50 }}>
        {/* live preview */}
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: PW, height: PH, borderRadius: 24, overflow: 'hidden', backgroundColor: '#111318' }}>
            {background()}
            <Animated.View {...responder.panHandlers}
              style={{ position: 'absolute', left: prev.left, top: prev.top, width: ow, transform: pan.getTranslateTransform() }}>
              <View onLayout={(e) => setOvH(e.nativeEvent.layout.height)} pointerEvents="none">
                <StoryOverlay {...overlayProps} width={ow} />
              </View>
            </Animated.View>
          </View>
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>{t('sh.drag')}</Text>
        </View>

        {/* actions */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <NeuButton accent icon="share-variant" label={t('sh.share')} style={{ flex: 1 }} disabled={busy}
            onPress={() => share(isPng ? 'sticker' : 'story')} />
          <NeuButton icon="download" label={isPng ? t('sh.saveSticker') : t('sh.save')} style={{ flex: 1 }} disabled={busy}
            onPress={() => save(isPng ? 'sticker' : 'story')} />
        </View>
        {!isPng && (
          <NeuButton small icon="sticker-outline" label={t('sh.saveSticker')} disabled={busy} onPress={() => save('sticker')} />
        )}
        {busy && <ActivityIndicator color={C.accent} />}

        {/* options */}
        <NeuCard radius={26} style={{ gap: 12 }}>
          <Text style={F.label}>{t('sh.bg')}</Text>
          <NeuSegmented value={bg} onChange={(v) => { if (v === 'photo' && !photo) pick(false); else setBg(v); }}
            options={[{ key: 'none', label: t('sh.bgNone'), icon: 'sticker-outline' }, { key: 'photo', label: t('sh.bgPhoto'), icon: 'image-outline' },
              { key: 'color', label: t('sh.bgColor'), icon: 'palette-outline' }]} />
          {bg === 'photo' && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <NeuButton small icon="image-multiple-outline" label={t('sh.gallery')} style={{ flex: 1 }} onPress={() => pick(false)} />
              <NeuButton small icon="camera-outline" label={t('sh.camera')} style={{ flex: 1 }} onPress={() => pick(true)} />
            </View>
          )}
          {bg === 'color' && (
            <View style={{ flexDirection: 'row', gap: 14, justifyContent: 'center' }}>
              {COLORS.map((c) => (
                <Pressable key={c} accessibilityRole="button" accessibilityLabel={c} accessibilityState={{ selected: color === c }}
                  onPress={() => { setColor(c); setTone(c === LIGHT_BG ? 'dark' : 'light'); }}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, borderWidth: color === c ? 3 : 1, borderColor: color === c ? C.accent : C.faint }} />
              ))}
            </View>
          )}
          {hasRoute && (
            <>
              <Text style={F.label}>{t('sh.layout')}</Text>
              <NeuSegmented value={layout} onChange={setLayout}
                options={[{ key: 'full', label: t('sh.full') }, { key: 'stats', label: t('sh.stats') }, { key: 'route', label: t('sh.route') }]} />
            </>
          )}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={F.label}>{t('sh.text')}</Text>
              <NeuSegmented value={tone} onChange={setTone} options={[{ key: 'light', label: t('sh.white') }, { key: 'dark', label: t('sh.dark') }]} />
            </View>
            {bg !== 'none' && (
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={F.label}>{t('sh.size')}</Text>
                <NeuSegmented value={size} onChange={setSize} options={[{ key: 's', label: 'S' }, { key: 'm', label: 'M' }, { key: 'l', label: 'L' }]} />
              </View>
            )}
          </View>
          {layout !== 'route' && (
            <>
              <Text style={F.label}>{t('sh.show')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {availableStats(a).map((k) => chip(k, t(`sh.${k}` as Key), stats.includes(k), () => toggleStat(k)))}
                {chip('title', t('sh.name'), showTitle, () => setShowTitle((v) => !v))}
                {chip('logo', t('sh.logo'), showLogo, () => setShowLogo((v) => !v))}
              </View>
            </>
          )}
        </NeuCard>

        {isPng && (
          <NeuCard inset radius={22} padding={16} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <MaterialCommunityIcons name="instagram" size={22} color={C.accent} />
              <Text style={{ color: C.text, fontWeight: '800', flex: 1 }}>{t('sh.howTitle')}</Text>
            </View>
            <Text style={{ color: C.muted, lineHeight: 20 }}>{t('sh.how')}</Text>
          </NeuCard>
        )}
        <NeuButton small icon="card-outline" label={t('sh.classic')} disabled={busy} onPress={() => share('card')} />
      </ScrollView>

      {/* full-resolution views, mounted only while capturing */}
      {shot && (
        <View style={{ position: 'absolute', left: -10000, top: 0 }} pointerEvents="none">
          {shot === 'sticker' && (
            <View onLayout={ready}><StoryOverlay ref={stickerRef} {...overlayProps} width={EXPORT_W} /></View>
          )}
          {shot === 'card' && <View onLayout={ready}><ShareCard ref={cardRef} a={a} /></View>}
          {shot === 'story' && (() => {
            const ex = place(EXPORT_W, EXPORT_H);
            const waitForPhoto = bg === 'photo' && !!photo;
            return (
              <View ref={storyRef} collapsable={false} onLayout={waitForPhoto ? undefined : ready}
                style={{ width: EXPORT_W, height: EXPORT_H, overflow: 'hidden', backgroundColor: '#111318' }}>
                {background(waitForPhoto ? ready : undefined)}
                <View style={{ position: 'absolute', left: ex.left, top: ex.top, width: ex.width }}>
                  <StoryOverlay {...overlayProps} width={ex.width} />
                </View>
              </View>
            );
          })()}
        </View>
      )}
    </>
  );
}
