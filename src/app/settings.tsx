import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Text, View } from 'react-native';
import { IconWell, NeuButton, NeuCard, NeuProgress, NeuSegmented, NeuSwitch, NeuTile } from '../components/Neu';
import { exportBackup, importBackup, storageBytes } from '../lib/backup';
import { getSettings, saveSettings } from '../lib/storage';
import { useTheme } from '../lib/theme';
import { refreshSettings } from '../lib/tracker';
import type { Settings } from '../lib/types';
import { applyOta, checkForUpdates, currentBuildId, currentVersion, installApk, useUpdateState } from '../lib/updates';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { F } = useTheme();
  return (
    <View style={{ gap: 14 }}>
      <Text style={[F.label, { marginLeft: 6 }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const { C, F } = useTheme();
  const [s, setS] = useState<Settings | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);
  const u = useUpdateState();

  useEffect(() => { getSettings().then(setS); storageBytes().then(setBytes); }, []);
  if (!s) return <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />;

  const set = async (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    setS(next);
    await saveSettings(next);
    refreshSettings();
  };

  const toggle = (icon: Parameters<typeof NeuTile>[0]['icon'], title: string, subtitle: string, key: keyof Settings) => (
    <NeuTile icon={icon} title={title} subtitle={subtitle}
      right={<NeuSwitch accessibilityLabel={title} value={!!s[key]} onValueChange={(v) => set({ [key]: v } as Partial<Settings>)} />} />
  );

  // ---------- update card ----------
  const downloading = u.apkProgress != null;
  let status = 'Tap to check for a newer version.';
  if (u.checking) status = 'Checking…';
  else if (u.ota === 'downloading') status = 'Downloading update…';
  else if (u.ota === 'ready') status = 'Update downloaded. Restart to apply.';
  else if (u.apk) status = `Version ${u.apk.version} is available${u.apk.size ? ` (${(u.apk.size / 1048576).toFixed(1)} MB)` : ''}.`;
  else if (u.lastChecked) status = `You're up to date · checked ${new Date(u.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 28, paddingBottom: 60 }}>
      <Section title="App updates">
        <NeuCard style={{ gap: 16 }} radius={28}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconWell icon={u.apk || u.ota === 'ready' ? 'rocket-launch-outline' : 'shield-check-outline'} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={F.h2}>Stride {currentVersion()}</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>Build {currentBuildId()}</Text>
            </View>
          </View>
          <Text style={{ color: u.error ? C.danger : C.text }}>{u.error ?? status}</Text>

          {downloading && (
            <View style={{ gap: 6 }}>
              <NeuProgress value={u.apkProgress ?? 0} />
              <Text style={{ color: C.muted, fontSize: 12 }}>Downloading… {Math.round((u.apkProgress ?? 0) * 100)}%</Text>
            </View>
          )}

          {u.apk?.notes ? (
            <NeuCard inset radius={18} padding={12}>
              <Text style={[F.label, { marginBottom: 4 }]}>What's new</Text>
              <Text style={{ color: C.text, fontSize: 13 }} numberOfLines={8}>{u.apk.notes}</Text>
            </NeuCard>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            {u.ota === 'ready' ? (
              <NeuButton accent icon="restart" label="Restart & update" style={{ flex: 1 }} onPress={() => applyOta()} />
            ) : u.apk ? (
              <NeuButton accent icon="download" label={downloading ? 'Downloading…' : 'Download & install'} style={{ flex: 1 }}
                disabled={downloading} onPress={() => installApk()} />
            ) : (
              <NeuButton icon="refresh" label={u.checking ? 'Checking…' : 'Check for updates'} style={{ flex: 1 }}
                disabled={u.checking} onPress={() => checkForUpdates()} />
            )}
          </View>
          {u.apk ? (
            <Text style={{ color: C.muted, fontSize: 11 }}>
              Android will ask you to allow installs from Stride the first time. Your activities are kept.
            </Text>
          ) : null}
        </NeuCard>
        {toggle('update', 'Check automatically', 'Look for updates when the app opens', 'autoCheckUpdates')}
      </Section>

      <Section title="Appearance">
        <NeuSegmented value={s.theme} onChange={(theme) => set({ theme })}
          options={[
            { key: 'system', label: 'Auto', icon: 'theme-light-dark' },
            { key: 'light', label: 'Light', icon: 'white-balance-sunny' },
            { key: 'dark', label: 'Dark', icon: 'weather-night' },
          ]} />
      </Section>

      <Section title="Recording">
        {toggle('account-voice', 'Voice updates', 'Time and pace every kilometre', 'voiceCues')}
        {toggle('pause-circle-outline', 'Auto-pause', 'Pause when you stop, resume when you go', 'autoPause')}
        {toggle('timer-3', 'Start countdown', '3-second countdown before recording', 'countdown')}
        <NeuCard radius={26} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconWell icon="crosshairs-gps" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>GPS accuracy</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>Battery saver records every 3 s</Text>
            </View>
          </View>
          <NeuSegmented value={s.gpsMode} onChange={(gpsMode) => set({ gpsMode })}
            options={[{ key: 'precise', label: 'Precise' }, { key: 'saver', label: 'Battery saver' }]} />
        </NeuCard>
      </Section>

      <Section title="Your data">
        <NeuTile icon="cloud-upload-outline" title="Back up" subtitle="Save all activities, gear and settings to a file"
          onPress={() => exportBackup().catch((e) => Alert.alert('Backup failed', String(e?.message ?? e)))} />
        <NeuTile icon="cloud-download-outline" title="Restore" subtitle="Import a Stride backup file (merges, nothing is deleted)"
          onPress={async () => {
            try {
              const n = await importBackup();
              if (n != null) { Alert.alert('Restored', `${n} activities imported.`); storageBytes().then(setBytes); }
            } catch (e) { Alert.alert('Restore failed', String((e as Error)?.message ?? e)); }
          }} />
        {bytes != null && (
          <Text style={{ color: C.muted, fontSize: 12, marginLeft: 6 }}>Using {(bytes / 1024).toFixed(0)} KB on this device</Text>
        )}
      </Section>

      <Section title="About">
        <NeuTile icon="github" title="Source code" subtitle="github.com/lilesh0070/strava"
          onPress={() => Linking.openURL('https://github.com/lilesh0070/strava')} />
        <Text style={{ color: C.muted, fontSize: 11, marginLeft: 6 }}>Map data © OpenStreetMap contributors</Text>
      </Section>
    </ScrollView>
  );
}
