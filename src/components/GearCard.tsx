import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { fmtKm } from '../lib/geo';
import { useT } from '../lib/i18n';
import { listGear, onDataChanged, updateGear } from '../lib/storage';
import { useTheme } from '../lib/theme';
import { IconWell, NeuButton, NeuCard, NeuIconButton, NeuProgress } from './Neu';
import { DEFAULT_SHOE_LIMIT_KM, type Activity, type Gear, type GearKind } from '../lib/types';

export default function GearCard({ activities }: { activities: Activity[] }) {
  const { C, S, F } = useTheme();
  const { t } = useT();
  const [gear, setGear] = useState<Gear[]>([]);
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState<GearKind>('shoes');
  useEffect(() => {
    const load = () => { listGear().then(setGear); };
    load();
    return onDataChanged(load); // e.g. gear added by a restore
  }, []);

  // always change the latest stored list, so a restore that happened meanwhile is never overwritten
  const save = (fn: (list: Gear[]) => Gear[]) => { updateGear(fn).then(setGear).catch(() => undefined); };

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    const id = Date.now().toString(36);
    save((list) => [...list, { id, name, kind, isDefault: !list.some((g) => g.kind === kind && !g.retired),
      limitKm: kind === 'shoes' ? DEFAULT_SHOE_LIMIT_KM : undefined }]);
    setDraft('');
  };

  const menu = (g: Gear) => Alert.alert(g.name, undefined, [
    { text: t('gear.makeDefault'), onPress: () => save((list) => list.map((x) => (x.kind === g.kind ? { ...x, isDefault: x.id === g.id } : x))) },
    { text: g.retired ? t('gear.unretire') : t('gear.retire'), onPress: () => save((list) => list.map((x) => (x.id === g.id ? { ...x, retired: !x.retired, isDefault: false } : x))) },
    { text: t('gear.delete'), style: 'destructive', onPress: () => save((list) => list.filter((x) => x.id !== g.id)) },
    { text: t('gear.cancel'), style: 'cancel' },
  ]);

  const used = (id: string) => activities.filter((a) => a.gearId === id).reduce((s, a) => s + a.distanceM, 0);

  return (
    <NeuCard radius={28} style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconWell icon="shoe-sneaker" />
        <Text style={F.h2}>{t('gear.title')}</Text>
      </View>
      {gear.length === 0 && <Text style={{ color: C.muted }}>{t('gear.empty')}</Text>}
      {gear.map((g) => (
        <Pressable key={g.id} onPress={() => menu(g)} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 20,
            backgroundColor: C.bg, boxShadow: pressed ? S.insetSm : S.raisedSm, opacity: g.retired ? 0.55 : 1 })}>
          <IconWell icon={g.kind === 'bike' ? 'bike' : 'shoe-sneaker'} size={38} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: C.text, fontWeight: '600' }}>
              {g.name}{g.isDefault ? <Text style={{ color: C.accent, fontSize: 12 }}>  {t('gear.default')}</Text> : null}
              {g.retired ? <Text style={{ color: C.muted, fontSize: 12 }}>  {t('gear.retired')}</Text> : null}
            </Text>
            {g.limitKm && !g.retired ? (() => {
              const km = used(g.id) / 1000, frac = km / g.limitKm;
              return (
                <>
                  <NeuProgress value={frac} />
                  <Text style={{ color: frac >= 0.9 ? C.danger : C.muted, fontSize: 11 }}>
                    {frac >= 1 ? t('gear.wornOut') : frac >= 0.9 ? t('gear.nearlyWorn')
                      : t('gear.left').replace('{n}', String(Math.max(0, Math.round(g.limitKm - km)))).replace('{of}', String(g.limitKm))}
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
          accessibilityLabel={t('gear.typeA11y').replace('{kind}', t(kind === 'bike' ? 'det.bike' : 'det.shoes'))} onPress={() => setKind(kind === 'shoes' ? 'bike' : 'shoes')} />
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={add}
          placeholder={t(kind === 'bike' ? 'gear.newBike' : 'gear.newShoes')} placeholderTextColor={C.muted}
          style={{ flex: 1, color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }} />
        <NeuButton small accent label={t('gear.add')} onPress={add} />
      </View>
    </NeuCard>
  );
}
