// Health tab: the daily wellness loop for employees. A score that rewards small healthy actions,
// a water tracker, WHO activity progress, one-tap desk breaks, a 10-second check-in, personal
// insights, a tip of the day and a weekly card to share with the team.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import GoalRing from '../../components/GoalRing';
import { IconWell, NeuButton, NeuCard, NeuIconButton, NeuProgress, NeuSegmented, NeuTile } from '../../components/Neu';
import type { ShareCardHandle } from '../../components/ShareCard';
import WeekShareCard from '../../components/WeekShareCard';
import {
  GLASS_ML, WHO_WEEKLY_MIN, checkinStreak, dailyScore, dayKey, emptyDay, fill, insights, minutesByDay, scoreStreak,
  waterGoalMl, weekSummary, type CheckIn, type Insight, type ScorePartKey,
} from '../../lib/health';
import { useT } from '../../lib/i18n';
import { getProfile, getSettings, type Profile } from '../../lib/storage';
import type { Key } from '../../lib/strings';
import { useTheme } from '../../lib/theme';
import { showToast } from '../../lib/toast';
import type { Settings } from '../../lib/types';
import { useActivities } from '../../lib/useActivities';
import { addWater, saveCheckin, useWellness } from '../../lib/wellnessStore';

const MOODS = ['😞', '🙁', '😐', '🙂', '😄'];
const ENERGY = ['battery-10', 'battery-30', 'battery-50', 'battery-70', 'battery'] as const;
const PART_ICON: Record<ScorePartKey, string> = { move: 'run', water: 'cup-water', breaks: 'human-handsup', mind: 'meditation', checkin: 'emoticon-happy-outline' };
const AMBER = '#F5A524';

function SectionTitle({ icon, title, sub, right }: { icon: string; title: string; sub?: string; right?: ReactNode }) {
  const { C, F } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconWell icon={icon as never} />
      <View style={{ flex: 1 }}>
        <Text style={F.h2}>{title}</Text>
        {sub ? <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function CheckInCard({ today, previous, streak }: { today?: CheckIn; previous?: CheckIn; streak: number }) {
  const { C, S, F } = useTheme();
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const seed = today ?? previous;
  const [mood, setMood] = useState(today?.mood ?? 0);
  const [energy, setEnergy] = useState(today?.energy ?? 0);
  const [sleepH, setSleepH] = useState(seed?.sleepH ?? 7);
  const [stress, setStress] = useState<'1' | '2' | '3'>(String(seed?.stress ?? 1) as '1');

  if (today && !editing) {
    return (
      <NeuCard radius={28} style={{ gap: 12 }}>
        <SectionTitle icon="emoticon-happy-outline" title={t('h.checkin')} sub={fill(t('h.checkinDone'), { n: streak })}
          right={<NeuButton small label={t('h.edit')} onPress={() => {
            setMood(today.mood); setEnergy(today.energy); setSleepH(today.sleepH); setStress(String(today.stress) as '1'); setEditing(true);
          }} />} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
          <Text style={{ fontSize: 30 }}>{MOODS[today.mood - 1]}</Text>
          <MaterialCommunityIcons name={ENERGY[today.energy - 1]} size={28} color={C.accent} />
          <Text style={{ color: C.text, fontWeight: '800', fontSize: 16 }}>{today.sleepH} {t('h.hours')}</Text>
          <Text style={{ color: today.stress >= 3 ? C.danger : today.stress === 2 ? AMBER : C.success, fontWeight: '800' }}>
            {t(today.stress >= 3 ? 'h.high' : today.stress === 2 ? 'h.medium' : 'h.low')}
          </Text>
        </View>
      </NeuCard>
    );
  }

  const pick = (selected: boolean) => ({ width: 50, height: 50, borderRadius: 25, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: C.bg, boxShadow: selected ? S.inset : S.raisedSm });
  return (
    <NeuCard radius={28} style={{ gap: 16 }}>
      <SectionTitle icon="emoticon-happy-outline" title={t('h.checkin')} sub={t('h.checkinQ')} />
      <Text style={F.label}>{t('h.mood')}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {MOODS.map((m, i) => (
          <Pressable key={m} accessibilityRole="button" accessibilityLabel={`${t('h.mood')} ${i + 1}`} accessibilityState={{ selected: mood === i + 1 }}
            onPress={() => { Haptics.selectionAsync().catch(() => undefined); setMood(i + 1); }} style={pick(mood === i + 1)}>
            <Text style={{ fontSize: 26, opacity: mood && mood !== i + 1 ? 0.45 : 1 }}>{m}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={F.label}>{t('h.energy')}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {ENERGY.map((icon, i) => (
          <Pressable key={icon} accessibilityRole="button" accessibilityLabel={`${t('h.energy')} ${i + 1}`} accessibilityState={{ selected: energy === i + 1 }}
            onPress={() => { Haptics.selectionAsync().catch(() => undefined); setEnergy(i + 1); }} style={pick(energy === i + 1)}>
            <MaterialCommunityIcons name={icon} size={24} color={energy === i + 1 ? C.accent : C.muted} />
          </Pressable>
        ))}
      </View>
      <Text style={F.label}>{t('h.sleep')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <NeuIconButton icon="minus" size={40} accessibilityLabel="Less sleep" onPress={() => setSleepH((h) => Math.max(0, h - 0.5))} />
        <Text style={{ color: sleepH < 7 ? AMBER : C.text, fontSize: 24, fontWeight: '900', width: 100, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
          {sleepH} {t('h.hours')}
        </Text>
        <NeuIconButton icon="plus" size={40} accessibilityLabel="More sleep" onPress={() => setSleepH((h) => Math.min(14, h + 0.5))} />
      </View>
      <Text style={F.label}>{t('h.stress')}</Text>
      <NeuSegmented value={stress} onChange={setStress}
        options={[{ key: '1', label: t('h.low') }, { key: '2', label: t('h.medium') }, { key: '3', label: t('h.high') }]} />
      <NeuButton accent icon="check" label={t('h.save')} disabled={!mood || !energy} onPress={async () => {
        await saveCheckin({ mood, energy, sleepH, stress: Number(stress), at: Date.now() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setEditing(false);
      }} />
    </NeuCard>
  );
}

export default function HealthScreen() {
  const { C, S, F } = useTheme();
  const { t } = useT();
  const log = useWellness();
  const { items } = useActivities();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [, setNow] = useState(0);
  const shareRef = useRef<ShareCardHandle>(null);

  useFocusEffect(useCallback(() => {
    getProfile().then(setProfile);
    getSettings().then(setSettings);
    setNow(Date.now()); // re-evaluate "today" when coming back to the tab
  }, []));

  const today = dayKey();
  const acts = useMemo(() => items ?? [], [items]);
  const minutes = useMemo(() => minutesByDay(acts), [acts]);
  const weight = profile?.weightKg || 70;
  const day = log?.[today] ?? emptyDay();
  const activeMin = Math.round(minutes[today] ?? 0);
  const goal = waterGoalMl(weight, activeMin);
  const score = dailyScore(day, activeMin, goal);
  const streak = useMemo(() => (log ? scoreStreak(log, minutes, weight, today) : 0), [log, minutes, weight, today]);
  const checkins = useMemo(() => (log ? checkinStreak(log, today) : 0), [log, today]);
  const week = useMemo(() => (log ? weekSummary(log, acts, weight, today) : null), [log, acts, weight, today]);
  const tips = useMemo(() => (log ? insights(log, acts, weight) : []), [log, acts, weight]);
  const previousCheckin = useMemo(() => {
    const keys = Object.keys(log ?? {}).filter((k) => k < today && log?.[k]?.checkin).sort();
    return keys.length ? log?.[keys[keys.length - 1]]?.checkin : undefined;
  }, [log, today]);

  const hour = new Date().getHours();
  const greet = t(hour < 12 ? 'h.morning' : hour < 17 ? 'h.afternoon' : 'h.evening');
  const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
  const tipKey = `tip.${(doy % 20) + 1}` as Key;
  const glasses = Math.round(goal / GLASS_ML), drunk = Math.floor(day.waterMl / GLASS_ML);
  const breaksToday = day.breaks + day.eyeBreaks;
  const weekMin = week?.activeMin ?? 0;
  const dayLabels = t('h.days').split(',');

  const drink = async (ml: number) => {
    const before = day.waterMl;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    await addWater(ml);
    if (ml > 0 && before < goal && before + ml >= goal) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      showToast(`💧 ${t('h.water')} ✓ ${goal} ml`);
    }
  };
  const openBreak = (kind: 'stretch' | 'breathe' | 'eyes') => router.push({ pathname: '/break', params: { kind } });
  const shareWeek = async () => {
    try {
      const uri = await captureRef(shareRef as unknown as Parameters<typeof captureRef>[0], { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('h.share') });
    } catch (e) { Alert.alert(t('h.share'), String((e as Error)?.message ?? e)); }
  };
  const insightAction = (i: Insight) => {
    if (i.action === 'water') return <NeuButton small icon="plus" label={t('h.addGlass')} onPress={() => drink(GLASS_ML)} />;
    if (i.action) return <NeuButton small icon="play" label={t('h.go')} onPress={() => openBreak(i.action as 'stretch')} />;
    return null;
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 40 }}>
        <View>
          <Text style={[F.h1, { fontSize: 24 }]} numberOfLines={1}>{greet}{profile?.name ? `, ${profile.name}` : ''} 👋</Text>
          <Text style={{ color: C.muted }}>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>

        {/* wellness score */}
        <NeuCard radius={30} style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <GoalRing value={score.total / 100} label={String(score.total)} sub={t('h.score')} size={124} />
          <View style={{ flex: 1, gap: 7 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="fire" size={18} color={streak ? C.accent : C.faint} />
              <Text style={{ color: streak ? C.text : C.muted, fontWeight: '800', fontSize: 13, flex: 1 }} numberOfLines={2}>
                {streak ? fill(t('h.streak'), { n: streak }) : t('h.streakNone')}
              </Text>
            </View>
            {score.parts.map((p) => (
              <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name={PART_ICON[p.key] as never} size={14} color={p.points >= p.max ? C.success : C.muted} />
                <Text style={{ color: C.muted, fontSize: 11, width: 58 }} numberOfLines={1}>{t(`h.part.${p.key}` as Key)}</Text>
                <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.bg, boxShadow: S.insetSm, overflow: 'hidden' }}>
                  <View style={{ height: 6, width: `${(p.points / p.max) * 100}%`, borderRadius: 3, backgroundColor: p.points >= p.max ? C.success : C.accent }} />
                </View>
              </View>
            ))}
          </View>
        </NeuCard>

        {/* water */}
        <NeuCard radius={28} style={{ gap: 14 }}>
          <SectionTitle icon="cup-water" title={t('h.water')} sub={fill(t('h.waterSub'), { ml: day.waterMl, goal })} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {Array.from({ length: Math.max(glasses, drunk) }, (_, i) => (
              <MaterialCommunityIcons key={i} name="cup-water" size={26} color={i < drunk ? '#3B9EFF' : C.faint} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <NeuIconButton icon="minus" size={46} accessibilityLabel="Remove a glass" onPress={() => day.waterMl > 0 && drink(-GLASS_ML)} />
            <NeuButton accent icon="plus" label={`${t('h.addGlass')} · ${GLASS_ML} ml`} style={{ flex: 1 }} onPress={() => drink(GLASS_ML)} />
          </View>
        </NeuCard>

        {/* active minutes (WHO) */}
        <NeuCard radius={28} style={{ gap: 14 }}>
          <SectionTitle icon="run" title={t('h.move')} sub={fill(t('h.moveSub'), { n: activeMin, w: weekMin })}
            right={<NeuButton small icon="record-circle-outline" label={t('h.record')} onPress={() => router.navigate('/record')} />} />
          <NeuProgress value={weekMin / WHO_WEEKLY_MIN} />
        </NeuCard>

        {/* quick breaks */}
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={[F.label, { marginLeft: 6 }]}>{t('h.quick')}</Text>
            <Text style={{ color: breaksToday >= 4 ? C.success : C.muted, fontSize: 12, fontWeight: '700' }}>
              {fill(t('h.breaksToday'), { n: breaksToday })}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {([['stretch', 'human-handsup', 'h.stretch', 'h.stretchSub'], ['breathe', 'meditation', 'h.breathe', 'h.breatheSub'],
              ['eyes', 'eye-outline', 'h.eyes', 'h.eyesSub']] as const).map(([kind, icon, title, sub]) => (
              <Pressable key={kind} accessibilityRole="button" accessibilityLabel={t(title)} onPress={() => { Haptics.selectionAsync().catch(() => undefined); openBreak(kind); }}
                style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 6, borderRadius: 24,
                  backgroundColor: C.bg, boxShadow: pressed ? S.inset : S.raised })}>
                <IconWell icon={icon} size={46} />
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 13, textAlign: 'center' }} numberOfLines={1}>{t(title)}</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>{t(sub)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* daily check-in */}
        <CheckInCard key={`${today}-${day.checkin?.at ?? 0}`} today={day.checkin} previous={previousCheckin}
          streak={checkins} />

        {/* insights */}
        {tips.length > 0 && (
          <NeuCard radius={28} style={{ gap: 12 }}>
            <SectionTitle icon="lightbulb-on-outline" title={t('h.insights')} />
            {tips.map((i) => (
              <NeuCard key={i.key} inset radius={20} padding={14} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <MaterialCommunityIcons size={20} color={i.tone === 'warn' ? AMBER : i.tone === 'good' ? C.success : C.accent}
                    name={i.tone === 'warn' ? 'alert-circle-outline' : i.tone === 'good' ? 'check-circle-outline' : 'information-outline'} />
                  <Text style={{ color: C.text, flex: 1, lineHeight: 20 }}>{fill(t(i.key), i.vars)}</Text>
                </View>
                {insightAction(i) ? <View style={{ alignSelf: 'flex-end' }}>{insightAction(i)}</View> : null}
              </NeuCard>
            ))}
          </NeuCard>
        )}

        {/* tip of the day */}
        <NeuCard radius={28} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <IconWell icon="star-outline" />
          <View style={{ flex: 1 }}>
            <Text style={F.label}>{t('h.tip')}</Text>
            <Text style={{ color: C.text, marginTop: 4, lineHeight: 20 }}>{t(tipKey)}</Text>
          </View>
        </NeuCard>

        {/* week */}
        {week && (
          <NeuCard radius={28} style={{ gap: 16 }}>
            <SectionTitle icon="calendar-week" title={t('h.week')} sub={fill(t('h.weekSub'), { n: week.avgScore })} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, borderRadius: 20, padding: 12, backgroundColor: C.bg, boxShadow: S.inset }}>
              {dayLabels.map((l, i) => {
                const v = week.scores[i];
                const isToday = i === week.scores.length - 1;
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 16, height: v == null ? 4 : Math.max(4, (v / 100) * 50), borderRadius: 8,
                      backgroundColor: v == null ? C.faint : isToday || v >= 50 ? C.accent : C.faint, opacity: v == null ? 0.4 : 1 }} />
                    <Text style={{ color: isToday ? C.accent : C.muted, fontSize: 10, fontWeight: isToday ? '800' : '500' }}>{l}</Text>
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row' }}>
              {[[t('sc.active'), `${week.activeMin}`], [t('sc.water'), `${week.waterDays}/${week.days.length}`], [t('sc.breaks'), `${week.breaks}`],
                [t('sc.sleep'), week.avgSleep != null ? `${week.avgSleep.toFixed(1)}h` : '–']].map(([label, value]) => (
                <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[F.label, { fontSize: 9 }]} numberOfLines={1}>{label}</Text>
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 17 }}>{value}</Text>
                </View>
              ))}
            </View>
            <NeuButton icon="share-variant" label={t('h.share')} onPress={shareWeek} />
            <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>{t('h.shareHint')}</Text>
          </NeuCard>
        )}

        <NeuTile icon="bell-ring-outline" title={t('h.reminders')}
          subtitle={settings?.breakReminders
            ? fill(t('h.remindersOn'), { n: settings.breakEveryMin, from: `${settings.workStartH}:00`, to: `${settings.workEndH}:00` })
            : t('h.remindersOff')}
          onPress={() => router.push('/settings')} />

        <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center', paddingHorizontal: 10 }}>{t('h.disclaimer')}</Text>
      </ScrollView>
      {week && (
        <View style={{ position: 'absolute', left: -10000, top: 0 }} pointerEvents="none">
          <WeekShareCard ref={shareRef} week={week} name={profile?.name || 'Athlete'} team={profile?.team ?? ''} />
        </View>
      )}
    </>
  );
}
