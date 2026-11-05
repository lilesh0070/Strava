import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { NeuCard, NeuTile } from '../components/Neu';
import { useT } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { selectWorkout, useSelectedWorkout } from '../lib/workoutSelection';
import { PRESETS, stepKey } from '../lib/workouts';

export default function Workouts() {
  const { C, F } = useTheme();
  const { t } = useT();
  const selected = useSelectedWorkout();
  const pick = (id: string | null) => { selectWorkout(id); router.back(); };
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 60 }}>
      <Text style={{ color: C.muted }}>{t('wo.intro')}</Text>
      <NeuTile icon="run" title={t('wo.freeRun')} subtitle={t('wo.freeRunSub')} onPress={() => pick(null)} selected={selected == null}
        right={selected == null ? <Text style={{ color: C.accentInk, fontWeight: '800' }}>✓</Text> : null} />
      {PRESETS.map((w) => (
        <View key={w.id} style={{ gap: 10 }}>
          <NeuTile icon="timer-outline" title={t(w.nameKey)} subtitle={t(w.descKey)} onPress={() => pick(w.id)} selected={selected === w.id}
            right={selected === w.id ? <Text style={{ color: C.accentInk, fontWeight: '800' }}>✓</Text> : null} />
          {selected === w.id && (
            <NeuCard inset radius={20} padding={12} style={{ gap: 4 }}>
              {w.steps.map((s, i) => (
                <Text key={i} style={{ color: s.kind === 'work' ? C.accent : C.muted, fontSize: 12 }}>
                  {i + 1}. {t(stepKey(s))} · {s.by === 'distance' ? `${s.value} m` : `${Math.floor(s.value / 60)}:${String(s.value % 60).padStart(2, '0')}`}
                </Text>
              ))}
            </NeuCard>
          )}
        </View>
      ))}
      <Text style={[F.label, { textAlign: 'center' }]}>{t('wo.worksFor')}</Text>
    </ScrollView>
  );
}
