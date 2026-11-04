import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { fmtKm } from '../lib/geo';
import { listGear, saveGearList } from '../lib/storage';
import { useTheme } from '../lib/theme';
import { IconWell, NeuButton, NeuCard, NeuIconButton, NeuProgress } from './Neu';
import { DEFAULT_SHOE_LIMIT_KM, type Activity, type Gear, type GearKind } from '../lib/types';

export default function GearCard({ activities }: { activities: Activity[] }) {
  const { C, S, F } = useTheme();
  const [gear, setGear] = useState<Gear[]>([]);
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState<GearKind>('shoes');
  useEffect(() => { listGear().then(setGear); }, []);

  const save = (next: Gear[]) => { setGear(next); saveGearList(next); };

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    const first = !gear.some((g) => g.kind === kind && !g.retired);
    save([...gear, { id: Date.now().toString(36), name, kind, isDefault: first, limitKm: kind === 'shoes' ? DEFAULT_SHOE_LIMIT_KM : undefined }]);
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
    <NeuCard radius={28} style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconWell icon="shoe-sneaker" />
        <Text style={F.h2}>Gear</Text>
      </View>
      {gear.length === 0 && <Text style={{ color: C.muted }}>Add your shoes or bike to see how far they have gone.</Text>}
      {gear.map((g) => (
        <Pressable key={g.id} onPress={() => menu(g)} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 20,
            backgroundColor: C.bg, boxShadow: pressed ? S.insetSm : S.raisedSm, opacity: g.retired ? 0.55 : 1 })}>
          <IconWell icon={g.kind === 'bike' ? 'bike' : 'shoe-sneaker'} size={38} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: C.text, fontWeight: '600' }}>
              {g.name}{g.isDefault ? <Text style={{ color: C.accent, fontSize: 12 }}>  default</Text> : null}
              {g.retired ? <Text style={{ color: C.muted, fontSize: 12 }}>  retired</Text> : null}
            </Text>
            {g.limitKm && !g.retired ? (() => {
              const km = used(g.id) / 1000, frac = km / g.limitKm;
              return (
                <>
                  <NeuProgress value={frac} />
                  <Text style={{ color: frac >= 0.9 ? C.danger : C.muted, fontSize: 11 }}>
                    {frac >= 1 ? 'Worn out — time for new shoes' : frac >= 0.9 ? 'Nearly worn out — plan a replacement'
                      : `${Math.max(0, Math.round(g.limitKm - km))} km of ${g.limitKm} left`}
                  </Text>
                </>
              );
            })() : null}
          </View>
          <Text style={{ color: C.text, fontVariant: ['tabular-nums'] }}>{fmtKm(used(g.id))} km</Text>
        </Pressable>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <NeuIconButton icon={kind === 'bike' ? 'bike' : 'shoe-sneaker'} size={42} color={C.accent}
          accessibilityLabel={`Gear type: ${kind}. Tap to switch`} onPress={() => setKind(kind === 'shoes' ? 'bike' : 'shoes')} />
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={add}
          placeholder={kind === 'bike' ? 'New bike name' : 'New shoes name'} placeholderTextColor={C.muted}
          style={{ flex: 1, color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }} />
        <NeuButton small accent label="Add" onPress={add} />
      </View>
    </NeuCard>
  );
}
