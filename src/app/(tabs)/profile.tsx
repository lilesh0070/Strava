import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import CalendarCard from '../../components/CalendarCard';
import GearCard from '../../components/GearCard';
import { router } from 'expo-router';
import { IconWell, NeuButton, NeuCard, NeuProgress, NeuTile } from '../../components/Neu';
import { evaluateAchievements } from '../../lib/achievements';
import Stat from '../../components/Stat';
import { bestEffort, fmtDuration, fmtKm } from '../../lib/geo';
import { getProfile, saveProfile, type Profile } from '../../lib/storage';
import { useTheme } from '../../lib/theme';
import { SPORTS, type Sport } from '../../lib/types';
import { useActivities } from '../../lib/useActivities';

const WEEK = 7 * 24 * 3600 * 1000;
function mondayOf(t: number) {
  const x = new Date(t); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}

const EFFORTS = [
  { label: '1 km', m: 1000 },
  { label: '5 km', m: 5000 },
  { label: '10 km', m: 10000 },
  { label: 'Half marathon', m: 21097.5 },
];

export default function ProfileScreen() {
  const { C, S, F } = useTheme();
  const { width } = useWindowDimensions();
  const { items } = useActivities();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [filter, setFilter] = useState<Sport>('run');
  useEffect(() => { getProfile().then(setProfile); }, []);

  const acts = useMemo(() => (items ?? []).filter((a) => a.sport === filter), [items, filter]);

  const weeks = useMemo(() => {
    const thisMon = mondayOf(Date.now());
    return Array.from({ length: 8 }, (_, i) => {
      const start = thisMon - (7 - i) * WEEK;
      const dist = acts.filter((a) => a.startedAt >= start && a.startedAt < start + WEEK).reduce((s, a) => s + a.distanceM, 0);
      return { start, km: dist / 1000 };
    });
  }, [acts]);

  const records = useMemo(() => {
    if (filter !== 'run') return [];
    return EFFORTS.map((e) => {
      let best: number | null = null;
      for (const a of acts) {
        const t = bestEffort(a.segments, e.m);
        if (t != null && (best == null || t < best)) best = t;
      }
      return { ...e, best };
    });
  }, [acts, filter]);

  const totals = {
    count: acts.length,
    dist: acts.reduce((s, a) => s + a.distanceM, 0),
    time: acts.reduce((s, a) => s + a.movingSec, 0),
    elev: acts.reduce((s, a) => s + a.elevGainM, 0),
    longest: acts.reduce((m, a) => Math.max(m, a.distanceM), 0),
  };

  const goal = profile?.weeklyGoalKm ?? 0;
  const thisWeekKm = weeks[weeks.length - 1].km;
  const chartW = width - 80, chartH = 120;
  const maxKm = Math.max(...weeks.map((w) => w.km), goal, 1);
  const barW = chartW / weeks.length - 10;

  const update = (p: Partial<Profile>) => {
    if (!profile) return;
    const next = { ...profile, ...p };
    setProfile(next); saveProfile(next);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <NeuCard radius={30} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', boxShadow: S.glow }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: C.accentText }}>{(profile?.name || 'A')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <TextInput value={profile?.name ?? ''} onChangeText={(name) => update({ name })} placeholder="Your name"
            placeholderTextColor={C.muted} style={[F.h1, { fontSize: 24, padding: 0 }]} accessibilityLabel="Your name" />
          <Text style={{ color: C.muted, fontSize: 13 }}>{(items ?? []).length} activities recorded</Text>
        </View>
      </NeuCard>

      <View style={{ flexDirection: 'row', gap: 16 }}>
        <NeuTile icon="trophy-variant-outline" title="Badges" subtitle={`${evaluateAchievements(items ?? []).filter((x) => x.earned).length} earned`}
          style={{ flex: 1, paddingRight: 8 }} onPress={() => router.push('/achievements')} />
        <NeuTile icon="map-legend" title="Heatmap" subtitle="All routes"
          style={{ flex: 1, paddingRight: 8 }} onPress={() => router.push('/heatmap')} />
      </View>

      <CalendarCard activities={items ?? []} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 12 }}>
        {SPORTS.map((s) => (
          <NeuButton key={s.key} small icon={s.icon as never} label={s.label} selected={filter === s.key} onPress={() => setFilter(s.key)} />
        ))}
      </ScrollView>

      <NeuCard radius={28} style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconWell icon="chart-bar" />
          <View style={{ flex: 1 }}>
            <Text style={F.h2}>Last 8 weeks</Text>
            <Text style={{ color: C.muted, fontSize: 13 }}>{thisWeekKm.toFixed(1)} of {goal} km this week</Text>
          </View>
        </View>
        <NeuProgress value={goal ? thisWeekKm / goal : 0} />
        <Svg width={chartW} height={chartH + 18}>
          {goal > 0 && (
            <Rect x={0} y={chartH - (goal / maxKm) * chartH} width={chartW} height={1.5} fill={C.accent} opacity={0.5} />
          )}
          {weeks.map((w, i) => {
            const h = Math.max(3, (w.km / maxKm) * chartH);
            const d = new Date(w.start);
            return [
              <Rect key={`b${i}`} x={i * (barW + 10) + 5} y={chartH - h} width={barW} height={h} rx={barW / 2.5}
                fill={i === weeks.length - 1 ? C.accent : C.faint} />,
              <SvgText key={`t${i}`} x={i * (barW + 10) + 5 + barW / 2} y={chartH + 14} fontSize={9} fill={C.muted} textAnchor="middle">
                {`${d.getDate()}/${d.getMonth() + 1}`}
              </SvgText>,
            ];
          })}
        </Svg>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ color: C.muted, flex: 1 }}>Weekly goal (km)</Text>
          <TextInput keyboardType="numeric" value={String(profile?.weeklyGoalKm ?? '')} accessibilityLabel="Weekly goal in kilometres"
            onChangeText={(t) => update({ weeklyGoalKm: Math.max(0, Number(t.replace(/[^0-9.]/g, '')) || 0) })}
            style={{ color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 14, paddingHorizontal: 14,
              paddingVertical: 8, minWidth: 70, textAlign: 'center', fontWeight: '700' }} />
        </View>
      </NeuCard>

      <NeuCard radius={28} style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconWell icon="trophy-outline" />
          <Text style={F.h2}>All-time</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Activities" value={String(totals.count)} />
          <Stat label="Distance" value={fmtKm(totals.dist)} unit="km" />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Time" value={fmtDuration(totals.time)} />
          <Stat label="Elev gain" value={String(totals.elev)} unit="m" />
        </View>
        <Stat label="Longest" value={fmtKm(totals.longest)} unit="km" />
      </NeuCard>

      {records.length > 0 && (
        <NeuCard radius={28} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconWell icon="medal-outline" />
            <Text style={F.h2}>Best efforts</Text>
          </View>
          {records.map((r) => (
            <NeuCard key={r.label} inset radius={18} padding={12} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.text, fontWeight: '600' }}>{r.label}</Text>
              <Text style={{ color: r.best ? C.accent : C.muted, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                {r.best ? fmtDuration(r.best) : '—'}
              </Text>
            </NeuCard>
          ))}
        </NeuCard>
      )}

      <NeuCard radius={28} style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconWell icon="scale-bathroom" />
          <View style={{ flex: 1 }}>
            <Text style={F.h2}>Body weight</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>Used only to estimate calories, stays on this phone</Text>
          </View>
          <TextInput keyboardType="numeric" value={String(profile?.weightKg ?? '')} accessibilityLabel="Body weight in kilograms"
            onChangeText={(t) => update({ weightKg: Math.min(300, Math.max(0, Number(t.replace(/[^0-9.]/g, '')) || 0)) })}
            style={{ color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 14, paddingHorizontal: 12,
              paddingVertical: 8, minWidth: 64, textAlign: 'center', fontWeight: '700' }} />
          <Text style={{ color: C.muted }}>kg</Text>
        </View>
      </NeuCard>

      <GearCard activities={items ?? []} />
    </ScrollView>
  );
}
