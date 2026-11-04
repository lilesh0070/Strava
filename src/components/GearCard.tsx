import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { fmtKm } from '../lib/geo';
import { listGear, saveGearList } from '../lib/storage';
import { C, F } from '../lib/theme';
import type { Activity, Gear, GearKind } from '../lib/types';

export default function GearCard({ activities }: { activities: Activity[] }) {
  const [gear, setGear] = useState<Gear[]>([]);
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState<GearKind>('shoes');
  useEffect(() => { listGear().then(setGear); }, []);

  const save = (next: Gear[]) => { setGear(next); saveGearList(next); };

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    const first = !gear.some((g) => g.kind === kind && !g.retired);
    save([...gear, { id: Date.now().toString(36), name, kind, isDefault: first }]);
    setDraft('');
  };

  const menu = (g: Gear) => Alert.alert(g.name, undefined, [
    { text: 'Make default', onPress: () => save(gear.map((x) => (x.kind === g.kind ? { ...x, isDefault: x.id === g.id } : x))) },
    { text: g.retired ? 'Un-retire' : 'Retire', onPress: () => save(gear.map((x) => (x.id === g.id ? { ...x, retired: !x.retired, isDefault: false } : x))) },
    { text: 'Delete', style: 'destructive', onPress: () => save(gear.filter((x) => x.id !== g.id)) },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const used = (id: string) => activities.filter((a) => a.gearId === id).reduce((s, a) => s + a.distanceM, 0);

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12 }}>
      <Text style={F.h2}>Gear</Text>
      {gear.length === 0 && <Text style={{ color: C.muted }}>Add your shoes or bike to see how far they have gone.</Text>}
      {gear.map((g) => (
        <Pressable key={g.id} onPress={() => menu(g)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: g.retired ? 0.5 : 1 }}>
          <MaterialCommunityIcons name={g.kind === 'bike' ? 'bike' : 'shoe-sneaker'} size={22} color={C.route} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: '600' }}>
              {g.name}{g.isDefault ? <Text style={{ color: C.accent, fontSize: 12 }}>  default</Text> : null}
              {g.retired ? <Text style={{ color: C.muted, fontSize: 12 }}>  retired</Text> : null}
            </Text>
          </View>
          <Text style={{ color: C.text, fontVariant: ['tabular-nums'] }}>{fmtKm(used(g.id))} km</Text>
        </Pressable>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Pressable onPress={() => setKind(kind === 'shoes' ? 'bike' : 'shoes')}
          style={{ backgroundColor: C.cardAlt, borderRadius: 8, padding: 8 }} accessibilityLabel="Toggle gear type">
          <MaterialCommunityIcons name={kind === 'bike' ? 'bike' : 'shoe-sneaker'} size={20} color={C.text} />
        </Pressable>
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={add}
          placeholder={kind === 'bike' ? 'New bike name' : 'New shoes name'} placeholderTextColor={C.muted}
          style={{ flex: 1, color: C.text, backgroundColor: C.cardAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }} />
        <Pressable onPress={add} style={{ backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 }}>
          <Text style={{ color: C.accentText, fontWeight: '800' }}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}
