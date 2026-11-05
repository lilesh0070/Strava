// Share an activity, Strava-style: swipe through styles (the first is a transparent sticker with the clean
// orange route and key stats), then send it to an Instagram story, copy it, save it, or share anywhere.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as MediaLibrary from 'expo-media-library';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, FlatList, Image, Linking, PanResponder, PixelRatio, Platform, Pressable, ScrollView,
  StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { InstagramStory } from '../../../modules/instagram-story';
import { NeuButton, NeuCard, NeuSegmented } from '../../components/Neu';
import ShareCard, { type ShareCardHandle } from '../../components/ShareCard';
import StoryOverlay, { type OverlayTone } from '../../components/StoryOverlay';
import { useT } from '../../lib/i18n';
import { availableStats, defaultStats, type ShareStatKey } from '../../lib/shareStats';
import { activityText } from '../../lib/shareText';
import { getActivity, getProfile } from '../../lib/storage';
import type { Key } from '../../lib/strings';
import { useTheme } from '../../lib/theme';
import { showToast } from '../../lib/toast';
import type { Activity } from '../../lib/types';

// Exports are rendered at 1080 px wide whatever the screen density, so they stay sharp on stories.
const EXPORT_W = 1080 / PixelRatio.get();
const EXPORT_H = (EXPORT_W * 16) / 9;
const SIZES = { s: 0.6, m: 0.78, l: 0.95 } as const;
type Template = { key: 'clear' | 'photo' | 'dark' | 'orange'; label: Key; bg: string | null };
const TEMPLATES: Template[] = [
  { key: 'clear', label: 'sh.tplClear', bg: null }, // transparent sticker, first like Strava's
  { key: 'photo', label: 'sh.tplPhoto', bg: '#111318' },
  { key: 'dark', label: 'sh.tplDark', bg: '#111318' },
  { key: 'orange', label: 'sh.tplOrange', bg: '#F2762E' },
];
type Shot = 'sticker' | 'story' | 'card';
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Facebook App ID for Instagram's direct "add sticker to story" (app.json → expo.extra.facebookAppId). */
const facebookAppId = () => String((Constants.expoConfig?.extra as { facebookAppId?: string } | undefined)?.facebookAppId ?? '').trim();

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

/** Open Instagram, ideally straight on the story camera. */
async function openInstagram(): Promise<boolean> {
  try { await Linking.openURL('instagram://story-camera'); return true; } catch { /* scheme not handled */ }
  try { IntentLauncher.openApplication('com.instagram.android'); return true; } catch { return false; }
}

export default function ShareActivity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { C, F } = useTheme();
  const { t } = useT();
  const { width } = useWindowDimensions();
  const [a, setA] = useState<Activity | null | undefined>(undefined);
  const [weightKg, setWeightKg] = useState(70);
  const [page, setPage] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [showRoute, setShowRoute] = useState(true);
  const [tone, setTone] = useState<OverlayTone>('light');
  const [size, setSize] = useState<keyof typeof SIZES>('m');
  const [stats, setStats] = useState<ShareStatKey[]>([]);
  const [showTitle, setShowTitle] = useState(false);
  const [showLogo, setShowLogo] = useState(true);
  const [pos, setPos] = useState({ fx: 0.5, fy: 0.6 }); // sticker centre as a fraction of the canvas
  const [ovH, setOvH] = useState(0); // sticker height on the photo/colour previews, px
  const [clearH, setClearH] = useState(0); // sticker height on the transparent preview, px
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
      if (x) { setStats(defaultStats(x)); if (!x.segments.some((s) => s.length > 1)) setShowRoute(false); }
    });
    getProfile().then((p) => setWeightKg(p.weightKg || 70));
  }, [id]);

  const PW = Math.min(width - 72, 380), PH = (PW * 16) / 9;
  const dims = useRef({ w: PW, h: PH });
  useEffect(() => { dims.current = { w: PW, h: PH }; }, [PW, PH]);
  const [pan] = useState(() => new Animated.ValueXY());
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
  if (!a) return <Text style={[F.body, { padding: 20 }]}>{t('act.notFound')}</Text>;

  const tpl = TEMPLATES[page];
  const isSticker = tpl.key === 'clear';
  const hasRoute = a.segments.some((s) => s.length > 1);
  const layout = !hasRoute || !showRoute ? 'stats' : stats.length ? 'full' : 'route';
  // the app's orange route everywhere, except on the orange style where it would vanish
  const routeFor = (tp: Template) => (tp.key === 'orange' ? '#FFFFFF' : C.route);
  const overlayProps = { a, layout, tone, stats, showTitle, showLogo, weightKg, routeColor: routeFor(tpl) } as const;
  const sizeK = isSticker ? 0.86 : SIZES[size];

  // ---------- capture ----------
  /** Mount a full-size view off-screen, wait until it is drawn, capture it, unmount it again. */
  const capture = async (kind: Shot, result: 'tmpfile' | 'base64' = 'tmpfile'): Promise<string> => {
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
        { format: png ? 'png' : 'jpg', quality: png ? 1 : 0.92, result });
    } finally { setShot(null); }
  };
  const ready = () => { const r = shotReady.current; shotReady.current = null; r?.(); };
  const mainShot: Shot = isSticker ? 'sticker' : 'story';

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    if (tpl.key === 'photo' && !photo) { pick(false); return; }
    setBusy(true);
    try { await fn(); } catch (e) { Alert.alert(t('sh.failed'), String((e as Error)?.message ?? e)); } finally { setBusy(false); }
  };
  const saveToGallery = async (uri: string) => {
    const perm = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
    if (!perm.granted) throw new Error(t('sh.noPerm'));
    await MediaLibrary.Asset.create(uri);
  };
  const shareSheet = async (uri: string, kind: Shot) =>
    Sharing.shareAsync(uri, { mimeType: kind === 'story' ? 'image/jpeg' : 'image/png', dialogTitle: t('sh.share') });

  /** Strava-style: the sticker lands in Instagram's story editor; without a Facebook App ID we save it and open Instagram. */
  const toInstagram = () => run(async () => {
    const uri = await capture(mainShot);
    if (!isSticker) { // a full story image: Instagram offers "Stories" in the share sheet
      showToast(t('sh.pickStories'), undefined, 4000);
      await shareSheet(uri, 'story');
      return;
    }
    const appId = facebookAppId();
    if (Platform.OS === 'android' && appId && InstagramStory?.isInstagramInstalled()) {
      const contentUri = (new File(uri) as unknown as { contentUri: string }).contentUri;
      if (InstagramStory.shareStickerToStory(contentUri, appId, '#20242C', '#111318')) return;
    }
    await saveToGallery(uri);
    if (await openInstagram()) Alert.alert(`✓ ${t('sh.igSaved')}`, t('sh.igSteps'));
    else Alert.alert(`✓ ${t('sh.igSaved')}`, t('sh.noIg'));
  });
  const copy = () => run(async () => {
    const b64 = await capture(mainShot, 'base64');
    await Clipboard.setImageAsync(b64);
    showToast(`✓ ${t('sh.copied')}`, undefined, 5000);
  });
  /** The run as one block of text (numbers + the route drawn with dots), to paste into a story or chat. */
  const copyText = async () => {
    const keys: ShareStatKey[] = ['distance', 'time', 'pace', 'speed', 'steps', 'elevation', 'calories'];
    const labels = Object.fromEntries(keys.map((k) => [k, t(`sh.${k}` as Key)])) as Record<ShareStatKey, string>;
    const text = activityText(a, {
      stats, labels, weightKg, route: hasRoute && showRoute,
      dateText: new Date(a.startedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
    });
    try {
      await Clipboard.setStringAsync(text);
      showToast(`✓ ${t('sh.copiedText')}`, undefined, 6000);
    } catch (e) { Alert.alert(t('sh.failed'), String((e as Error)?.message ?? e)); }
  };
  const save = () => run(async () => { await saveToGallery(await capture(mainShot)); showToast(`✓ ${t('sh.saved')}`); });
  const more = () => run(async () => { await shareSheet(await capture(mainShot), mainShot); });
  const classic = () => run(async () => { await shareSheet(await capture('card'), 'card'); });

  const pick = async (camera: boolean) => {
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return;
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
      const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!r.canceled && r.assets?.[0]?.uri) { setPhoto(r.assets[0].uri); setTone('light'); }
    } catch (e) { Alert.alert(t('sh.failed'), String((e as Error)?.message ?? e)); }
  };

  const chip = (key: string, label: string, on: boolean, toggle: () => void) => (
    <NeuButton key={key} small label={label} selected={on} onPress={toggle} />
  );
  const toggleStat = (k: ShareStatKey) =>
    setStats((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : availableStats(a).filter((x) => x === k || cur.includes(x))));

  // where the sticker sits on a canvas of a given width (same fractions for preview and export)
  const place = (cw: number, ch: number) => {
    const w = cw * sizeK, h = ovH * (cw / PW);
    return { left: pos.fx * cw - w / 2, top: pos.fy * ch - h / 2, width: w };
  };
  const background = (tp: Template, cw: number, ch: number, onLoaded?: () => void) => (
    tp.key === 'clear' ? <Checkerboard width={cw} height={ch} />
      : tp.key === 'photo' && photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" onLoadEnd={onLoaded} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: tp.bg ?? '#111318' }]} />
  );
  // full-resolution story export: where the sticker goes, and whether to wait for the photo to load
  const storyEx = place(EXPORT_W, EXPORT_H);
  const storyWaitsForPhoto = tpl.key === 'photo' && !!photo;

  const renderPage = ({ item, index }: { item: Template; index: number }) => {
    const prev = place(PW, PH);
    const live = index === page; // only the visible page can be dragged
    const noPhoto = item.key === 'photo' && !photo;
    return (
      <View style={{ width, alignItems: 'center' }}>
        <View style={{ width: PW, height: PH, borderRadius: 24, overflow: 'hidden', backgroundColor: '#111318' }}>
          {background(item, PW, PH)}
          {noPhoto ? (
            <Pressable onPress={() => pick(false)} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 10 }]}>
              <MaterialCommunityIcons name="image-plus" size={48} color="#ffffffcc" />
              <Text style={{ color: '#ffffffcc', fontWeight: '700' }}>{t('sh.addPhoto')}</Text>
            </Pressable>
          ) : item.key === 'clear' ? (
            <View style={{ position: 'absolute', left: (PW - PW * 0.86) / 2, top: PH / 2 - clearH / 2, width: PW * 0.86 }} pointerEvents="none">
              <View onLayout={(e) => setClearH(e.nativeEvent.layout.height)}>
                <StoryOverlay {...overlayProps} routeColor={routeFor(item)} width={PW * 0.86} />
              </View>
            </View>
          ) : (
            <Animated.View {...(live ? responder.panHandlers : {})}
              style={{ position: 'absolute', left: prev.left, top: prev.top, width: PW * SIZES[size], transform: live ? pan.getTranslateTransform() : [] }}>
              <View onLayout={(e) => setOvH(e.nativeEvent.layout.height)} pointerEvents="none">
                <StoryOverlay {...overlayProps} routeColor={routeFor(item)} width={PW * SIZES[size]} />
              </View>
            </Animated.View>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: t('sh.title') }} />
      <ScrollView scrollEnabled={!dragging} contentContainerStyle={{ paddingVertical: 16, gap: 16, paddingBottom: 50 }}>
        {/* swipe through styles */}
        <FlatList
          data={TEMPLATES}
          keyExtractor={(x) => x.key}
          renderItem={renderPage}
          extraData={[photo, showRoute, tone, size, stats, showTitle, showLogo, pos, ovH, clearH, page, C.route]}
          horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          scrollEnabled={!dragging}
          scrollEventThrottle={50}
          onScroll={(e) => {
            const i = clamp(Math.round(e.nativeEvent.contentOffset.x / width), 0, TEMPLATES.length - 1);
            if (i !== page) setPage(i);
          }}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          windowSize={3} initialNumToRender={2}
        />
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {TEMPLATES.map((x, i) => (
              <View key={x.key} style={{ width: i === page ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: i === page ? C.accent : C.faint }} />
            ))}
          </View>
          <Text style={{ color: C.text, fontWeight: '800' }}>{t(tpl.label)}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{isSticker ? t('sh.swipe') : t('sh.drag')}</Text>
        </View>

        {/* actions */}
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <NeuButton accent icon="instagram" label={t('sh.igStory')} disabled={busy} onPress={toInstagram} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <NeuButton small icon="content-copy" label={t('sh.copy')} style={{ flex: 1 }} disabled={busy} onPress={copy} />
            <NeuButton small icon="download" label={t('sh.save')} style={{ flex: 1 }} disabled={busy} onPress={save} />
            <NeuButton small icon="share-variant" label={t('sh.more')} style={{ flex: 1 }} disabled={busy} onPress={more} />
          </View>
          <NeuButton small icon="format-text" label={t('sh.copyText')} disabled={busy} onPress={copyText} />
          {busy && <ActivityIndicator color={C.accent} />}
        </View>

        {/* options */}
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          {tpl.key === 'photo' && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <NeuButton small icon="image-multiple-outline" label={t('sh.gallery')} style={{ flex: 1 }} onPress={() => pick(false)} />
              <NeuButton small icon="camera-outline" label={t('sh.camera')} style={{ flex: 1 }} onPress={() => pick(true)} />
            </View>
          )}
          <NeuCard radius={26} style={{ gap: 12 }}>
            <Text style={F.label}>{t('sh.show')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {hasRoute && chip('route', t('sh.route'), showRoute, () => setShowRoute((v) => !v))}
              {availableStats(a).map((k) => chip(k, t(`sh.${k}` as Key), stats.includes(k), () => toggleStat(k)))}
              {chip('title', t('sh.name'), showTitle, () => setShowTitle((v) => !v))}
              {chip('logo', t('sh.logo'), showLogo, () => setShowLogo((v) => !v))}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={F.label}>{t('sh.text')}</Text>
                <NeuSegmented value={tone} onChange={setTone} options={[{ key: 'light', label: t('sh.white') }, { key: 'dark', label: t('sh.dark') }]} />
              </View>
              {!isSticker && (
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={F.label}>{t('sh.size')}</Text>
                  <NeuSegmented value={size} onChange={setSize} options={[{ key: 's', label: 'S' }, { key: 'm', label: 'M' }, { key: 'l', label: 'L' }]} />
                </View>
              )}
            </View>
          </NeuCard>

          {isSticker && (
            <NeuCard inset radius={22} padding={16} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <MaterialCommunityIcons name="instagram" size={22} color={C.accent} />
                <Text style={{ color: C.text, fontWeight: '800', flex: 1 }}>{t('sh.howTitle')}</Text>
              </View>
              <Text style={{ color: C.muted, lineHeight: 20 }}>{t('sh.how')}</Text>
            </NeuCard>
          )}
          <NeuButton small icon="card-outline" label={t('sh.classic')} disabled={busy} onPress={classic} />
        </View>
      </ScrollView>

      {/* full-resolution views, mounted only while capturing */}
      {shot && (
        <View style={{ position: 'absolute', left: -10000, top: 0 }} pointerEvents="none">
          {shot === 'sticker' && (
            <View onLayout={ready}><StoryOverlay ref={stickerRef} {...overlayProps} width={EXPORT_W} /></View>
          )}
          {shot === 'card' && <View onLayout={ready}><ShareCard ref={cardRef} a={a} /></View>}
          {shot === 'story' && (
            <View ref={storyRef} collapsable={false} onLayout={storyWaitsForPhoto ? undefined : ready}
              style={{ width: EXPORT_W, height: EXPORT_H, overflow: 'hidden', backgroundColor: tpl.bg ?? '#111318' }}>
              {storyWaitsForPhoto
                ? <Image source={{ uri: photo! }} style={StyleSheet.absoluteFill} resizeMode="cover" onLoadEnd={ready} />
                : background(tpl, EXPORT_W, EXPORT_H)}
              <View style={{ position: 'absolute', left: storyEx.left, top: storyEx.top, width: storyEx.width }}>
                <StoryOverlay {...overlayProps} width={storyEx.width} />
              </View>
            </View>
          )}
        </View>
      )}
    </>
  );
}
