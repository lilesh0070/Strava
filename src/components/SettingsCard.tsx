import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { getSettings, saveSettings } from '../lib/storage';
import { C, F } from '../lib/theme';
import { refreshSettings } from '../lib/tracker';
import type { Settings } from '../lib/types';

export default function SettingsCard() {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => { getSettings().then(setS); }, []);
  if (!s) return null;

  const set = async (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    setS(next);
    await saveSettings(next);
    refreshSettings();
  };

  const row = (label: string, hint: string, value: boolean, onValue: (v: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onValue} trackColor={{ true: C.accent, false: C.border }} thumbColor={C.text} />
    </View>
  );

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 16 }}>
      <Text style={F.h2}>Recording</Text>
      {row('Voice updates', 'Announce time and pace every kilometre', s.voiceCues, (v) => set({ voiceCues: v }))}
      {row('Auto-pause', 'Pause when you stop moving, resume when you go', s.autoPause, (v) => set({ autoPause: v }))}
    </View>
  );
}
