import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { NeuCard, NeuProgress } from '../components/Neu';
import { evaluateAchievements, type Achievement } from '../lib/achievements';
import { wellnessBadges } from '../lib/health';
import { badgeDetail, badgeTitle, useT } from '../lib/i18n';
import { getProfile } from '../lib/storage';
import { useTheme } from '../lib/theme';
import { useActivities } from '../lib/useActivities';
import { useWellness } from '../lib/wellnessStore';

const order = (list: Achievement[]) => [...list].sort((a, b) => Number(b.earned) - Number(a.earned) || b.progress - a.progress);

export default function Achievements() {
  const { C, S, F } = useTheme();
  const { t } = useT();
  const { items } = useActivities();
  const log = useWellness();
  const [weight, setWeight] = useState(70);
  useEffect(() => { getProfile().then((p) => setWeight(p.weightKg || 70)); }, []);
  const groups = [
    { title: t('ach.wellness'), list: order(wellnessBadges(log ?? {}, items ?? [], weight)) },
    { title: t('ach.activity'), list: order(evaluateAchievements(items ?? [])) },
  ];
  const all = groups.flatMap((g) => g.list);
  const earned = all.filter((x) => x.earned).length;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 60 }}>
      <Text style={{ color: C.muted }}>{t('ach.earnedOf').replace('{n}', String(earned)).replace('{of}', String(all.length))}</Text>
      {groups.map((g) => (
        <View key={g.title} style={{ gap: 14 }}>
          <Text style={[F.label, { marginLeft: 6 }]}>{g.title}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 20 }}>
            {g.list.map((b) => (
              <NeuCard key={b.id} radius={26} style={{ width: '47%', alignItems: 'center', gap: 10, opacity: b.earned ? 1 : 0.75 }}>
                <View style={{ width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: b.earned ? C.accent : C.bg, boxShadow: b.earned ? S.glow : S.inset }}>
                  <MaterialCommunityIcons name={b.icon as never} size={32} color={b.earned ? C.accentText : C.faint} />
                </View>
                <Text style={[F.h2, { fontSize: 15, textAlign: 'center' }]}>{badgeTitle(t, b.id)}</Text>
                <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>{badgeDetail(t, b.id)}</Text>
                {b.earned ? (
                  <Text style={{ color: C.accent, fontSize: 11, fontWeight: '700' }}>
                    {b.earnedAt ? new Date(b.earnedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : t('ach.earned')}
                  </Text>
                ) : (
                  <View style={{ alignSelf: 'stretch', gap: 4 }}>
                    <NeuProgress value={b.progress} />
                    <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center' }}>{Math.round(b.progress * 100)}%</Text>
                  </View>
                )}
              </NeuCard>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
