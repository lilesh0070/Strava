// Log an activity by hand: treadmill, gym bike, or a run the phone didn't record.
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { NeuButton, NeuCard, NeuIconButton } from '../components/Neu';
import { autoSync } from '../lib/githubSync';
import { parseDuration } from '../lib/parse';
import { defaultGear, saveActivity } from '../lib/storage';
import { useTheme } from '../lib/theme';
import { defaultName, gearKindFor, newActivityId, SPORTS, type Activity, type Sport } from '../lib/types';

export default function AddActivity() {
  const { C, S, F } = useTheme();
  const [sport, setSport] = useState<Sport>('run');
  const [daysAgo, setDaysAgo] = useState(0);
  const [dist, setDist] = useState('');
  const [dur, setDur] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false); // blocks a double tap before the disabled state renders

  const input = { color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16 };
  const day = new Date(); day.setDate(day.getDate() - daysAgo);

  const save = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try { await saveEntry(); }
    catch (e) { Alert.alert('Could not save', String((e as Error)?.message ?? e)); } // the form stays filled in
    finally { busy.current = false; setSaving(false); }
  };

  const saveEntry = async () => {
    const km = Number(dist.replace(',', '.'));
    const sec = parseDuration(dur);
    if (!Number.isFinite(km) || km < 0 || km > 1000) return Alert.alert('Check distance', 'Enter kilometres, e.g. 5.2');
    if (!sec) return Alert.alert('Check duration', 'Enter minutes (45), mm:ss (32:10) or h:mm:ss (1:05:30)');
    const startedAt = new Date(day); startedAt.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
    startedAt.setTime(startedAt.getTime() - sec * 1000);
    const gear = await defaultGear(gearKindFor(sport)).catch(() => undefined);
    const a: Activity = {
      id: newActivityId(startedAt.getTime(), 'm'),
      name: name.trim() || defaultName(sport, startedAt.getTime()),
      description: notes.trim() || undefined,
      sport, startedAt: startedAt.getTime(), movingSec: sec, elapsedSec: sec,
      distanceM: Math.round(km * 1000), elevGainM: 0, segments: [], manual: true, gearId: gear?.id,
    };
    await saveActivity(a);
    autoSync();
    router.replace(`/activity/${a.id}`);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {SPORTS.map((s) => (
          <View key={s.key} style={{ alignItems: 'center', gap: 8 }}>
            <NeuIconButton icon={s.icon as never} size={58} color={sport === s.key ? C.accent : C.muted}
              accessibilityLabel={s.label} onPress={() => setSport(s.key)} />
            <Text style={{ color: sport === s.key ? C.accent : C.muted, fontWeight: '700', fontSize: 13 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      <NeuCard radius={28} style={{ gap: 16 }}>
        <Text style={F.label}>When</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <NeuIconButton icon="chevron-left" size={40} accessibilityLabel="Earlier day" onPress={() => setDaysAgo(daysAgo + 1)} />
          <Text style={{ flex: 1, textAlign: 'center', color: C.text, fontWeight: '700', fontSize: 16 }}>
            {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
          <NeuIconButton icon="chevron-right" size={40} color={daysAgo === 0 ? C.faint : C.text} accessibilityLabel="Later day"
            onPress={() => setDaysAgo(Math.max(0, daysAgo - 1))} />
        </View>

        <Text style={F.label}>Distance (km)</Text>
        <TextInput value={dist} onChangeText={setDist} keyboardType="decimal-pad" placeholder="5.0" placeholderTextColor={C.muted} style={input} />

        <Text style={F.label}>Duration</Text>
        <TextInput value={dur} onChangeText={setDur} keyboardType="numbers-and-punctuation" placeholder="45 or 32:10 or 1:05:30"
          placeholderTextColor={C.muted} style={input} />

        <Text style={F.label}>Name (optional)</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Treadmill intervals" placeholderTextColor={C.muted} style={input} />

        <Text style={F.label}>Notes (optional)</Text>
        <TextInput value={notes} onChangeText={setNotes} multiline placeholder="How did it go?" placeholderTextColor={C.muted}
          style={[input, { minHeight: 80, textAlignVertical: 'top' }]} />
      </NeuCard>

      <NeuButton accent icon="check" label="Save activity" onPress={save} disabled={saving} />
    </ScrollView>
  );
}
