// Notes, perceived effort and gear for one activity.
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { listGear } from '../lib/storage';
import { C, F } from '../lib/theme';
import { gearKindFor, type Activity, type Gear } from '../lib/types';

const EFFORT_LABEL = ['', 'Easy', 'Easy', 'Moderate', 'Moderate', 'Moderate', 'Hard', 'Hard', 'Very hard', 'Very hard', 'Max'];

export default function DetailsCard({ a, onChange }: { a: Activity; onChange: (next: Activity) => void }) {
  const [notes, setNotes] = useState(a.description ?? '');
  const [gear, setGear] = useState<Gear[]>([]);
  useEffect(() => { listGear().then((g) => setGear(g.filter((x) => x.kind === gearKindFor(a.sport) && (!x.retired || x.id === a.gearId)))); }, [a.sport, a.gearId]);

  const chip = (selected: boolean) => ({
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: selected ? C.accent : C.cardAlt,
  });

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 14 }}>
      <Text style={F.h2}>Details</Text>

      <View style={{ gap: 6 }}>
        <Text style={F.label}>Notes</Text>
        <TextInput
          value={notes} onChangeText={setNotes} multiline placeholder="How did it feel?"
          placeholderTextColor={C.muted}
          onBlur={() => notes !== (a.description ?? '') && onChange({ ...a, description: notes.trim() })}
          style={{ color: C.text, backgroundColor: C.cardAlt, borderRadius: 10, padding: 10, minHeight: 64, textAlignVertical: 'top' }}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={F.label}>Perceived effort {a.effort ? `· ${a.effort}/10 ${EFFORT_LABEL[a.effort]}` : ''}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Pressable key={n} onPress={() => onChange({ ...a, effort: a.effort === n ? undefined : n })}
              style={{ flex: 1, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                backgroundColor: a.effort && n <= a.effort ? C.accent : C.cardAlt }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: a.effort && n <= a.effort ? C.accentText : C.muted }}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={F.label}>{gearKindFor(a.sport) === 'bike' ? 'Bike' : 'Shoes'}</Text>
        {gear.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable onPress={() => onChange({ ...a, gearId: undefined })} style={chip(!a.gearId)}>
              <Text style={{ color: !a.gearId ? C.accentText : C.text, fontWeight: '600' }}>None</Text>
            </Pressable>
            {gear.map((g) => (
              <Pressable key={g.id} onPress={() => onChange({ ...a, gearId: g.id })} style={chip(a.gearId === g.id)}>
                <Text style={{ color: a.gearId === g.id ? C.accentText : C.text, fontWeight: '600' }}>{g.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={{ color: C.muted }}>Add gear from the You tab to track its distance.</Text>
        )}
      </View>
    </View>
  );
}
