import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { getSettings } from '../lib/storage';
import { translate, type Key, type Lang } from '../lib/strings';
import { useTheme } from '../lib/theme';
import { IconWell, NeuButton } from './Neu';

export default function CrashScreen({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const { C, F } = useTheme();
  // The root ErrorBoundary renders this outside the I18nProvider, so read the language setting directly
  // (English until it loads, or if storage itself is what broke).
  const [lang, setLang] = useState<Lang>('en');
  useEffect(() => { getSettings().then((s) => setLang(s.language)).catch(() => undefined); }, []);
  const t = (k: Key) => translate(lang, k);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <IconWell icon="alert-circle-outline" size={84} color={C.danger} />
      <Text style={F.h2}>{t('crash.title')}</Text>
      <Text style={{ color: C.muted, textAlign: 'center' }}>{t('crash.body')}</Text>
      <Text style={{ color: C.faint, fontSize: 11, textAlign: 'center' }} numberOfLines={3}>{error.message}</Text>
      <NeuButton accent icon="refresh" label={t('crash.retry')} onPress={() => { retry(); }} />
    </View>
  );
}
