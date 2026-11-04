import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RouteMap from '../../components/RouteMap';
import Stat from '../../components/Stat';
import { fmtDuration, fmtKm, fmtPace, fmtSpeed, totalDistance } from '../../lib/geo';
import { C, F } from '../../lib/theme';
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
  const insets = useSafeAreaInsets();
  const { session, fix } = useTracker();
  const [sport, setSport] = useState<Sport>('run');
  const [, tick] = useState(0);
  const [perm, setPerm] = useState<tracker.PermissionResult | null>(null);

  // restore an in-progress session after app restart
  useEffect(() => { tracker.restore(); }, []);

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
  const gpsOk = fix && (fix.acc ?? 99) <= 35;

  const onStart = async () => {
    if (perm === 'denied') {
      Alert.alert('Location needed', 'Allow location access in Settings to record activities.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await tracker.start(sport);
  };

  const onFinish = () => {
    Alert.alert('Finish activity?', undefined, [
      { text: 'Resume', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => tracker.discard() },
      {
        text: 'Save',
        onPress: async () => {
          const a = await tracker.finish();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (a) router.push(`/activity/${a.id}`);
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {active?.status === 'recording' && <KeepAwake />}
      <RouteMap segments={active?.segments ?? []} current={fix} follow style={{ flex: 1 }} />

      <View style={{ position: 'absolute', top: insets.top + 10, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: gpsOk ? '#22c55e' : '#f59e0b' }} />
          <Text style={{ color: C.text, fontSize: 12, fontWeight: '600' }}>{gpsOk ? 'GPS ready' : 'Finding GPS…'}</Text>
        </View>
        {perm === 'foreground' && (
          <View style={{ backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: C.muted, fontSize: 11 }}>Keep app open while recording</Text>
          </View>
        )}
      </View>

      <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 24, gap: 18 }}>
        {active ? (
          <>
            <Stat big label="Time" value={fmtDuration(moving)} />
            <View style={{ flexDirection: 'row' }}>
              <Stat big label="Distance" value={fmtKm(dist)} unit="km" />
              {info.usesPace
                ? <Stat big label="Avg pace" value={fmtPace(dist, moving)} unit="/km" />
                : <Stat big label="Avg speed" value={fmtSpeed(dist, moving)} unit="km/h" />}
            </View>
            {active.status === 'paused' && <Text style={{ color: C.accent, textAlign: 'center', fontWeight: '700' }}>PAUSED</Text>}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
              {active.status === 'recording' ? (
                <RoundBtn icon="pause" onPress={() => { Haptics.selectionAsync(); tracker.pause(); }} />
              ) : (
                <>
                  <RoundBtn icon="play" onPress={() => { Haptics.selectionAsync(); tracker.resume(); }} />
                  <RoundBtn icon="flag-checkered" label="Finish" dark onPress={onFinish} />
                </>
              )}
            </View>
          </>
        ) : (
          <>
            <Text style={[F.label, { textAlign: 'center' }]}>Choose a sport</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
              {SPORTS.map((s) => {
                const sel = s.key === sport;
                return (
                  <Pressable key={s.key} onPress={() => setSport(s.key)}
                    style={{ alignItems: 'center', paddingVertical: 10, width: 72, borderRadius: 14,
                      backgroundColor: sel ? C.accent : C.cardAlt }}>
                    <MaterialCommunityIcons name={s.icon as never} size={24} color={sel ? C.accentText : C.text} />
                    <Text style={{ color: sel ? C.accentText : C.text, fontWeight: '700', marginTop: 4 }}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ alignItems: 'center' }}>
              <RoundBtn icon="play" label="Start" onPress={onStart} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function RoundBtn({ icon, label, onPress, dark }: { icon: string; label?: string; onPress: () => void; dark?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ alignItems: 'center', opacity: pressed ? 0.8 : 1 })}>
      <View style={{ width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center',
        backgroundColor: dark ? C.cardAlt : C.accent, borderWidth: dark ? 2 : 0, borderColor: C.accent }}>
        <MaterialCommunityIcons name={icon as never} size={34} color={dark ? C.accent : C.accentText} />
      </View>
      {label ? <Text style={{ color: C.text, marginTop: 6, fontWeight: '700' }}>{label}</Text> : null}
    </Pressable>
  );
}
