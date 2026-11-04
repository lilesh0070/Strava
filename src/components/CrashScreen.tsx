import { Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { IconWell, NeuButton } from './Neu';

export default function CrashScreen({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const { C, F } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <IconWell icon="alert-circle-outline" size={84} color={C.danger} />
      <Text style={F.h2}>Something went wrong</Text>
      <Text style={{ color: C.muted, textAlign: 'center' }}>
        Your activities are safe. If you were recording, the recording is still saved and will resume.
      </Text>
      <Text style={{ color: C.faint, fontSize: 11, textAlign: 'center' }} numberOfLines={3}>{error.message}</Text>
      <NeuButton accent icon="refresh" label="Try again" onPress={() => { retry(); }} />
    </View>
  );
}
