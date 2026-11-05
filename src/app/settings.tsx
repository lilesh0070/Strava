import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import * as IntentLauncher from 'expo-intent-launcher';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { IconWell, NeuButton, NeuCard, NeuIconButton, NeuProgress, NeuSegmented, NeuSwitch, NeuTile } from '../components/Neu';
import { parsePace } from '../lib/live';
import { setDailyReminder } from '../lib/reminders';
import { fmtDuration } from '../lib/geo';
import GithubSyncCard from '../components/GithubSyncCard';
import { exportBackup, importBackup, storageBytes } from '../lib/backup';
import { getSettings, updateSettings } from '../lib/storage';
import { useTheme } from '../lib/theme';
import { refreshSettings } from '../lib/tracker';
import type { Settings } from '../lib/types';
import { applyOta, checkForUpdates, currentBuildId, currentVersion, installApk, useUpdateState } from '../lib/updates';
import { useT } from '../lib/i18n';

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
  const { C, S, F } = useTheme();
  const { t } = useT();
  const [paceText, setPaceText] = useState('');
  const [s, setS] = useState<Settings | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);
  const u = useUpdateState();

  const loadSettings = () => getSettings().then((x) => { setS(x); setPaceText(x.targetPaceSec ? fmtDuration(x.targetPaceSec) : ''); return x; });
  useEffect(() => {
    loadSettings();
    storageBytes().then(setBytes).catch(() => undefined);
  }, []);
  if (!s) return <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />;

  const set = async (patch: Partial<Settings>) => {
    // merge into the stored settings, not this screen's copy, so nothing saved meanwhile is reverted
    setS((cur) => (cur ? { ...cur, ...patch } : cur));
    setS(await updateSettings(patch));
    refreshSettings();
  };

  /** Move the reminder to another hour; only saved once the notification is really scheduled. */
  const moveReminder = async (h: number) => {
    const ok = await setDailyReminder(true, h).catch(() => false);
    if (!ok) {
      set({ reminder: false }); // the old one was cancelled, so don't show it as on
      Alert.alert('Notifications are off', 'Allow notifications for Stride in system settings.');
      return;
    }
    set({ reminderHour: h });
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
      <Section title={t('set.updates')}>
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
              <Text style={[F.label, { marginBottom: 4 }]}>{"What's new"}</Text>
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
              <NeuButton icon="refresh" label={u.checking ? '…' : t('set.check')} style={{ flex: 1 }}
                disabled={u.checking} onPress={() => checkForUpdates()} />
            )}
          </View>
          {u.apk ? (
            <Text style={{ color: C.muted, fontSize: 11 }}>
              Android will ask you to allow installs from Stride the first time. Your activities are kept.
            </Text>
          ) : null}
        </NeuCard>
        {toggle('update', t('set.checkAuto'), t('set.checkAutoSub'), 'autoCheckUpdates')}
      </Section>

      <Section title={t('set.appearance')}>
        <NeuSegmented value={s.theme} onChange={(theme) => set({ theme })}
          options={[
            { key: 'system', label: 'Auto', icon: 'theme-light-dark' },
            { key: 'light', label: 'Light', icon: 'white-balance-sunny' },
            { key: 'dark', label: 'Dark', icon: 'weather-night' },
          ]} />
      </Section>

      <Section title={t('set.language')}>
        <NeuSegmented value={s.language} onChange={(language) => set({ language })}
          options={[{ key: 'en', label: 'English' }, { key: 'hi', label: 'हिन्दी' }]} />
      </Section>

      <Section title={t('set.recording')}>
        {toggle('account-voice', t('set.voice'), t('set.voiceSub'), 'voiceCues')}
        {toggle('pause-circle-outline', t('set.autoPause'), t('set.autoPauseSub'), 'autoPause')}
        {toggle('timer-3', t('set.countdown'), t('set.countdownSub'), 'countdown')}
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
        <NeuCard radius={26} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconWell icon="speedometer" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>Pace coach</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>Voice nudge when you drift ±15 s from your target</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput value={paceText} onChangeText={setPaceText} placeholder="e.g. 5:30" placeholderTextColor={C.muted}
              keyboardType="numbers-and-punctuation" accessibilityLabel="Target pace per kilometre"
              onEndEditing={() => {
                const v = paceText.trim() ? parsePace(paceText) : null;
                if (paceText.trim() && v == null) { Alert.alert('Use minutes:seconds', 'For example 5:30'); return; }
                set({ targetPaceSec: v });
              }}
              style={{ flex: 1, color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 999,
                paddingHorizontal: 18, paddingVertical: 10, fontWeight: '700' }} />
            <Text style={{ color: C.muted }}>/km</Text>
            {s.targetPaceSec ? <NeuButton small label="Off" onPress={() => { setPaceText(''); set({ targetPaceSec: null }); }} /> : null}
          </View>
        </NeuCard>
        {Platform.OS === 'android' && (
          <NeuTile icon="battery-heart-variant" title="Reliable background recording"
            subtitle="Set Stride to “Unrestricted” battery use so Android never stops a recording"
            onPress={() => IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
              .catch(() => Linking.openSettings())} />
        )}
      </Section>

      <Section title={t('set.motivation')}>
        <NeuCard radius={26} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconWell icon="bell-ring-outline" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>Daily reminder</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>A gentle nudge every day at {s.reminderHour}:00</Text>
            </View>
            <NeuSwitch accessibilityLabel="Daily reminder" value={s.reminder} onValueChange={async (v) => {
              const ok = await setDailyReminder(v, s.reminderHour).catch(() => false);
              if (!ok) { Alert.alert('Notifications are off', 'Allow notifications for Stride in system settings.'); return; }
              set({ reminder: v });
            }} />
          </View>
          {s.reminder && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <NeuIconButton icon="minus" size={38} accessibilityLabel="Earlier" onPress={() => moveReminder((s.reminderHour + 23) % 24)} />
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18, width: 70, textAlign: 'center' }}>{String(s.reminderHour).padStart(2, '0')}:00</Text>
              <NeuIconButton icon="plus" size={38} accessibilityLabel="Later" onPress={() => moveReminder((s.reminderHour + 1) % 24)} />
            </View>
          )}
        </NeuCard>
      </Section>

      <Section title={t('fr.title')}>
        <NeuTile icon="account-group-outline" title={t('fr.leaderboard')} subtitle={t('fr.settingsSub')} onPress={() => router.push('/friends')} />
      </Section>

      <Section title={t('set.data')}>
        <GithubSyncCard />
        <NeuTile icon="cloud-upload-outline" title="Back up" subtitle="Save all activities, gear and settings to a file"
          onPress={() => exportBackup()
            .then(({ unreadable }) => {
              if (unreadable) Alert.alert('Some activities left out', `${unreadable} activit${unreadable === 1 ? 'y' : 'ies'} could not be read on this phone and ${unreadable === 1 ? 'is' : 'are'} not in the file.`);
            })
            .catch((e) => Alert.alert('Backup failed', String(e?.message ?? e)))} />
        <NeuTile icon="cloud-download-outline" title="Restore" subtitle="Import a Stride backup file (merges, nothing is deleted)"
          onPress={async () => {
            try {
              const n = await importBackup();
              if (n == null) return;
              // the backup may have changed settings: show them, apply them, and schedule its reminder
              const next = await loadSettings();
              refreshSettings();
              // schedule (or cancel) to match the restored setting
              const ok = await setDailyReminder(next.reminder, next.reminderHour).catch(() => false);
              if (next.reminder && !ok) set({ reminder: false });
              Alert.alert('Restored', `${n} new activities imported.`);
              storageBytes().then(setBytes).catch(() => undefined);
            } catch (e) { Alert.alert('Restore failed', String((e as Error)?.message ?? e)); }
          }} />
        {bytes != null && (
          <Text style={{ color: C.muted, fontSize: 12, marginLeft: 6 }}>Using {(bytes / 1024).toFixed(0)} KB on this device</Text>
        )}
      </Section>

      <Section title={t('set.about')}>
        <NeuTile icon="github" title="Source code" subtitle="github.com/lilesh0070/strava"
          onPress={() => Linking.openURL('https://github.com/lilesh0070/strava')} />
        <Text style={{ color: C.muted, fontSize: 11, marginLeft: 6 }}>Map data © OpenStreetMap contributors</Text>
      </Section>
    </ScrollView>
  );
}
