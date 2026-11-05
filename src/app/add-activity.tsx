// Log an activity by hand: treadmill, gym bike, or a run the phone didn't record.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { NeuButton, NeuCard, NeuIconButton } from '../components/Neu';
import { autoSync } from '../lib/githubSync';
import { parseDuration } from '../lib/parse';
import { defaultGear, getSettings, saveActivity, updateSettings } from '../lib/storage';
import { sportName, useT } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { defaultName, gearKindFor, newActivityId, SPORTS, type Activity, type Sport } from '../lib/types';

export default function AddActivity() {
  const { C, S, F } = useTheme();
  const { t, lang } = useT();
  const [sport, setSportState] = useState<Sport>('run');
  useEffect(() => { getSettings().then((s) => { if (s.lastSport) setSportState(s.lastSport); }).catch(() => undefined); }, []);
  const setSport = (s: Sport) => { setSportState(s); updateSettings({ lastSport: s }).catch(() => undefined); };
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
    catch (e) { Alert.alert(t('add.couldNotSave'), String((e as Error)?.message ?? e)); } // the form stays filled in
    finally { busy.current = false; setSaving(false); }
  };

  const saveEntry = async () => {
    const km = Number(dist.replace(',', '.'));
    const sec = parseDuration(dur);
    if (!Number.isFinite(km) || km < 0 || km > 1000) return Alert.alert(t('add.checkDist'), t('add.checkDistBody'));
    if (!sec) return Alert.alert(t('add.checkDur'), t('add.checkDurBody'));
    const startedAt = new Date(day); startedAt.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
    startedAt.setTime(startedAt.getTime() - sec * 1000);
    const gear = await defaultGear(gearKindFor(sport)).catch(() => undefined);
    const a: Activity = {
      id: newActivityId(startedAt.getTime(), 'm'),
      name: name.trim() || defaultName(sport, startedAt.getTime(), lang),
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
            <NeuIconButton icon={s.icon as never} size={58} color={sport === s.key ? C.accentInk : C.muted}
              accessibilityLabel={sportName(t, s.key)} selected={sport === s.key} onPress={() => setSport(s.key)} />
            <Text style={{ color: sport === s.key ? C.accentInk : C.muted, fontWeight: '700', fontSize: 13 }}>{sportName(t, s.key)}</Text>
          </View>
        ))}
      </View>

      <NeuCard radius={28} style={{ gap: 16 }}>
        <Text style={F.label}>{t('add.when')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <NeuIconButton icon="chevron-left" size={40} accessibilityLabel={t('add.earlierDay')} onPress={() => setDaysAgo(daysAgo + 1)} />
          <Text style={{ flex: 1, textAlign: 'center', color: C.text, fontWeight: '700', fontSize: 16 }}>
            {daysAgo === 0 ? t('add.today') : daysAgo === 1 ? t('add.yesterday') : day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
          <NeuIconButton icon="chevron-right" size={40} color={daysAgo === 0 ? C.faint : C.text} accessibilityLabel={t('add.laterDay')}
            onPress={() => setDaysAgo(Math.max(0, daysAgo - 1))} />
        </View>

        <Text style={F.label}>{t('add.distance')}</Text>
        <TextInput value={dist} onChangeText={setDist} keyboardType="decimal-pad" placeholder="5.0" placeholderTextColor={C.muted} style={input} />

        <Text style={F.label}>{t('add.duration')}</Text>
        <TextInput value={dur} onChangeText={setDur} keyboardType="numbers-and-punctuation" placeholder={t('add.durationEg')}
          placeholderTextColor={C.muted} style={input} />

        <Text style={F.label}>{t('add.name')}</Text>
        <TextInput value={name} onChangeText={setName} placeholder={t('add.nameEg')} placeholderTextColor={C.muted} style={input} />

        <Text style={F.label}>{t('add.notes')}</Text>
        <TextInput value={notes} onChangeText={setNotes} multiline placeholder={t('add.notesEg')} placeholderTextColor={C.muted}
          style={[input, { minHeight: 80, textAlignVertical: 'top' }]} />
      </NeuCard>

      <NeuButton accent icon="check" label={t('add.save')} onPress={save} disabled={saving} />
    </ScrollView>
  );
}
