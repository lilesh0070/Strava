import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NeuButton, NeuCard, NeuIconButton } from '../../components/Neu';
import RouteMap from '../../components/RouteMap';
import SettingsButton from '../../components/SettingsButton';
import Stat from '../../components/Stat';
import { fmtDuration, fmtKm, fmtPace, fmtSpeed, totalDistance } from '../../lib/geo';
import { getSettings } from '../../lib/storage';
import { useTheme } from '../../lib/theme';
import * as tracker from '../../lib/tracker';
import { SPORTS, sessionMovingSec, sportInfo, type Sport } from '../../lib/types';

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
  const insets = useSafeAreaInsets();
  const { session, fix } = useTracker();
  const [sport, setSport] = useState<Sport>('run');
  const [, tick] = useState(0);
  const [perm, setPerm] = useState<tracker.PermissionResult | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const cdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // restore an in-progress session after app restart
  useEffect(() => { tracker.restore(); }, []);
  useEffect(() => () => { if (cdTimer.current) clearInterval(cdTimer.current); }, []);

  // live clock
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [session]);

  // show current position while this tab is focused
  useFocusEffect(useCallback(() => {
    let sub: { remove(): void } | null = null;
    let cancelled = false;
    tracker.ensurePermissions().then(async (p) => {
      setPerm(p);
      if (p === 'denied' || cancelled) return;
      sub = await tracker.warmUp();
      if (cancelled) sub?.remove();
    });
    return () => { cancelled = true; sub?.remove(); };
  }, []));

  const active = session ?? null;
  const info = sportInfo(active?.sport ?? sport);
  const dist = active ? totalDistance(active.segments) : 0;
  const moving = active ? sessionMovingSec(active) : 0;
  const gpsOk = !!fix && (fix.acc ?? 99) <= 35;

  const begin = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    await tracker.start(sport);
  };

  const onStart = async () => {
    if (perm === 'denied') {
      Alert.alert('Location needed', 'Allow location access in Settings to record activities.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
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
    Alert.alert('Finish activity?', undefined, [
      { text: 'Resume', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => tracker.discard() },
      {
        text: 'Save',
        onPress: async () => {
          const a = await tracker.finish();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          if (a) router.push(`/activity/${a.id}`);
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
          {pill(<>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: gpsOk ? C.success : '#F5A524' }} />
            <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>{gpsOk ? 'GPS ready' : 'Finding GPS…'}</Text>
          </>)}
          <SettingsButton />
        </View>
        {perm === 'foreground' && (
          <View style={{ position: 'absolute', bottom: 16, alignSelf: 'center' }}>
            {pill(<Text style={{ color: C.muted, fontSize: 11 }}>Keep the app open while recording</Text>)}
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
            <NeuButton small label="Cancel" onPress={cancelCountdown} />
          </View>
        ) : active ? (
          <>
            <NeuCard inset radius={24} padding={14}>
              <Stat big label="Time" value={fmtDuration(moving)} />
            </NeuCard>
            <View style={{ flexDirection: 'row' }}>
              <Stat big label="Distance" value={fmtKm(dist)} unit="km" />
              {info.usesPace
                ? <Stat big label="Avg pace" value={fmtPace(dist, moving)} unit="/km" />
                : <Stat big label="Avg speed" value={fmtSpeed(dist, moving)} unit="km/h" />}
            </View>
            {active.status === 'paused' && (
              <Text style={{ color: C.accent, textAlign: 'center', fontWeight: '800' }}>
                {active.autoPaused ? 'AUTO-PAUSED · start moving to resume' : 'PAUSED'}
              </Text>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28 }}>
              {active.status === 'recording' ? (
                <NeuIconButton icon="pause" size={80} accent accessibilityLabel="Pause"
                  onPress={() => tracker.pause()} />
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
            <Text style={[F.label, { textAlign: 'center' }]}>Choose a sport</Text>
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
            <View style={{ alignItems: 'center' }}>
              <NeuIconButton icon="play" size={84} accent accessibilityLabel={`Start ${info.label}`} onPress={onStart} />
            </View>
          </>
        )}
      </NeuCard>
    </View>
  );
}
