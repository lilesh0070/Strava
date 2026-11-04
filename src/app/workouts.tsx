import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { NeuCard, NeuTile } from '../components/Neu';
import { useTheme } from '../lib/theme';
import { selectWorkout, useSelectedWorkout } from '../lib/workoutSelection';
import { PRESETS, stepLabel } from '../lib/workouts';

export default function Workouts() {
  const { C, F } = useTheme();
  const selected = useSelectedWorkout();
  const pick = (id: string | null) => { selectWorkout(id); router.back(); };
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 60 }}>
      <Text style={{ color: C.muted }}>
        Pick a session and Stride will talk you through every interval: when to push, when to recover, and how much is left.
      </Text>
      <NeuTile icon="run" title="Free run" subtitle="No structure, just record" onPress={() => pick(null)}
        right={selected == null ? <Text style={{ color: C.accent, fontWeight: '800' }}>✓</Text> : null} />
      {PRESETS.map((w) => (
        <View key={w.id} style={{ gap: 10 }}>
          <NeuTile icon="timer-outline" title={w.name} subtitle={w.description} onPress={() => pick(w.id)}
            right={selected === w.id ? <Text style={{ color: C.accent, fontWeight: '800' }}>✓</Text> : null} />
          {selected === w.id && (
            <NeuCard inset radius={20} padding={12} style={{ gap: 4 }}>
              {w.steps.map((s, i) => (
                <Text key={i} style={{ color: s.kind === 'work' ? C.accent : C.muted, fontSize: 12 }}>
                  {i + 1}. {stepLabel(s)} · {s.by === 'distance' ? `${s.value} m` : `${Math.floor(s.value / 60)}:${String(s.value % 60).padStart(2, '0')}`}
                </Text>
              ))}
            </NeuCard>
          )}
        </View>
      ))}
      <Text style={[F.label, { textAlign: 'center' }]}>Works for runs, rides and walks</Text>
    </ScrollView>
  );
}
