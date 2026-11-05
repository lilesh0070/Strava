import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, Animated, AppState, LayoutAnimation, Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconWell, NeuButton, NeuCard, NeuIconButton, NeuProgress } from '../../components/Neu';
import RouteMap from '../../components/RouteMap';
import SettingsButton from '../../components/SettingsButton';
import Stat from '../../components/Stat';
import { fmtDuration, fmtKm, fmtPace, fmtSpeed, totalDistance } from '../../lib/geo';
import { fmtSteps, isOnFoot } from '../../lib/steps';
import { gpsHealth } from '../../lib/live';
import { newlyEarned } from '../../lib/achievements';
import { newRecords } from '../../lib/records';
import { getProfile, getSettings, listActivities, updateSettings } from '../../lib/storage';
import { useActivities } from '../../lib/useActivities';
import { mondayOf } from '../../lib/coach';
import { showToast } from '../../lib/toast';
import { celebrate } from '../../lib/celebrate';
import { useSelectedWorkout } from '../../lib/workoutSelection';
import { findWorkout, remaining, stepKey } from '../../lib/workouts';
import { useTheme } from '../../lib/theme';
import * as tracker from '../../lib/tracker';
import { SPORTS, sessionMovingSec, sportInfo, workoutSec, type Sport } from '../../lib/types';
import { badgeTitle, prLabel, sportName, useT } from '../../lib/i18n';

// Snapshot changes identity on every tracker notification so React re-renders.
let version = 0;
tracker.subscribe(() => { version++; });
const useTracker = () => {
  useSyncExternalStore(tracker.subscribe, () => version);
  return { session: tracker.getSession(), fix: tracker.getLastFix() };
};

function KeepAwake() { useKeepAwake(); return null; }
/** Stable empty route, so the map doesn't redraw every second before Start. */
const NO_SEGMENTS: never[] = [];
const MAP_STYLE = { flex: 1, borderRadius: 26 } as const;
/** Animate the next layout change (picker ↔ countdown ↔ live stats) instead of snapping. */
const ease = () => LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));

/** The 3-2-1 digit: each new number springs in. */
function CountdownDigit({ n, color }: { n: number; color: string }) {
  const [scale] = useState(() => new Animated.Value(1.5));
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    scale.setValue(1.5); opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 120 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [n, scale, opacity]);
  return (
    <Animated.Text style={{ fontSize: 60, fontWeight: '900', color, transform: [{ scale }], opacity }} maxFontSizeMultiplier={1.2}>{n}</Animated.Text>
  );
}

/** Soft pulsing ring behind Start while GPS is ready. */
function ReadyGlow({ on, color, size }: { on: boolean; color: string; size: number }) {
  const [o] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!on) { Animated.timing(o, { toValue: 0, duration: 300, useNativeDriver: true }).start(); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.12, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [on, o]);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size + 22, height: size + 22, borderRadius: (size + 22) / 2, backgroundColor: color, opacity: o }} />;
}

export default function Record() {
  const { C, S, F } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { session, fix } = useTracker();
  const [sport, setSportState] = useState<Sport>('run');
  // the sport picked last time is remembered, so Start is one tap after opening the tab
  useEffect(() => { getSettings().then((s) => { if (s.lastSport) setSportState(s.lastSport); }).catch(() => undefined); }, []);
  const setSport = (s: Sport) => { setSportState(s); updateSettings({ lastSport: s }).catch(() => undefined); };
  const [now, setNow] = useState(Date.now);
  /** What the screen is busy with: the buttons show it instead of looking frozen. */
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'saving'>('idle');
  // targets for this activity and the weekly goal, for the progress bars under the live stats
  const [targets, setTargets] = useState<{ distM: number | null; timeSec: number | null }>({ distM: null, timeSec: null });
  const [weeklyGoalKm, setWeeklyGoalKm] = useState(0);
  const { items, loadedAt } = useActivities();
  useEffect(() => {
    getSettings().then((s) => setTargets({ distM: s.targetDistanceM, timeSec: s.targetTimeSec })).catch(() => undefined);
    getProfile().then((p) => setWeeklyGoalKm(p.weeklyGoalKm)).catch(() => undefined);
  }, [session?.startedAt]);
  const weekKmBefore = useMemo(() => {
    const ws = mondayOf(loadedAt);
    return (items ?? []).filter((a) => a.startedAt >= ws).reduce((s, a) => s + a.distanceM, 0) / 1000;
  }, [items, loadedAt]);
  const [perm, setPerm] = useState<tracker.PermissionResult | 'unasked' | null>(null);
  const [mapOffline, setMapOffline] = useState(false);
  const [precision, setPrecision] = useState<tracker.Precision>('precise');
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const [countdown, setCountdown] = useState<number | null>(null);
  const selectedWorkout = useSelectedWorkout();
  const cdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const starting = useRef(false); // Start pressed and not finished yet (permission check / countdown)

  // (an in-progress session is restored at app start, in the root layout)
  useEffect(() => () => { if (cdTimer.current) clearInterval(cdTimer.current); }, []);

  // live clock + GPS watchdog while recording
  const recording = !!session;
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      // nobody sees the screen in the background: skip the re-render (and map redraw), keep the workout ticking
      if (AppState.currentState === 'active') setNow(Date.now());
      tracker.workoutTick();
      tracker.watchdog();
    }, 1000);
    return () => clearInterval(id);
  }, [recording]);

  // show current position while this tab is focused (the tracker pauses this GPS whenever the app
  // is in the background or a recording runs); re-render every second so the GPS chip turns to
  // "Finding GPS…" as soon as fixes stop instead of showing a stale accuracy
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const checkPrecision = () => tracker.locationPrecision().then((p) => { if (!cancelled) setPrecision(p); });
    // No OS dialog just for opening the tab: when permission was never asked, a card in the map explains and
    // offers it. "While using the app" is all a recording needs, also with the screen off (the tracker starts
    // it from the open app), so "Allow all the time" is never asked.
    const check = () => tracker.permissionStatus().then((st) => {
      if (cancelled) return;
      if (st !== 'granted') { setPerm(st === 'denied' ? 'denied' : 'unasked'); return; }
      // already granted: no request, so an Android user who kept "Approximate" is not shown the upgrade
      // dialog again every time the app comes back to the front
      setPerm('granted');
      checkPrecision();
      tracker.setWarmUp(true);
    });
    check();
    const id = setInterval(() => { if (!tracker.getSession()) setNow(Date.now()); }, 1000);
    // back from system settings: the user may have just allowed location or turned on precise location
    const app = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => { cancelled = true; tracker.setWarmUp(false); clearInterval(id); app.remove(); };
  }, []));
  const allowLocation = async () => {
    const p = await tracker.ensurePermissions();
    setPerm(p);
    if (p === 'denied') return;
    tracker.locationPrecision().then(setPrecision).catch(() => undefined);
    tracker.setWarmUp(true);
  };

  const active = session ?? null;
  const info = sportInfo(active?.sport ?? sport);
  // running total kept by the tracker: no need to re-measure the whole route every second
  const dist = active ? (active.distanceM ?? totalDistance(active.segments)) : 0;
  const moving = active ? sessionMovingSec(active, now) : 0;
  // age from when the fix arrived, not its GPS timestamp, so a skewed GPS clock can't fake a signal
  const health = gpsHealth(fix ? { ...fix, t: tracker.getLastFixAt() } : null, now);
  const gpsOk = health === 'good' && precision === 'precise';
  // the recording runs on the fallback GPS watcher (its screen-off location task couldn't start yet): it gets no
  // fixes while the app is off screen, until the tracker moves it to the task
  const onWatcher = !!active && tracker.trackingMode() === 'watcher';
  const cur = tracker.steadySpeed(); // held steady: no flicker at a constant pace
  const laps = active?.laps ?? [];
  // the open lap always starts at the last press, so the display changes the moment Lap is tapped
  const lastMark = laps[laps.length - 1] ?? { distanceM: 0, movingSec: 0 };
  const openLap = { distanceM: Math.max(0, dist - lastMark.distanceM), durationSec: Math.max(0, moving - lastMark.movingSec) };

  const begin = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    ease();
    try { await tracker.start(sport, selectedWorkout); } finally { starting.current = false; setPhase('idle'); }
  };

  /** Ask for precise location / location on. Resolves true when recording may go ahead. */
  const fixPrecision = async (): Promise<boolean> => {
    const pr = await tracker.improvePrecision();
    setPrecision(pr);
    if (pr === 'precise') return true;
    return new Promise<boolean>((resolve) => Alert.alert(
      pr === 'off' ? t('rec.locOffTitle') : t('rec.approxTitle'),
      pr === 'off' ? t('rec.locOffBody') : t('rec.approxBody'),
      [
        { text: t('rec.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('rec.openSettings'), onPress: () => { Linking.openSettings(); resolve(false); } },
        ...(pr === 'approximate' ? [{ text: t('rec.anyway'), onPress: () => resolve(true) }] : []),
      ],
    ));
  };

  const onStart = async () => {
    if (starting.current) return; // ignore double taps (and a second countdown)
    starting.current = true;
    setPhase('preparing');
    let countdownOn: boolean;
    try {
      if (!(await prepareStart())) { starting.current = false; setPhase('idle'); return; }
      countdownOn = (await getSettings()).countdown;
    } catch { starting.current = false; setPhase('idle'); return; }
    if (!countdownOn) return begin();
    setPhase('idle');
    let n = 3;
    ease();
    setCountdown(n);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    cdTimer.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (cdTimer.current) clearInterval(cdTimer.current);
        cdTimer.current = null;
        ease();
        setCountdown(null);
        begin();
      } else {
        setCountdown(n);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      }
    }, 1000);
  };

  /** Permission, precision and GPS-quality checks before recording. Resolves false if it should not start yet. */
  const prepareStart = async () => {
    // permission may have changed in system Settings since this tab was focused
    let p = perm;
    let pr = precision;
    if (p !== 'granted') {
      p = await tracker.ensurePermissions();
      setPerm(p);
      // first grant happens right here: precision was never read (and the user may have picked Approximate)
      if (p === 'granted') {
        pr = await tracker.locationPrecision();
        setPrecision(pr);
        tracker.setWarmUp(true);
      }
    }
    if (p === 'denied') {
      Alert.alert(t('rec.locNeededTitle'), t('rec.locNeededBody'), [
        { text: t('rec.cancel'), style: 'cancel' }, { text: t('rec.openSettings'), onPress: () => Linking.openSettings() },
      ]);
      return false;
    }
    if (pr !== 'precise' && !(await fixPrecision())) return false;
    if (health !== 'good' && pr === 'precise') {
      const go = await new Promise<boolean>((resolve) => Alert.alert(
        health === 'lost' ? t('rec.noGpsTitle') : t('rec.weakTitle'),
        t('rec.weakBody'),
        [{ text: t('rec.wait'), style: 'cancel', onPress: () => resolve(false) }, { text: t('rec.anyway'), onPress: () => resolve(true) }],
        { cancelable: true, onDismiss: () => resolve(false) },
      ));
      if (!go) return false;
    }
    // step counter: the "Physical activity" permission is asked once, on the first walk or run
    if (isOnFoot(sport)) await tracker.ensureStepPermission();
    return true;
  };

  const cancelCountdown = () => {
    if (cdTimer.current) clearInterval(cdTimer.current);
    cdTimer.current = null;
    ease();
    setCountdown(null);
    starting.current = false;
  };

  /** Throw the recording away, with a few seconds to change your mind. */
  const discard = async () => {
    ease();
    await tracker.discard();
    showToast(t('rec.discarded'), { label: t('toast.undo'), run: () => { ease(); tracker.undoDiscard().catch(() => undefined); } }, tracker.UNDO_DISCARD_MS);
  };

  const save = async () => {
    if (phase !== 'idle') return;
    setPhase('saving');
    const before = await listActivities().catch(() => []);
    let a;
    try { a = await tracker.finish(); }
    catch (e) {
      setPhase('idle');
      // the recording is kept (paused), so the user can try again
      Alert.alert(t('rec.saveFailed'), `${t('rec.saveFailedBody')}\n\n${String((e as Error)?.message ?? e)}`);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    ease();
    setPhase('idle');
    if (!a) return;
    router.push(`/activity/${a.id}`);
    celebrate([
      ...newRecords(before, a).map((r) => ({ kind: 'pr' as const, title: prLabel(t, r),
        value: r.kind === 'effort' ? fmtDuration(r.value) : r.kind === 'longest' ? `${fmtKm(r.value)} km` : `${Math.round(r.value)} m` })),
      ...newlyEarned(before, a).map((b) => ({ kind: 'badge' as const, title: badgeTitle(t, b.id), icon: b.icon })),
    ]);
  };

  const onFinish = () => {
    Alert.alert(t('rec.finishQ'), undefined, [
      { text: t('rec.resume'), style: 'cancel', onPress: () => { ease(); tracker.resume(); } },
      { text: t('rec.discard'), style: 'destructive', onPress: discard },
      { text: t('rec.save'), onPress: save },
    ]);
  };

  const pill = (children: ReactNode) => (
    <View style={{ backgroundColor: C.bg, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, boxShadow: S.raisedSm,
      flexDirection: 'row', alignItems: 'center', gap: 8 }}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {active?.status === 'recording' && <KeepAwake />}

      <View style={{ flex: 1, margin: 16, marginTop: insets.top + 8, borderRadius: 32, padding: 6, backgroundColor: C.bg, boxShadow: S.inset }}>
        <RouteMap segments={active?.segments ?? NO_SEGMENTS} current={fix} follow paused={!focused} style={MAP_STYLE}
          onTiles={(s) => setMapOffline(s === 'offline')} />
        {perm === 'unasked' && !active && (
          <View style={{ position: 'absolute', left: 24, right: 24, top: '30%', alignItems: 'center' }}>
            <NeuCard radius={26} style={{ alignItems: 'center', gap: 12, width: '100%' }}>
              <IconWell icon="map-marker-radius-outline" />
              <Text style={{ color: C.text, textAlign: 'center', fontWeight: '600' }}>{t('rec.locWhy')}</Text>
              <NeuButton accent small icon="crosshairs-gps" label={t('rec.allowLoc')} onPress={allowLocation} />
            </NeuCard>
          </View>
        )}
        <View style={{ position: 'absolute', top: 16, left: 16, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable disabled={precision === 'precise' && perm !== 'denied'} accessibilityRole="button"
            onPress={() => { if (perm === 'denied') Linking.openSettings().catch(() => undefined); else fixPrecision(); }}>
            {pill(<>
              <View style={{ width: 9, height: 9, borderRadius: 5,
                backgroundColor: precision === 'off' || perm === 'denied' ? C.danger : gpsOk ? C.success : precision === 'approximate' || health === 'weak' ? C.warnInk : C.danger }} />
              <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>
                {perm === 'denied' ? t('rec.locDenied')
                  : perm === 'unasked' ? t('rec.allowLoc')
                  : precision === 'off' ? t('rec.locOff')
                  : precision === 'approximate' ? t('rec.approx')
                  : gpsOk ? `GPS ±${Math.round(fix?.acc ?? 0)} m`
                  : health === 'weak' ? `${t('rec.weak')} ±${Math.round(fix?.acc ?? 0)} m`
                  : active ? t('rec.gpsLost') : t('rec.finding')}
              </Text>
            </>)}
          </Pressable>
          <SettingsButton />
        </View>
        {(onWatcher || mapOffline) && (
          <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, alignItems: 'center', gap: 6 }}>
            {mapOffline && pill(<>
              <MaterialCommunityIcons name="wifi-off" size={13} color={C.muted} />
              <Text style={{ color: C.muted, fontSize: 11, flexShrink: 1 }} numberOfLines={2}>{t('map.offline')}</Text>
            </>)}
            {onWatcher && pill(<Text style={{ color: C.muted, fontSize: 11 }}>{t('rec.keepOpen')}</Text>)}
          </View>
        )}
      </View>

      <NeuCard radius={32} style={{ marginHorizontal: 16, marginBottom: 12, padding: 20, gap: 20 }}>
        {countdown != null ? (
          <View style={{ alignItems: 'center', gap: 16, paddingVertical: 6 }}>
            <View style={{ width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center',
              backgroundColor: C.bg, boxShadow: S.inset }}>
              <CountdownDigit n={countdown} color={C.accentInk} />
            </View>
            <NeuButton small label={t('rec.cancel')} onPress={cancelCountdown} />
          </View>
        ) : active ? (
          <>
            <NeuCard inset radius={24} padding={14}>
              <Stat big label={t('rec.time')} value={fmtDuration(moving)} />
            </NeuCard>
            <View style={{ flexDirection: 'row' }}>
              <Stat big label={t('rec.distance')} value={fmtKm(dist)} unit="km" />
              {info.usesPace
                ? <Stat big label={t('rec.paceNow')} value={cur ? fmtPace(1000, 1000 / cur) : '–:––'} unit="/km" />
                : <Stat big label={t('rec.speedNow')} value={cur ? (cur * 3.6).toFixed(1) : '0.0'} unit="km/h" />}
            </View>
            <View style={{ flexDirection: 'row' }}>
              {info.usesPace
                ? <Stat label={t('rec.avgPace')} value={fmtPace(dist, moving)} unit="/km" />
                : <Stat label={t('rec.avgSpeed')} value={fmtSpeed(dist, moving)} unit="km/h" />}
              <Stat label={`${t('rec.lap')} ${laps.length + 1}`} value={fmtDuration(openLap.durationSec)} />
              <Stat label={t('rec.lapDist')} value={fmtKm(openLap.distanceM)} unit="km" />
            </View>
            {(targets.distM || targets.timeSec || weeklyGoalKm > 0) && (
              <View style={{ gap: 8 }}>
                {targets.distM ? (
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={F.label}>{t('rec.targetBar')} · {fmtKm(targets.distM)} km</Text>
                      <Text style={[F.label, { color: dist >= targets.distM ? C.successInk : C.muted }]}>{Math.min(100, Math.round((dist / targets.distM) * 100))}%</Text>
                    </View>
                    <NeuProgress value={dist / targets.distM} />
                  </View>
                ) : targets.timeSec ? (
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={F.label}>{t('rec.targetBar')} · {fmtDuration(targets.timeSec)}</Text>
                      <Text style={[F.label, { color: moving >= targets.timeSec ? C.successInk : C.muted }]}>{Math.min(100, Math.round((moving / targets.timeSec) * 100))}%</Text>
                    </View>
                    <NeuProgress value={moving / targets.timeSec} />
                  </View>
                ) : null}
                {weeklyGoalKm > 0 && (
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={F.label}>{t('rec.weekBar')} · {(weekKmBefore + dist / 1000).toFixed(1)} / {weeklyGoalKm} km</Text>
                    </View>
                    <NeuProgress value={(weekKmBefore + dist / 1000) / weeklyGoalKm} />
                  </View>
                )}
              </View>
            )}
            {isOnFoot(active.sport) && active.steps != null && (
              <View style={{ flexDirection: 'row' }}>
                <Stat label={t('rec.steps')} value={fmtSteps(active.steps)} />
                <Stat label={t('rec.cadence')} value={moving >= 60 && active.steps ? String(Math.round(active.steps / (moving / 60))) : '–'} unit="spm" />
                <View style={{ flex: 1 }} />
              </View>
            )}
            {(() => {
              const w = findWorkout(active.workout?.workoutId);
              if (!w || !active.workout) return null;
              if (active.workout.done) return <Text style={{ color: C.successInk, textAlign: 'center', fontWeight: '800' }}>{t('rec.workoutDone')}</Text>;
              const step = w.steps[active.workout.index];
              const left = remaining(w, active.workout, active.distanceM ?? 0, workoutSec(active, now));
              return (
                <NeuCard inset radius={20} padding={12} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: step.kind === 'work' ? C.accentInk : C.muted, fontWeight: '800' }}>
                    {t(stepKey(step))} · {active.workout.index + 1}/{w.steps.length}
                  </Text>
                  <Text style={{ color: C.text, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                    {step.by === 'distance' ? `${Math.round(left)} m ${t('rec.left')}` : `${fmtDuration(left)} ${t('rec.left')}`}
                  </Text>
                </NeuCard>
              );
            })()}
            {active.status === 'paused' && (
              <Text style={{ color: C.accentInk, textAlign: 'center', fontWeight: '800' }}>
                {active.autoPaused ? t('rec.autoPaused') : t('rec.paused')}
              </Text>
            )}
            {phase === 'saving' ? (
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
                <NeuIconButton icon="content-save" size={64} accent busy accessibilityLabel={t('rec.saving')} />
                <Text style={{ color: C.muted, fontWeight: '700' }}>{t('rec.saving')}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28 }}>
                {active.status === 'recording' ? (
                  <>
                    <NeuIconButton icon="flag-outline" size={60} color={C.accentInk} accessibilityLabel={t('rec.newLap')}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); tracker.lap(); }} />
                    <NeuIconButton icon="pause" size={80} accent accessibilityLabel={t('rec.pause')}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined); ease(); tracker.pause(); }} />
                    {/* Finish is always visible; a hold protects it from a mid-stride tap */}
                    <NeuIconButton icon="flag-checkered" size={60} color={C.accentInk} accessibilityLabel={t('rec.finish')} accessibilityHint={t('rec.holdToFinish')}
                      delayLongPress={600} onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined); onFinish(); }}
                      onPress={() => showToast(t('rec.holdToFinish'), undefined, 2500)} />
                  </>
                ) : (
                  <>
                    <NeuIconButton icon="play" size={80} accent accessibilityLabel={t('rec.resume')}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined); ease(); tracker.resume(); }} />
                    <NeuIconButton icon="flag-checkered" size={64} color={C.accentInk} accessibilityLabel={t('rec.finish')} onPress={onFinish} />
                  </>
                )}
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={[F.label, { textAlign: 'center' }]}>{t('rec.choose')}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {SPORTS.map((s) => {
                const sel = s.key === sport;
                return (
                  <View key={s.key} style={{ alignItems: 'center', gap: 8 }}>
                    <NeuIconButton icon={s.icon as never} size={58} color={sel ? C.accentInk : C.muted} selected={sel}
                      accessibilityLabel={sportName(t, s.key)} disabled={phase === 'preparing'} onPress={() => setSport(s.key)} />
                    <Text style={{ color: sel ? C.accentInk : C.muted, fontWeight: sel ? '800' : '600', fontSize: 13 }} maxFontSizeMultiplier={1.3}>{sportName(t, s.key)}</Text>
                  </View>
                );
              })}
            </View>
            <NeuButton small icon="timer-outline" label={t(findWorkout(selectedWorkout)?.nameKey ?? 'rec.free')}
              selected={!!selectedWorkout} onPress={() => router.push('/workouts')} style={{ alignSelf: 'center' }} />
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <ReadyGlow on={gpsOk && phase === 'idle'} color={C.accent} size={84} />
              <NeuIconButton icon="play" size={84} accent busy={phase === 'preparing'} accessibilityLabel={`${t('rec.start')} ${sportName(t, info.key)}`} onPress={onStart} />
              {phase === 'preparing' && <Text style={{ color: C.muted, fontSize: 12, marginTop: 10 }}>{t('rec.preparing')}</Text>}
            </View>
          </>
        )}
      </NeuCard>
    </View>
  );
}
