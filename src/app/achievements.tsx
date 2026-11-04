import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';
import { NeuCard, NeuProgress } from '../components/Neu';
import { evaluateAchievements } from '../lib/achievements';
import { useTheme } from '../lib/theme';
import { useActivities } from '../lib/useActivities';

export default function Achievements() {
  const { C, S, F } = useTheme();
  const { items } = useActivities();
  const list = evaluateAchievements(items ?? []).sort((a, b) => Number(b.earned) - Number(a.earned) || b.progress - a.progress);
  const earned = list.filter((x) => x.earned).length;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 60 }}>
      <Text style={{ color: C.muted }}>{earned} of {list.length} earned</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 20 }}>
        {list.map((b) => (
          <NeuCard key={b.id} radius={26} style={{ width: '47%', alignItems: 'center', gap: 10, opacity: b.earned ? 1 : 0.75 }}>
            <View style={{ width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center',
              backgroundColor: b.earned ? C.accent : C.bg, boxShadow: b.earned ? S.glow : S.inset }}>
              <MaterialCommunityIcons name={b.icon as never} size={32} color={b.earned ? C.accentText : C.faint} />
            </View>
            <Text style={[F.h2, { fontSize: 15, textAlign: 'center' }]}>{b.title}</Text>
            <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>{b.detail}</Text>
            {b.earned ? (
              <Text style={{ color: C.accent, fontSize: 11, fontWeight: '700' }}>
                {b.earnedAt ? new Date(b.earnedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Earned'}
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
    </ScrollView>
  );
}
