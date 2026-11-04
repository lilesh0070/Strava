// Checks for updates once at launch (if enabled) and shows a soft toast when one is ready.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSettings } from '../lib/storage';
import { useTheme } from '../lib/theme';
import { applyOta, checkForUpdates, useUpdateState } from '../lib/updates';
import { IconWell, NeuButton } from './Neu';

export default function UpdateBanner() {
  const { C, S } = useTheme();
  const insets = useSafeAreaInsets();
  const u = useUpdateState();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      getSettings().then((s) => { if (s.autoCheckUpdates) checkForUpdates().catch(() => undefined); });
    }, 4000); // don't compete with first render
    return () => clearTimeout(t);
  }, []);

  const otaReady = u.ota === 'ready';
  if (dismissed || (!otaReady && !u.apk)) return null;

  return (
    <View style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 64, padding: 14, borderRadius: 24,
      backgroundColor: C.bg, boxShadow: S.raised, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconWell icon="rocket-launch-outline" size={42} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: '800' }}>{otaReady ? 'Update downloaded' : `Version ${u.apk?.version} is out`}</Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>{otaReady ? 'Restart to use the new version.' : 'Tap Update to download and install.'}</Text>
      </View>
      <NeuButton small label="Later" onPress={() => setDismissed(true)} />
      <NeuButton small accent label={otaReady ? 'Restart' : 'Update'}
        onPress={() => (otaReady ? applyOta() : (setDismissed(true), router.push('/settings')))} />
    </View>
  );
}
