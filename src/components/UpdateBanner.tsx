// Checks for updates at launch and whenever the app comes back to the screen (at most every few hours,
// if enabled), and shows a soft banner when a new version is out.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../lib/i18n';
import { getSettings } from '../lib/storage';
import { useTheme } from '../lib/theme';
import { applyOta, checkForUpdates, checkIfStale, installApk, useUpdateState } from '../lib/updates';
import { IconWell, NeuButton } from './Neu';

export default function UpdateBanner() {
  const { C, S } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const u = useUpdateState();
  // the version the user dismissed: the banner stays hidden until a newer one is out
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const dismissed = dismissedFor != null && dismissedFor === (u.apk?.version ?? '');

  useEffect(() => {
    const t = setTimeout(() => {
      getSettings().then((s) => { if (s.autoCheckUpdates) checkForUpdates({ silent: true }).catch(() => undefined); });
    }, 4000); // don't compete with first render
    // Android keeps apps alive for days: also look again when the user comes back to the app
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') getSettings().then((s) => { if (s.autoCheckUpdates) checkIfStale(); }).catch(() => undefined);
    });
    return () => { clearTimeout(t); sub.remove(); };
  }, []);

  const otaReady = u.ota === 'ready';
  if (dismissed || (!otaReady && !u.apk)) return null;

  return (
    <View style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 64, padding: 14, borderRadius: 24,
      backgroundColor: C.bg, boxShadow: S.raised, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconWell icon="rocket-launch-outline" size={42} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: '800' }}>{otaReady ? t('upd.downloaded') : t('upd.versionOut').replace('{v}', String(u.apk?.version))}</Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>{otaReady ? t('upd.restartHint') : t('upd.tapHint')}</Text>
      </View>
      <NeuButton small label={t('upd.later')} onPress={() => setDismissedFor(u.apk?.version ?? '')} />
      <NeuButton small accent label={otaReady ? t('upd.restartBtn') : t('upd.update')}
        onPress={() => {
          if (otaReady) { applyOta(); return; }
          setDismissedFor(u.apk?.version ?? '');
          router.push('/settings'); // shows the download progress
          installApk();
        }} />
    </View>
  );
}
