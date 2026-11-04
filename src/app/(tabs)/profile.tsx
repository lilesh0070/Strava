import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import Stat from '../../components/Stat';
import { bestEffort, fmtDuration, fmtKm } from '../../lib/geo';
import { getProfile, saveProfile, type Profile } from '../../lib/storage';
import { C, F } from '../../lib/theme';
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
  const { width } = useWindowDimensions();
  const { items } = useActivities();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [filter, setFilter] = useState<Sport>('run');
  useEffect(() => { getProfile().then(setProfile); }, []);

  const acts = (items ?? []).filter((a) => a.sport === filter);

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

  const thisWeekKm = weeks[weeks.length - 1].km;
  const chartW = width - 64, chartH = 120;
  const maxKm = Math.max(...weeks.map((w) => w.km), profile?.weeklyGoalKm ?? 1, 1);
  const barW = chartW / weeks.length - 8;

  const update = (p: Partial<Profile>) => {
    if (!profile) return;
    const next = { ...profile, ...p };
    setProfile(next); saveProfile(next);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.accentText }}>{(profile?.name || 'A')[0].toUpperCase()}</Text>
        </View>
        <TextInput value={profile?.name ?? ''} onChangeText={(name) => update({ name })} placeholder="Your name"
          placeholderTextColor={C.muted} style={[F.h1, { flex: 1 }]} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SPORTS.map((s) => (
          <Pressable key={s.key} onPress={() => setFilter(s.key)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: filter === s.key ? C.accent : C.card }}>
            <Text style={{ color: filter === s.key ? C.accentText : C.text, fontWeight: '700' }}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={F.h2}>Last 8 weeks</Text>
          <Text style={{ color: C.muted }}>{thisWeekKm.toFixed(1)} / {profile?.weeklyGoalKm ?? 0} km goal</Text>
        </View>
        <Svg width={chartW} height={chartH + 18}>
          {profile && (
            <Rect x={0} y={chartH - (profile.weeklyGoalKm / maxKm) * chartH} width={chartW} height={1} fill={C.accent} opacity={0.6} />
          )}
          {weeks.map((w, i) => {
            const h = Math.max(2, (w.km / maxKm) * chartH);
            const d = new Date(w.start);
            return [
              <Rect key={`b${i}`} x={i * (barW + 8) + 4} y={chartH - h} width={barW} height={h} rx={4}
                fill={i === weeks.length - 1 ? C.accent : C.route} />,
              <SvgText key={`t${i}`} x={i * (barW + 8) + 4 + barW / 2} y={chartH + 14} fontSize={9} fill={C.muted} textAnchor="middle">
                {`${d.getDate()}/${d.getMonth() + 1}`}
              </SvgText>,
            ];
          })}
        </Svg>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: C.muted }}>Weekly goal (km)</Text>
          <TextInput keyboardType="numeric" value={String(profile?.weeklyGoalKm ?? '')}
            onChangeText={(t) => update({ weeklyGoalKm: Math.max(0, Number(t.replace(/[^0-9.]/g, '')) || 0) })}
            style={{ color: C.text, backgroundColor: C.cardAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, minWidth: 60 }} />
        </View>
      </View>

      <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 16 }}>
        <Text style={F.h2}>All-time</Text>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Activities" value={String(totals.count)} />
          <Stat label="Distance" value={fmtKm(totals.dist)} unit="km" />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Time" value={fmtDuration(totals.time)} />
          <Stat label="Elev gain" value={String(totals.elev)} unit="m" />
        </View>
        <Stat label="Longest" value={fmtKm(totals.longest)} unit="km" />
      </View>

      {records.length > 0 && (
        <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 10 }}>
          <Text style={F.h2}>Best efforts</Text>
          {records.map((r) => (
            <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.text }}>{r.label}</Text>
              <Text style={{ color: r.best ? C.accent : C.muted, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {r.best ? fmtDuration(r.best) : '—'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
