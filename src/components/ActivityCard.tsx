import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { fmtDuration, fmtKm, fmtPace, fmtSpeed } from '../lib/geo';
import { activitySteps, fmtSteps } from '../lib/steps';
import { useT } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { sportInfo, type Activity } from '../lib/types';
import { IconWell, NeuCard, NeuIconButton } from './Neu';
import RouteThumb from './RouteThumb';
import Stat from './Stat';

export function fmtDate(t: number) {
  return new Date(t).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

function ActivityCard({ a }: { a: Activity }) {
  const { width } = useWindowDimensions();
  const { C, S, F } = useTheme();
  const { t } = useT();
  const info = sportInfo(a.sport);
  const steps = activitySteps(a);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a.name}, ${fmtKm(a.distanceM)} kilometres`}
      onPress={() => router.push(`/activity/${a.id}`)}
      style={({ pressed }) => ({
        backgroundColor: C.bg, borderRadius: 28, padding: 16, marginHorizontal: 20, marginBottom: 22,
        boxShadow: pressed ? S.inset : S.raised, transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <IconWell icon={info.icon as never} />
        <View style={{ flex: 1 }}>
          <Text style={[F.h2, { fontSize: 17 }]} numberOfLines={1}>{a.name}</Text>
          <Text style={{ color: C.muted, fontSize: 13 }}>{fmtDate(a.startedAt)}</Text>
        </View>
        <NeuIconButton icon="share-variant" size={40} color={C.accentInk} accessibilityLabel={`${t('card.share')} ${a.name}`}
          onPress={() => router.push(`/share/${a.id}`)} />
      </View>
      {a.description ? <Text style={{ color: C.text, marginBottom: 12 }} numberOfLines={3}>{a.description}</Text> : null}
      <View style={{ flexDirection: 'row', marginBottom: 14 }}>
        <Stat label={t('card.distance')} value={fmtKm(a.distanceM)} unit="km" />
        {info.usesPace
          ? <Stat label={t('card.pace')} value={fmtPace(a.distanceM, a.movingSec)} unit="/km" />
          : <Stat label={t('card.speed')} value={fmtSpeed(a.distanceM, a.movingSec)} unit="km/h" />}
        <Stat label={t('card.time')} value={fmtDuration(a.movingSec)} />
      </View>
      {steps ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4, marginBottom: 12 }}>
          <MaterialCommunityIcons name="shoe-print" size={16} color={C.muted} />
          <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>
            {steps.estimated ? '≈' : ''}{fmtSteps(steps.steps)} {t('card.steps')}
          </Text>
        </View>
      ) : null}
      {a.segments.some((g) => g.length > 1) ? (
        <NeuCard inset radius={20} padding={4}>
          <RouteThumb segments={a.segments} width={width - 80} height={140} />
        </NeuCard>
      ) : a.manual ? <Text style={{ color: C.muted, fontSize: 12 }}>{t('act.addedManually')}</Text> : null}
    </Pressable>
  );
}

// Cards re-render only when their own activity changes, which keeps scrolling smooth.
export default memo(ActivityCard, (p, n) => p.a === n.a);
