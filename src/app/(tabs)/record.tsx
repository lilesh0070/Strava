import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, AppState, Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NeuButton, NeuCard, NeuIconButton } from '../../components/Neu';
import RouteMap from '../../components/RouteMap';
import SettingsButton from '../../components/SettingsButton';
import Stat from '../../components/Stat';
import { fmtDuration, fmtKm, fmtPace, fmtSpeed, totalDistance } from '../../lib/geo';
import { gpsHealth, lapsFromMarks } from '../../lib/live';
import { newlyEarned } from '../../lib/achievements';
import { newRecords } from '../../lib/records';
import { getSettings, listActivities } from '../../lib/storage';
import { useSelectedWorkout } from '../../lib/workoutSelection';
import { findWorkout, remaining, stepLabel } from '../../lib/workouts';
import { useTheme } from '../../lib/theme';
import * as tracker from '../../lib/tracker';
import { SPORTS, sessionMovingSec, sportInfo, type Sport } from '../../lib/types';
import { useT } from '../../lib/i18n';

// Snapshot changes identity on every tracker notification so React re-renders.
let version = 0;
tracker.subscribe(() => { version++; });
const useTracker = () => {
  useSyncExternalStore(tracker.subscribe, () => version);
  return { session: tracker.getSession(), fix: tracker.getLastFix() };
};

function KeepAwake() { useKeepAwake(); return null; }

export default function Record() {
  const { C, S, F } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { session, fix } = useTracker();
  const [sport, setSport] = useState<Sport>('run');
  const [, tick] = useState(0);
  const [perm, setPerm] = useState<tracker.PermissionResult | null>(null);
  const [precision, setPrecision] = useState<tracker.Precision>('precise');
  const [countdown, setCountdown] = useState<number | null>(null);
  const selectedWorkout = useSelectedWorkout();
  const cdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // restore an in-progress session after app restart
  useEffect(() => { tracker.restore(); }, []);
  useEffect(() => () => { if (cdTimer.current) clearInterval(cdTimer.current); }, []);

  // live clock + GPS watchdog
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => { tick((n) => n + 1); tracker.workoutTick(); tracker.watchdog(); }, 1000);
    return () => clearInterval(id);
  }, [session]);

  // show current position while this tab is focused; re-render every second so the GPS chip
  // turns to "Finding GPS…" as soon as fixes stop instead of showing a stale accuracy
  useFocusEffect(useCallback(() => {
    let sub: { remove(): void } | null = null;
    let cancelled = false;
    const checkPrecision = () => tracker.locationPrecision().then((p) => { if (!cancelled) setPrecision(p); });
    tracker.ensurePermissions().then(async (p) => {
      setPerm(p);
      if (p === 'denied' || cancelled) return;
      checkPrecision();
      sub = await tracker.warmUp();
      if (cancelled) sub?.remove();
    });
    const id = setInterval(() => { if (!tracker.getSession()) tick((n) => n + 1); }, 1000);
    // back from system settings: the user may have just turned on precise location
    const app = AppState.addEventListener('change', (st) => { if (st === 'active') checkPrecision(); });
    return () => { cancelled = true; sub?.remove(); clearInterval(id); app.remove(); };
  }, []));

  const active = session ?? null;
  const info = sportInfo(active?.sport ?? sport);
  const dist = active ? totalDistance(active.segments) : 0;
  const moving = active ? sessionMovingSec(active) : 0;
  // age from when the fix arrived, not its GPS timestamp, so a skewed GPS clock can't fake a signal
  const health = gpsHealth(fix ? { ...fix, t: tracker.getLastFixAt() } : null, Date.now());
  const gpsOk = health === 'good' && precision === 'precise';
  const cur = tracker.currentSpeed();
  const laps = active?.laps ?? [];
  const lapRows = active ? lapsFromMarks(laps, active.distanceM ?? dist, moving) : [];
  const openLap = lapRows[lapRows.length - 1];

  const begin = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    await tracker.start(sport, selectedWorkout);
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
    if (perm === 'denied') {
      Alert.alert('Location needed', 'Allow location access in Settings to record activities.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    if (precision !== 'precise' && !(await fixPrecision())) return;
    if (health !== 'good' && precision === 'precise') {
      const go = await new Promise<boolean>((resolve) => Alert.alert(
        health === 'lost' ? t('rec.noGpsTitle') : t('rec.weakTitle'),
        t('rec.weakBody'),
        [{ text: t('rec.wait'), style: 'cancel', onPress: () => resolve(false) }, { text: t('rec.anyway'), onPress: () => resolve(true) }],
      ));
      if (!go) return;
    }
    if (!(await getSettings()).countdown) return begin();
    let n = 3;
    setCountdown(n);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    cdTimer.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (cdTimer.current) clearInterval(cdTimer.current);
        cdTimer.current = null;
        setCountdown(null);
        begin();
      } else {
        setCountdown(n);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (cdTimer.current) clearInterval(cdTimer.current);
    cdTimer.current = null;
    setCountdown(null);
  };

  const onFinish = () => {
    Alert.alert(t('rec.finishQ'), undefined, [
      { text: t('rec.resume'), style: 'cancel' },
      { text: t('rec.discard'), style: 'destructive', onPress: () => tracker.discard() },
      {
        text: t('rec.save'),
        onPress: async () => {
          const before = await listActivities().catch(() => []);
          const a = await tracker.finish();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          if (!a) return;
          router.push(`/activity/${a.id}`);
          const lines = [
            ...newRecords(before, a).map((r) => `🏆 New PR: ${r.label}${r.kind === 'effort' ? ` — ${fmtDuration(r.value)}` : ''}`),
            ...newlyEarned(before, a).map((b) => `🏅 Badge: ${b.title}`),
          ];
          if (lines.length) Alert.alert(t('rec.nice'), lines.join('\n'));
        },
      },
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
        <RouteMap segments={active?.segments ?? []} current={fix} follow style={{ flex: 1, borderRadius: 26 }} />
        <View style={{ position: 'absolute', top: 16, left: 16, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable disabled={precision === 'precise'} onPress={fixPrecision} accessibilityRole="button">
            {pill(<>
              <View style={{ width: 9, height: 9, borderRadius: 5,
                backgroundColor: precision === 'off' ? C.danger : gpsOk ? C.success : precision === 'approximate' || health === 'weak' ? '#F5A524' : C.danger }} />
              <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>
                {precision === 'off' ? t('rec.locOff')
                  : precision === 'approximate' ? t('rec.approx')
                  : gpsOk ? `GPS ±${Math.round(fix?.acc ?? 0)} m`
                  : health === 'weak' ? `${t('rec.weak')} ±${Math.round(fix?.acc ?? 0)} m`
                  : active ? t('rec.gpsLost') : t('rec.finding')}
              </Text>
            </>)}
          </Pressable>
          <SettingsButton />
        </View>
        {perm === 'foreground' && (
          <View style={{ position: 'absolute', bottom: 16, alignSelf: 'center' }}>
            {pill(<Text style={{ color: C.muted, fontSize: 11 }}>{t('rec.keepOpen')}</Text>)}
          </View>
        )}
      </View>

      <NeuCard radius={32} style={{ marginHorizontal: 16, marginBottom: 12, padding: 20, gap: 20 }}>
        {countdown != null ? (
          <View style={{ alignItems: 'center', gap: 16, paddingVertical: 6 }}>
            <View style={{ width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center',
              backgroundColor: C.bg, boxShadow: S.inset }}>
              <Text style={{ fontSize: 60, fontWeight: '900', color: C.accent }}>{countdown}</Text>
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
              <Stat label={`${t('rec.lap')} ${lapRows.length || 1}`} value={openLap ? fmtDuration(openLap.durationSec) : '0:00'} />
              <Stat label={t('rec.lapDist')} value={openLap ? fmtKm(openLap.distanceM) : '0.00'} unit="km" />
            </View>
            {(() => {
              const w = findWorkout(active.workout?.workoutId);
              if (!w || !active.workout) return null;
              if (active.workout.done) return <Text style={{ color: C.success, textAlign: 'center', fontWeight: '800' }}>Workout complete ✓</Text>;
              const step = w.steps[active.workout.index];
              const left = remaining(w, active.workout, active.distanceM ?? 0, moving);
              return (
                <NeuCard inset radius={20} padding={12} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: step.kind === 'work' ? C.accent : C.muted, fontWeight: '800' }}>
                    {stepLabel(step)} · {active.workout.index + 1}/{w.steps.length}
                  </Text>
                  <Text style={{ color: C.text, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                    {step.by === 'distance' ? `${Math.round(left)} m left` : `${fmtDuration(left)} left`}
                  </Text>
                </NeuCard>
              );
            })()}
            {active.status === 'paused' && (
              <Text style={{ color: C.accent, textAlign: 'center', fontWeight: '800' }}>
                {active.autoPaused ? t('rec.autoPaused') : t('rec.paused')}
              </Text>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28 }}>
              {active.status === 'recording' ? (
                <>
                  <NeuIconButton icon="flag-outline" size={60} color={C.accent} accessibilityLabel="New lap" onPress={() => tracker.lap()} />
                  <NeuIconButton icon="pause" size={80} accent accessibilityLabel="Pause" onPress={() => tracker.pause()} />
                  <View style={{ width: 60 }} />
                </>
              ) : (
                <>
                  <NeuIconButton icon="play" size={80} accent accessibilityLabel="Resume" onPress={() => tracker.resume()} />
                  <NeuIconButton icon="flag-checkered" size={64} color={C.accent} accessibilityLabel="Finish" onPress={onFinish} />
                </>
              )}
            </View>
          </>
        ) : (
          <>
            <Text style={[F.label, { textAlign: 'center' }]}>{t('rec.choose')}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {SPORTS.map((s) => {
                const sel = s.key === sport;
                return (
                  <View key={s.key} style={{ alignItems: 'center', gap: 8 }}>
                    <NeuIconButton icon={s.icon as never} size={58} color={sel ? C.accent : C.muted}
                      accessibilityLabel={s.label} onPress={() => setSport(s.key)} />
                    <Text style={{ color: sel ? C.accent : C.muted, fontWeight: sel ? '800' : '600', fontSize: 13 }}>{s.label}</Text>
                  </View>
                );
              })}
            </View>
            <NeuButton small icon="timer-outline" label={findWorkout(selectedWorkout)?.name ?? t('rec.free')}
              selected={!!selectedWorkout} onPress={() => router.push('/workouts')} style={{ alignSelf: 'center' }} />
            <View style={{ alignItems: 'center' }}>
              <NeuIconButton icon="play" size={84} accent accessibilityLabel={`Start ${info.label}`} onPress={onStart} />
            </View>
          </>
        )}
      </NeuCard>
    </View>
  );
}
