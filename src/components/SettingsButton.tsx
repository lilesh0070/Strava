import { router } from 'expo-router';
import { View } from 'react-native';
import { useUpdateState } from '../lib/updates';
import { useTheme } from '../lib/theme';
import { NeuIconButton } from './Neu';

/** Cog shown at the top-right of every tab; carries a dot when an update is waiting. */
export default function SettingsButton({ style }: { style?: object }) {
  const { C } = useTheme();
  const u = useUpdateState();
  const pending = u.ota === 'available' || u.ota === 'ready' || !!u.apk;
  return (
    <View style={[{ marginRight: 16 }, style]}>
      <NeuIconButton icon="cog-outline" size={40} accessibilityLabel={pending ? 'Settings, update available' : 'Settings'}
        onPress={() => router.push('/settings')} />
      {pending ? (
        <View style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6,
          backgroundColor: C.danger, borderWidth: 2, borderColor: C.bg }} />
      ) : null}
    </View>
  );
}
