// Notes, perceived effort and gear for one activity.
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { listGear } from '../lib/storage';
import { useTheme } from '../lib/theme';
import { IconWell, NeuButton, NeuCard } from './Neu';
import { gearKindFor, type Activity, type Gear } from '../lib/types';

const EFFORT_LABEL = ['', 'Easy', 'Easy', 'Moderate', 'Moderate', 'Moderate', 'Hard', 'Hard', 'Very hard', 'Very hard', 'Max'];

export default function DetailsCard({ a, onChange }: { a: Activity; onChange: (next: Activity) => void }) {
  const { C, S, F } = useTheme();
  const [notes, setNotes] = useState(a.description ?? '');
  const [gear, setGear] = useState<Gear[]>([]);
  useEffect(() => { listGear().then((g) => setGear(g.filter((x) => x.kind === gearKindFor(a.sport) && (!x.retired || x.id === a.gearId)))); }, [a.sport, a.gearId]);

  return (
    <NeuCard radius={28} style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconWell icon="note-text-outline" />
        <Text style={F.h2}>Details</Text>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={F.label}>Notes</Text>
        <TextInput
          value={notes} onChangeText={setNotes} multiline placeholder="How did it feel?"
          placeholderTextColor={C.muted}
          onBlur={() => notes !== (a.description ?? '') && onChange({ ...a, description: notes.trim() })}
          style={{ color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 18, padding: 14, minHeight: 72, textAlignVertical: 'top' }}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={F.label}>Perceived effort {a.effort ? `· ${a.effort}/10 ${EFFORT_LABEL[a.effort]}` : ''}</Text>
        <View style={{ flexDirection: 'row', gap: 4, padding: 5, borderRadius: 16, backgroundColor: C.bg, boxShadow: S.insetSm }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Pressable key={n} onPress={() => onChange({ ...a, effort: a.effort === n ? undefined : n })}
              accessibilityLabel={`Effort ${n}`}
              style={{ flex: 1, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                backgroundColor: a.effort && n <= a.effort ? C.accent : C.bg }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: a.effort && n <= a.effort ? C.accentText : C.muted }}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={F.label}>{gearKindFor(a.sport) === 'bike' ? 'Bike' : 'Shoes'}</Text>
        {gear.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 4 }}>
            <NeuButton small label="None" selected={!a.gearId} onPress={() => onChange({ ...a, gearId: undefined })} />
            {gear.map((g) => (
              <NeuButton key={g.id} small label={g.name} selected={a.gearId === g.id} onPress={() => onChange({ ...a, gearId: g.id })} />
            ))}
          </View>
        ) : (
          <Text style={{ color: C.muted }}>Add gear from the You tab to track its distance.</Text>
        )}
      </View>
    </NeuCard>
  );
}
