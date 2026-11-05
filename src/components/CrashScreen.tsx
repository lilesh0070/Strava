import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { exportBackup } from '../lib/backup';
import { crashLogText, describeError, logError } from '../lib/crashHandler';
import { userError } from '../lib/crashLog';
import { I18nProvider, useT } from '../lib/i18n';
import { ThemeProvider, useTheme } from '../lib/theme';
import * as tracker from '../lib/tracker';
import { applyOta, checkForUpdates, getUpdateState, installApk, RECORDING_ACTIVE, releasePageLink, useUpdateState } from '../lib/updates';
import { IconWell, NeuButton, NeuCard, NeuProgress } from './Neu';

type Props = { error: Error; retry: () => Promise<void> };
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * Shown when a screen fails to render. Offers a way back (home), the updater (a fixed version is the
 * real way out of a crash), a backup, and the error details to send to the owner. Every error shown
 * here is also written to the crash log (Settings → Error log).
 */
function CrashView({ error, retry }: Props) {
  const { C, F } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const u = useUpdateState();
  const recording = useSyncExternalStore(tracker.subscribe, () => !!tracker.getSession());
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState<'update' | 'backup' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const entry = useMemo(() => describeError(error, 'render'), [error]);
  useEffect(() => { logError(error, 'render'); }, [error]);

  const tryAgain = () => {
    // back to the History tab, so the screen that crashed isn't simply rendered again
    try { router.dismissTo('/'); } catch { /* no navigator mounted: the reset below still renders home */ }
    retry().catch(() => undefined);
  };

  const update = async () => {
    setBusy('update'); setNote(null);
    try {
      await checkForUpdates();
      const st = getUpdateState();
      if (st.ota === 'ready') { await applyOta(); return; }
      if (!st.apk) { setNote(st.error ? userError(t, st.error, 'raw') : t('crash.upToDate')); return; }
      if (tracker.getSession()) { setNote(t('crash.updRecording')); return; }
      // a key change can't be installed over this app: the release page has the APK and the steps
      if (st.reinstall) { await Linking.openURL(st.apk.htmlUrl || releasePageLink()); return; }
      await installApk();
      const after = getUpdateState().error;
      if (after) setNote(after === RECORDING_ACTIVE ? t('crash.updRecording') : userError(t, after, 'raw'));
    } catch (e) {
      setNote(userError(t, e));
    } finally { setBusy(null); }
  };

  const backup = async () => {
    setBusy('backup'); setNote(null);
    try { await exportBackup(); } catch (e) { logError(e, 'caught'); setNote(userError(t, e)); } finally { setBusy(null); }
  };

  const copy = async () => {
    try { await Clipboard.setStringAsync(crashLogText()); setNote(t('crash.copied')); } catch (e) { setNote(userError(t, e)); }
  };

  const downloading = u.apkProgress != null;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16,
        paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      <IconWell icon="alert-circle-outline" size={84} color={C.danger} />
      <Text style={[F.h2, { textAlign: 'center' }]}>{t('crash.title')}</Text>
      <Text style={{ color: C.muted, textAlign: 'center' }}>{t('crash.body')}</Text>

      <View style={{ alignSelf: 'stretch', gap: 12 }}>
        <NeuButton accent icon="home-outline" label={t('crash.retry')} onPress={tryAgain} />
        {Platform.OS === 'android' ? (
          <NeuButton icon="update" label={busy === 'update' && !downloading ? t('upd.checking') : t('crash.update')}
            busy={busy === 'update'} disabled={busy != null} onPress={update} />
        ) : null}
        <NeuButton icon="cloud-upload-outline" label={t('upd.backupNow')} busy={busy === 'backup'} disabled={busy != null} onPress={backup} />
      </View>

      {downloading ? (
        <View style={{ alignSelf: 'stretch', gap: 6 }}>
          <NeuProgress value={u.apkProgress ?? 0} />
          <Text style={{ color: C.muted, fontSize: 12 }}>{t('upd.progress').replace('{p}', String(Math.round((u.apkProgress ?? 0) * 100)))}</Text>
        </View>
      ) : null}
      {recording && Platform.OS === 'android' && !note ? (
        <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>{t('crash.updRecording')}</Text>
      ) : null}
      {note ? <Text style={{ color: C.text, textAlign: 'center' }}>{note}</Text> : null}
      {Platform.OS === 'android' ? (
        <NeuButton small icon="open-in-new" label={t('crash.releases')} onPress={() => { Linking.openURL(releasePageLink()).catch(() => undefined); }} />
      ) : (
        <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>{t('crash.updateIos')}</Text>
      )}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <NeuButton small icon={details ? 'chevron-up' : 'chevron-down'} label={details ? t('crash.hideDetails') : t('crash.details')}
          onPress={() => setDetails((v) => !v)} />
        <NeuButton small icon="content-copy" label={t('crash.copy')} onPress={copy} />
      </View>
      {details ? (
        <NeuCard inset radius={18} padding={12} style={{ alignSelf: 'stretch' }}>
          <Text selectable style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>{entry.msg}</Text>
          {entry.stack ? <Text selectable style={{ color: C.muted, fontSize: 10, fontFamily: MONO, marginTop: 6 }}>{entry.stack}</Text> : null}
        </NeuCard>
      ) : null}
    </ScrollView>
  );
}

/** A screen crashed: the navigator, tab bar and back button stay around it (root Stack's screen error boundary). */
export function ScreenCrash(props: Props) {
  return <CrashView {...props} />;
}

/**
 * The root layout itself crashed, so its theme and language providers are gone too: bring them back
 * here (they fall back to the system theme and English if storage is what broke).
 */
export default function CrashScreen(props: Props) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <CrashView {...props} />
      </I18nProvider>
    </ThemeProvider>
  );
}
