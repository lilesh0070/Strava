// Notes, perceived effort and gear for one activity.
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useT, type Key } from '../lib/i18n';
import { listGear } from '../lib/storage';
import { useTheme } from '../lib/theme';
import { IconWell, NeuButton, NeuCard } from './Neu';
import { gearKindFor, type Activity, type Gear } from '../lib/types';

/** Word for each effort 1..10 (index = effort - 1). */
const EFFORT_KEY: Key[] = ['det.easy', 'det.easy', 'det.moderate', 'det.moderate', 'det.moderate', 'det.hard', 'det.hard', 'det.veryHard', 'det.veryHard', 'det.max'];

export default function DetailsCard({ a, onChange }: { a: Activity; onChange: (next: Activity) => void }) {
  const { C, S, F } = useTheme();
  const { t } = useT();
  const [notes, setNotes] = useState(a.description ?? '');
  const [gear, setGear] = useState<Gear[]>([]);
  useEffect(() => { listGear().then((g) => setGear(g.filter((x) => x.kind === gearKindFor(a.sport) && (!x.retired || x.id === a.gearId)))); }, [a.sport, a.gearId]);

  return (
    <NeuCard radius={28} style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconWell icon="note-text-outline" />
        <Text style={F.h2}>{t('det.title')}</Text>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={F.label}>{t('det.notes')}</Text>
        <TextInput
          value={notes} onChangeText={setNotes} multiline placeholder={t('det.notesEg')}
          placeholderTextColor={C.muted}
          onBlur={() => notes !== (a.description ?? '') && onChange({ ...a, description: notes.trim() })}
          style={{ color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 18, padding: 14, minHeight: 72, textAlignVertical: 'top' }}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={F.label}>{t('det.effort')} {a.effort ? `· ${a.effort}/10 ${t(EFFORT_KEY[a.effort - 1] ?? 'det.max')}` : ''}</Text>
        <View style={{ flexDirection: 'row', gap: 4, padding: 5, borderRadius: 16, backgroundColor: C.bg, boxShadow: S.insetSm }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Pressable key={n} onPress={() => onChange({ ...a, effort: a.effort === n ? undefined : n })}
              accessibilityRole="radio" accessibilityState={{ selected: a.effort === n }} accessibilityLabel={t('det.effortA11y').replace('{n}', String(n))} hitSlop={{ top: 8, bottom: 8 }}
              style={{ flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: a.effort && n <= a.effort ? C.accent : C.bg }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: a.effort && n <= a.effort ? C.accentText : C.muted }}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={F.label}>{t(gearKindFor(a.sport) === 'bike' ? 'det.bike' : 'det.shoes')}</Text>
        {gear.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 4 }}>
            <NeuButton small label={t('det.none')} selected={!a.gearId} onPress={() => onChange({ ...a, gearId: undefined })} />
            {gear.map((g) => (
              <NeuButton key={g.id} small label={g.name} selected={a.gearId === g.id} onPress={() => onChange({ ...a, gearId: g.id })} />
            ))}
          </View>
        ) : (
          <Text style={{ color: C.muted }}>{t('det.addGear')}</Text>
        )}
      </View>
    </NeuCard>
  );
}
