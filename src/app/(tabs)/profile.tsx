import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, useWindowDimensions, View, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import CalendarCard from '../../components/CalendarCard';
import GearCard from '../../components/GearCard';
import { router } from 'expo-router';
import { IconWell, NeuButton, NeuCard, NeuProgress, NeuTile } from '../../components/Neu';
import { evaluateAchievements } from '../../lib/achievements';
import { wellnessBadges } from '../../lib/health';
import { useWellness } from '../../lib/wellnessStore';
import GoalRing from '../../components/GoalRing';
import { monthKm } from '../../lib/records';
import Stat from '../../components/Stat';
import { bestEffort, fmtDuration, fmtKm } from '../../lib/geo';
import { mondayOf } from '../../lib/coach';
import { getProfile, onDataChanged, updateProfile, type Profile } from '../../lib/storage';
import { useTheme } from '../../lib/theme';
import { SPORTS, type Sport } from '../../lib/types';
import { useActivities } from '../../lib/useActivities';
import { sportName, useT, type Key } from '../../lib/i18n';

/** Monday `k` weeks before `monday`, by calendar date so DST changes don't shift the buckets. */
function weeksBefore(monday: number, k: number) {
  const d = new Date(monday); d.setDate(d.getDate() - 7 * k);
  return d.getTime();
}

/** Number field that keeps what you type ("72." on the way to "72.5") and saves once it is a whole number. */
function NumberField({ value, onChange, max = Infinity, label, style }: {
  value: number | undefined; onChange: (n: number) => void; max?: number; label: string; style: StyleProp<TextStyle>;
}) {
  const [draft, setDraft] = useState<string | null>(null); // null → show the stored value
  return (
    <TextInput keyboardType="decimal-pad" accessibilityLabel={label} style={style}
      value={draft ?? (value == null ? '' : String(value))}
      onChangeText={(t) => {
        const clean = t.replace(/,/g, '.').replace(/[^0-9.]/g, '');
        setDraft(clean);
        if (/^\d+(\.\d+)?$/.test(clean)) onChange(Math.min(max, Number(clean)));
      }}
      onEndEditing={() => setDraft(null)} />
  );
}

const EFFORTS: { labelKey: Key; m: number }[] = [
  { labelKey: 'eff.1k', m: 1000 },
  { labelKey: 'eff.5k', m: 5000 },
  { labelKey: 'eff.10k', m: 10000 },
  { labelKey: 'eff.half', m: 21097.5 },
];

export default function ProfileScreen() {
  const { C, S, F } = useTheme();
  const { t } = useT();
  const { width } = useWindowDimensions();
  const { items, loadedAt } = useActivities();
  const log = useWellness();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [filter, setFilter] = useState<Sport>('run');
  // writes still in flight; while typing, don't reload a half-saved copy over the field
  const pending = useRef(0);
  useEffect(() => {
    const load = () => { if (!pending.current) getProfile().then(setProfile); };
    load();
    return onDataChanged(load); // e.g. after a restore
  }, []);

  const acts = useMemo(() => (items ?? []).filter((a) => a.sport === filter), [items, filter]);
  // badges scan the whole history: compute once per data change, not on every keystroke below
  const weightKg = profile?.weightKg || 70;
  const badgesEarned = useMemo(
    () => [...evaluateAchievements(items ?? []), ...wellnessBadges(log ?? {}, items ?? [], weightKg)].filter((x) => x.earned).length,
    [items, log, weightKg],
  );

  const weeks = useMemo(() => {
    const thisMon = mondayOf(loadedAt);
    return Array.from({ length: 8 }, (_, i) => {
      const start = weeksBefore(thisMon, 7 - i), end = weeksBefore(thisMon, 6 - i);
      const dist = acts.filter((a) => a.startedAt >= start && a.startedAt < end).reduce((s, a) => s + a.distanceM, 0);
      return { start, km: dist / 1000 };
    });
  }, [acts, loadedAt]);

  const records = useMemo(() => {
    if (filter !== 'run') return [];
    return EFFORTS.map((e) => {
      let best: number | null = null;
      for (const a of acts) {
        const t = a.efforts ? a.efforts[e.m] ?? null : bestEffort(a.segments, e.m);
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
    setProfile((cur) => (cur ? { ...cur, ...p } : cur));
    pending.current++;
    updateProfile(p).catch(() => undefined).finally(() => { pending.current--; });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <NeuCard radius={30} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', boxShadow: S.glow }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: C.accentText }}>{(profile?.name || 'A')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <TextInput value={profile?.name ?? ''} onChangeText={(name) => update({ name })} placeholder={t('you.name')}
            placeholderTextColor={C.muted} style={[F.h1, { fontSize: 24, padding: 0 }]} accessibilityLabel={t('you.name')} />
          <TextInput value={profile?.team ?? ''} onChangeText={(team) => update({ team })} placeholder={t('you.team')}
            placeholderTextColor={C.muted} style={{ color: C.text, fontSize: 14, fontWeight: '600', padding: 0 }}
            accessibilityLabel={t('you.team')} />
          <Text style={{ color: C.muted, fontSize: 13 }}>{(items ?? []).length} {t('you.recorded')}</Text>
        </View>
      </NeuCard>

      <View style={{ flexDirection: 'row', gap: 16 }}>
        <NeuTile icon="trophy-variant-outline" title={t('you.badges')} subtitle={`${badgesEarned} ${t('you.earned')}`}
          style={{ flex: 1, paddingRight: 8 }} onPress={() => router.push('/achievements')} />
        <NeuTile icon="map-legend" title={t('you.heatmap')} subtitle={t('you.allRoutes')}
          style={{ flex: 1, paddingRight: 8 }} onPress={() => router.push('/heatmap')} />
      </View>
      <NeuTile icon="account-group-outline" title={t('fr.leaderboard')} subtitle={t('fr.leaderboardSub')} onPress={() => router.push('/friends')} />

      <NeuCard radius={28} style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <GoalRing value={profile?.monthlyGoalKm ? monthKm(items ?? []) / profile.monthlyGoalKm : 0}
          label={`${monthKm(items ?? []).toFixed(0)}`} sub={t('you.ofGoal').replace('{n}', String(profile?.monthlyGoalKm ?? 0))} />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={F.h2}>{new Date().toLocaleDateString(undefined, { month: 'long' })} {t('you.goal')}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{t('you.allSports')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <NumberField value={profile?.monthlyGoalKm} label={t('you.monthlyGoalA11y')}
              onChange={(monthlyGoalKm) => update({ monthlyGoalKm })}
              style={{ color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 14, paddingHorizontal: 12,
                paddingVertical: 6, minWidth: 64, textAlign: 'center', fontWeight: '700' }} />
            <Text style={{ color: C.muted }}>km</Text>
          </View>
        </View>
      </NeuCard>

      <CalendarCard activities={items ?? []} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 12 }}>
        {SPORTS.map((s) => (
          <NeuButton key={s.key} small icon={s.icon as never} label={sportName(t, s.key)} selected={filter === s.key} onPress={() => setFilter(s.key)} />
        ))}
      </ScrollView>

      <NeuCard radius={28} style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconWell icon="chart-bar" />
          <View style={{ flex: 1 }}>
            <Text style={F.h2}>{t('you.last8')}</Text>
            <Text style={{ color: C.muted, fontSize: 13 }}>{thisWeekKm.toFixed(1)} {t('you.ofThisWeek')} {goal} {t('you.kmThisWeek')}</Text>
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
          <Text style={{ color: C.muted, flex: 1 }}>{t('you.weeklyGoal')}</Text>
          <NumberField value={profile?.weeklyGoalKm} label={t('you.weeklyGoalA11y')}
            onChange={(weeklyGoalKm) => update({ weeklyGoalKm })}
            style={{ color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 14, paddingHorizontal: 14,
              paddingVertical: 8, minWidth: 70, textAlign: 'center', fontWeight: '700' }} />
        </View>
      </NeuCard>

      <NeuCard radius={28} style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconWell icon="trophy-outline" />
          <Text style={F.h2}>{t('you.allTime')}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Stat label={t('you.activities')} value={String(totals.count)} />
          <Stat label={t('you.distance')} value={fmtKm(totals.dist)} unit="km" />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Stat label={t('you.time')} value={fmtDuration(totals.time)} />
          <Stat label={t('you.elev')} value={String(totals.elev)} unit="m" />
        </View>
        <Stat label={t('you.longest')} value={fmtKm(totals.longest)} unit="km" />
      </NeuCard>

      {records.length > 0 && (
        <NeuCard radius={28} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconWell icon="medal-outline" />
            <Text style={F.h2}>{t('you.bestEfforts')}</Text>
          </View>
          {records.map((r) => (
            <NeuCard key={r.labelKey} inset radius={18} padding={12} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.text, fontWeight: '600' }}>{t(r.labelKey)}</Text>
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
            <Text style={F.h2}>{t('you.weight')}</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>{t('you.weightSub')}</Text>
          </View>
          <NumberField value={profile?.weightKg} label={t('you.weightA11y')} max={300}
            onChange={(weightKg) => update({ weightKg })}
            style={{ color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 14, paddingHorizontal: 12,
              paddingVertical: 8, minWidth: 64, textAlign: 'center', fontWeight: '700' }} />
          <Text style={{ color: C.muted }}>kg</Text>
        </View>
      </NeuCard>

      <GearCard activities={items ?? []} />
    </ScrollView>
  );
}
