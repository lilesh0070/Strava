import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { fmtDate } from '../../components/ActivityCard';
import DetailsCard from '../../components/DetailsCard';
import ElevationChart from '../../components/ElevationChart';
import RouteMap from '../../components/RouteMap';
import Stat from '../../components/Stat';
import { cumulative, fmtDuration, fmtKm, fmtPace, fmtSpeed, splits } from '../../lib/geo';
import { deleteActivity, getActivity, saveActivity } from '../../lib/storage';
import { shareGpx } from '../../lib/exportGpx';
import { C, F } from '../../lib/theme';
import { sportInfo, type Activity } from '../../lib/types';

export default function ActivityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const [a, setA] = useState<Activity | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => { getActivity(id).then((x) => { setA(x); setName(x?.name ?? ''); }); }, [id]);

  const data = useMemo(() => (a ? { splits: splits(a.segments), cum: cumulative(a.segments) } : null), [a]);

  if (a === undefined) return <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />;
  if (!a || !data) return <Text style={[F.body, { padding: 20 }]}>Activity not found.</Text>;

  const info = sportInfo(a.sport);
  const fastest = data.splits.filter((s) => s.distanceM >= 1000).reduce((m, s) => Math.min(m, s.durationSec), Infinity);
  const bestPerKm = Math.min(...data.splits.map((s) => s.durationSec * (1000 / s.distanceM)));
  const maxAlt = Math.max(...data.cum.alt.filter((x): x is number => x != null), -Infinity);

  const saveName = async () => {
    const next = { ...a, name: name.trim() || a.name };
    await saveActivity(next);
    setA(next); setEditing(false);
  };

  const update = async (next: Activity) => { setA(next); await saveActivity(next); };

  const onExport = () => shareGpx(a).catch((e) => Alert.alert('Export failed', String(e?.message ?? e)));

  const onDelete = () => Alert.alert('Delete activity?', 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await deleteActivity(a.id); router.back(); } },
  ]);

  return (
    <>
      <Stack.Screen options={{
        title: info.label,
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <Pressable onPress={onExport} hitSlop={10} accessibilityLabel="Export GPX">
              <MaterialCommunityIcons name="export-variant" size={22} color={C.text} />
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={10} accessibilityLabel="Delete">
              <MaterialCommunityIcons name="trash-can-outline" size={22} color={C.danger} />
            </Pressable>
          </View>
        ),
      }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <RouteMap segments={a.segments} style={{ height: 300 }} />
        <View style={{ padding: 16, gap: 20 }}>
          <View>
            <Text style={{ color: C.muted, fontSize: 13 }}>{fmtDate(a.startedAt)}</Text>
            {editing ? (
              <TextInput value={name} onChangeText={setName} autoFocus onSubmitEditing={saveName} onBlur={saveName}
                style={[F.h1, { borderBottomWidth: 1, borderColor: C.accent, paddingVertical: 2 }]} />
            ) : (
              <Pressable onPress={() => setEditing(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={F.h1}>{a.name}</Text>
                <MaterialCommunityIcons name="pencil-outline" size={18} color={C.muted} />
              </Pressable>
            )}
          </View>

          <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 18 }}>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="Distance" value={fmtKm(a.distanceM)} unit="km" />
              {info.usesPace
                ? <Stat label="Avg pace" value={fmtPace(a.distanceM, a.movingSec)} unit="/km" />
                : <Stat label="Avg speed" value={fmtSpeed(a.distanceM, a.movingSec)} unit="km/h" />}
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="Moving time" value={fmtDuration(a.movingSec)} />
              <Stat label="Elapsed" value={fmtDuration(a.elapsedSec)} />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="Elev gain" value={String(a.elevGainM)} unit="m" />
              <Stat label="Max elev" value={Number.isFinite(maxAlt) ? String(Math.round(maxAlt)) : '–'} unit="m" />
            </View>
          </View>

          <DetailsCard a={a} onChange={update} />

          {data.cum.alt.some((x) => x != null) && (
            <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 10 }}>
              <Text style={F.h2}>Elevation</Text>
              <ElevationChart d={data.cum.d} alt={data.cum.alt} width={width - 64} height={110} />
            </View>
          )}

          {data.splits.length > 0 && (
            <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 8 }}>
              <Text style={F.h2}>Splits</Text>
              <View style={{ flexDirection: 'row' }}>
                <Text style={[F.label, { width: 40 }]}>Km</Text>
                <Text style={[F.label, { width: 70 }]}>{info.usesPace ? 'Pace' : 'Speed'}</Text>
              </View>
              {data.splits.map((s) => {
                const perKm = s.durationSec * (1000 / s.distanceM);
                const isBest = s.durationSec === fastest;
                return (
                  <View key={s.km} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: C.text, width: 40, fontVariant: ['tabular-nums'] }}>
                      {s.distanceM < 1000 ? (s.distanceM / 1000).toFixed(2) : s.km}
                    </Text>
                    <Text style={{ color: C.text, width: 70, fontVariant: ['tabular-nums'] }}>
                      {info.usesPace ? fmtPace(s.distanceM, s.durationSec) : fmtSpeed(s.distanceM, s.durationSec)}
                    </Text>
                    <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: C.cardAlt }}>
                      <View style={{ height: 10, borderRadius: 5, width: `${Math.max(8, (bestPerKm / perKm) * 100)}%`,
                        backgroundColor: isBest ? C.accent : C.route }} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
