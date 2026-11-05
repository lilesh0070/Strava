import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import * as IntentLauncher from 'expo-intent-launcher';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { IconWell, NeuButton, NeuCard, NeuIconButton, NeuProgress, NeuSegmented, NeuSwitch, NeuTile } from '../components/Neu';
import { parsePace } from '../lib/live';
import { setBreakReminders, setDailyReminder } from '../lib/reminders';
import { fmtDuration } from '../lib/geo';
import GithubSyncCard from '../components/GithubSyncCard';
import { exportBackup, importBackup, storageBytes } from '../lib/backup';
import { getSettings, updateSettings } from '../lib/storage';
import { useTheme } from '../lib/theme';
import { refreshSettings } from '../lib/tracker';
import type { Settings } from '../lib/types';
import { applyOta, checkForUpdates, currentBuildId, currentVersion, installApk, useUpdateState } from '../lib/updates';
import { useT } from '../lib/i18n';
import { shareApp } from '../lib/shareApp';

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
      Alert.alert(t('set.notifOff'), t('set.notifOffBody'));
      return;
    }
    set({ reminderHour: h });
  };
  /** Save and reschedule the workday break nudges in one go. */
  const setBreaks = async (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    if (next.breakReminders && !(await setBreakReminders(next).catch(() => false))) {
      Alert.alert(t('set.notifOff'), t('set.notifOffBody'));
      return;
    }
    if (!next.breakReminders) await setBreakReminders(next).catch(() => undefined);
    await set(patch);
  };
  const hourStepper = (label: string, value: number, min: number, max: number, onChange: (h: number) => void) => (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <Text style={{ color: C.muted, fontSize: 12 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <NeuIconButton icon="minus" size={34} accessibilityLabel={t('set.hourEarlier').replace('{l}', label)} onPress={() => value > min && onChange(value - 1)} />
        <Text style={{ color: C.text, fontWeight: '800', fontSize: 16, width: 52, textAlign: 'center' }}>{String(value).padStart(2, '0')}:00</Text>
        <NeuIconButton icon="plus" size={34} accessibilityLabel={t('set.hourLater').replace('{l}', label)} onPress={() => value < max && onChange(value + 1)} />
      </View>
    </View>
  );

  const toggle = (icon: Parameters<typeof NeuTile>[0]['icon'], title: string, subtitle: string, key: keyof Settings) => (
    <NeuTile icon={icon} title={title} subtitle={subtitle}
      right={<NeuSwitch accessibilityLabel={title} value={!!s[key]} onValueChange={(v) => set({ [key]: v } as Partial<Settings>)} />} />
  );

  // ---------- update card ----------
  const downloading = u.apkProgress != null;
  let status = t('upd.tapCheck');
  if (u.checking) status = t('upd.checking');
  else if (u.ota === 'downloading') status = t('upd.downloading');
  else if (u.ota === 'ready') status = t('upd.ready');
  else if (u.apk) status = `${t('upd.available').replace('{v}', String(u.apk.version))}${u.apk.size ? ` (${(u.apk.size / 1048576).toFixed(1)} MB)` : ''}.`;
  else if (u.lastChecked) status = t('upd.upToDate').replace('{time}', new Date(u.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 28, paddingBottom: 60 }}>
      <Section title={t('set.updates')}>
        <NeuCard style={{ gap: 16 }} radius={28}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconWell icon={u.apk || u.ota === 'ready' ? 'rocket-launch-outline' : 'shield-check-outline'} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={F.h2}>TBDI FitTrack {currentVersion()}</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>{t('upd.build')} {currentBuildId()}</Text>
            </View>
          </View>
          <Text style={{ color: u.error ? C.danger : C.text }}>{u.error ?? status}</Text>

          {downloading && (
            <View style={{ gap: 6 }}>
              <NeuProgress value={u.apkProgress ?? 0} />
              <Text style={{ color: C.muted, fontSize: 12 }}>{t('upd.progress').replace('{p}', String(Math.round((u.apkProgress ?? 0) * 100)))}</Text>
            </View>
          )}

          {u.apk?.notes ? (
            <NeuCard inset radius={18} padding={12}>
              <Text style={[F.label, { marginBottom: 4 }]}>{t('upd.whatsNew')}</Text>
              <Text style={{ color: C.text, fontSize: 13 }} numberOfLines={8}>{u.apk.notes}</Text>
            </NeuCard>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            {u.ota === 'ready' ? (
              <NeuButton accent icon="restart" label={t('upd.restart')} style={{ flex: 1 }} onPress={() => applyOta()} />
            ) : u.apk && u.reinstall ? (
              <View style={{ flex: 1, gap: 10 }}>
                <NeuCard inset radius={18} padding={12} style={{ gap: 4 }}>
                  <Text style={{ color: C.text, fontWeight: '800' }}>{t('upd.reinstallTitle')}</Text>
                  <Text style={{ color: C.muted, fontSize: 13 }}>{t('upd.reinstallBody')}</Text>
                </NeuCard>
                <NeuButton icon="cloud-upload-outline" label={t('upd.backupNow')}
                  onPress={() => exportBackup().catch((e) => Alert.alert(t('set.backup'), String(e?.message ?? e)))} />
                <NeuButton accent icon="download" label={t('upd.downloadApk')} onPress={() => Linking.openURL(u.apk!.url)} />
              </View>
            ) : u.apk ? (
              <NeuButton accent icon="download" label={downloading ? t('upd.dl') : t('upd.install')} style={{ flex: 1 }}
                disabled={downloading} onPress={() => installApk()} />
            ) : (
              <NeuButton icon="refresh" label={u.checking ? '…' : t('set.check')} style={{ flex: 1 }}
                disabled={u.checking} onPress={() => checkForUpdates()} />
            )}
          </View>
          {u.apk && !u.reinstall ? (
            <Text style={{ color: C.muted, fontSize: 11 }}>{t('upd.androidNote')}</Text>
          ) : null}
          {u.apk && u.error && !downloading ? (
            <NeuButton small icon="open-in-new" label={t('upd.openPage')} onPress={() => Linking.openURL(u.apk!.htmlUrl)} />
          ) : null}
        </NeuCard>
        {toggle('update', t('set.checkAuto'), t('set.checkAutoSub'), 'autoCheckUpdates')}
        <NeuTile icon="flask-outline" title={t('set.beta')} subtitle={t('set.betaSub')}
          right={<NeuSwitch accessibilityLabel={t('set.beta')} value={s.betaUpdates}
            onValueChange={async (v) => { await set({ betaUpdates: v }); checkForUpdates(); }} />} />
      </Section>

      <Section title={t('set.appearance')}>
        <NeuSegmented value={s.theme} onChange={(theme) => set({ theme })}
          options={[
            { key: 'system', label: t('set.themeAuto'), icon: 'theme-light-dark' },
            { key: 'light', label: t('set.themeLight'), icon: 'white-balance-sunny' },
            { key: 'dark', label: t('set.themeDark'), icon: 'weather-night' },
          ]} />
      </Section>

      <Section title={t('set.language')}>
        <NeuSegmented value={s.language} onChange={(language) => { set({ language }); if (s.breakReminders) setBreakReminders({ ...s, language }); }}
          options={[{ key: 'en', label: 'English' }, { key: 'hi', label: 'हिन्दी' }]} />
      </Section>

      <Section title={t('set.recording')}>
        {toggle('account-voice', t('set.voice'), t('set.voiceSub'), 'voiceCues')}
        {toggle('pause-circle-outline', t('set.autoPause'), t('set.autoPauseSub'), 'autoPause')}
        {Platform.OS === 'android' && toggle('cellphone-text', t('set.liveNotif'), t('set.liveNotifSub'), 'liveNotification')}
        {toggle('timer-3', t('set.countdown'), t('set.countdownSub'), 'countdown')}
        <NeuCard radius={26} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconWell icon="crosshairs-gps" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>{t('set.gps')}</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>
                {s.gpsMode === 'saver'
                  // iOS still delivers a fix every second; the saver mode only lowers the precision target there
                  ? t(Platform.OS === 'ios' ? 'set.gpsSaverIos' : 'set.gpsSaverAndroid')
                  : t('set.gpsPrecise')}
              </Text>
            </View>
          </View>
          <NeuSegmented value={s.gpsMode} onChange={(gpsMode) => set({ gpsMode })}
            options={[{ key: 'precise', label: t('set.precise') }, { key: 'saver', label: t('set.saver') }]} />
        </NeuCard>
        <NeuCard radius={26} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconWell icon="speedometer" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>{t('set.paceCoach')}</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>{t('set.paceCoachSub')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput value={paceText} onChangeText={setPaceText} placeholder={t('set.paceEg')} placeholderTextColor={C.muted}
              keyboardType="numbers-and-punctuation" accessibilityLabel={t('set.paceA11y')}
              onEndEditing={() => {
                const v = paceText.trim() ? parsePace(paceText) : null;
                if (paceText.trim() && v == null) { Alert.alert(t('set.paceFormat'), t('set.paceFormatBody')); return; }
                set({ targetPaceSec: v });
              }}
              style={{ flex: 1, color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 999,
                paddingHorizontal: 18, paddingVertical: 10, fontWeight: '700' }} />
            <Text style={{ color: C.muted }}>/km</Text>
            {s.targetPaceSec ? <NeuButton small label={t('set.off')} onPress={() => { setPaceText(''); set({ targetPaceSec: null }); }} /> : null}
          </View>
        </NeuCard>
        <NeuCard radius={26} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconWell icon="flag-outline" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>{t('set.autoLap')}</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>{t('set.autoLapSub')}</Text>
            </View>
          </View>
          <NeuSegmented value={String(s.autoLapKm ?? 0)} onChange={(v) => set({ autoLapKm: Number(v) || null })}
            options={[{ key: '0', label: t('set.off') }, { key: '1', label: '1 km' }, { key: '2', label: '2 km' }, { key: '5', label: '5 km' }]} />
        </NeuCard>
        <NeuCard radius={26} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconWell icon="bullseye-arrow" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>{t('set.targets')}</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>{t('set.targetsSub')}</Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={F.label}>{t('set.targetDist')}</Text>
            <NeuSegmented value={String(s.targetDistanceM ?? 0)} onChange={(v) => set({ targetDistanceM: Number(v) || null })}
              options={[{ key: '0', label: t('set.off') }, { key: '3000', label: '3 km' }, { key: '5000', label: '5 km' }, { key: '10000', label: '10 km' }, { key: '21097', label: '21.1' }]} />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={F.label}>{t('set.targetTime')}</Text>
            <NeuSegmented value={String(s.targetTimeSec ?? 0)} onChange={(v) => set({ targetTimeSec: Number(v) || null })}
              options={[{ key: '0', label: t('set.off') }, { key: '1200', label: `20 ${t('set.minutes')}` }, { key: '1800', label: `30 ${t('set.minutes')}` }, { key: '3600', label: `60 ${t('set.minutes')}` }]} />
          </View>
        </NeuCard>
        {Platform.OS === 'android' && (
          <NeuTile icon="battery-heart-variant" title={t('set.bgTitle')} subtitle={t('set.bgSub')}
            onPress={() => IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
              .catch(() => Linking.openSettings())} />
        )}
      </Section>

      <Section title={t('set.wellness')}>
        <NeuCard radius={26} style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconWell icon="human-handsup" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>{t('set.breakRem')}</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>{t('set.breakRemSub')}</Text>
            </View>
            <NeuSwitch accessibilityLabel={t('set.breakRem')} value={s.breakReminders} onValueChange={(v) => setBreaks({ breakReminders: v })} />
          </View>
          {s.breakReminders && (
            <>
              <Text style={F.label}>{t('set.every')}</Text>
              <NeuSegmented value={String(s.breakEveryMin)} onChange={(v) => setBreaks({ breakEveryMin: Number(v) })}
                options={['45', '60', '90', '120'].map((m) => ({ key: m, label: `${m}m` }))} />
              <Text style={F.label}>{t('set.workHours')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {hourStepper(t('set.start'), s.workStartH, 5, s.workEndH - 2, (h) => setBreaks({ workStartH: h }))}
                {hourStepper(t('set.end'), s.workEndH, s.workStartH + 2, 23, (h) => setBreaks({ workEndH: h }))}
              </View>
              <Text style={F.label}>{t('set.workDays')}</Text>
              <NeuSegmented value={s.workDays} onChange={(workDays) => setBreaks({ workDays })}
                options={[{ key: 'mon-fri', label: t('set.monFri') }, { key: 'mon-sat', label: t('set.monSat') }]} />
            </>
          )}
        </NeuCard>
      </Section>

      <Section title={t('set.motivation')}>
        <NeuCard radius={26} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconWell icon="bell-ring-outline" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>{t('set.daily')}</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>{t('set.dailySub').replace('{h}', String(s.reminderHour))}</Text>
            </View>
            <NeuSwitch accessibilityLabel={t('set.daily')} value={s.reminder} onValueChange={async (v) => {
              const ok = await setDailyReminder(v, s.reminderHour).catch(() => false);
              if (!ok) { Alert.alert(t('set.notifOff'), t('set.notifOffBody')); return; }
              set({ reminder: v });
            }} />
          </View>
          {s.reminder && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <NeuIconButton icon="minus" size={38} accessibilityLabel={t('set.earlier')} onPress={() => moveReminder((s.reminderHour + 23) % 24)} />
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18, width: 70, textAlign: 'center' }}>{String(s.reminderHour).padStart(2, '0')}:00</Text>
              <NeuIconButton icon="plus" size={38} accessibilityLabel={t('set.later')} onPress={() => moveReminder((s.reminderHour + 1) % 24)} />
            </View>
          )}
        </NeuCard>
      </Section>

      <Section title={t('fr.title')}>
        <NeuTile icon="account-group-outline" title={t('fr.leaderboard')} subtitle={t('fr.settingsSub')} onPress={() => router.push('/friends')} />
      </Section>

      <Section title={t('set.data')}>
        <GithubSyncCard />
        <NeuTile icon="cloud-upload-outline" title={t('set.backup')} subtitle={t('set.backupSub')}
          onPress={() => exportBackup()
            .then(({ unreadable }) => {
              if (unreadable) Alert.alert(t('set.leftOut'), unreadable === 1 ? t('set.leftOutBody1') : t('set.leftOutBody').replace('{n}', String(unreadable)));
            })
            .catch((e) => Alert.alert(t('set.backupFailed'), String(e?.message ?? e)))} />
        <NeuTile icon="cloud-download-outline" title={t('set.restore')} subtitle={t('set.restoreSub')}
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
              Alert.alert(t('set.restored'), t('set.restoredBody').replace('{n}', String(n)));
              storageBytes().then(setBytes).catch(() => undefined);
            } catch (e) { Alert.alert(t('set.restoreFailed'), String((e as Error)?.message ?? e)); }
          }} />
        {bytes != null && (
          <Text style={{ color: C.muted, fontSize: 12, marginLeft: 6 }}>{t('set.usage').replace('{kb}', (bytes / 1024).toFixed(0))}</Text>
        )}
      </Section>

      <Section title={t('set.about')}>
        <NeuTile icon="share-variant" title={t('app.share')} subtitle={t('app.shareSub')}
          onPress={() => shareApp(t).catch(() => undefined)} />
        <Text style={{ color: C.muted, fontSize: 11, marginLeft: 6 }}>{t('set.mapCredit')}</Text>
      </Section>
    </ScrollView>
  );
}
