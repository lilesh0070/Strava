// First-launch walkthrough: three short pages, then name + language. Shown once.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconWell, NeuButton, NeuSegmented } from '../components/Neu';
import { useT } from '../lib/i18n';
import { getProfile, getSettings, saveProfile, saveSettings } from '../lib/storage';
import { useTheme } from '../lib/theme';

const ONBOARDED_KEY = 'stride:onboarded';

const PAGES = [
  { icon: 'map-marker-path', t: 'ob.1t', b: 'ob.1b' },
  { icon: 'heart-pulse', t: 'ob.2t', b: 'ob.2b' },
  { icon: 'shield-lock-outline', t: 'ob.3t', b: 'ob.3b' },
  { icon: 'hand-wave-outline', t: 'ob.4t', b: 'ob.4b' },
] as const;

export default function Onboarding() {
  const { C, S, F } = useTheme();
  const { t, lang } = useT();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList>(null);
  const [page, setPage] = useState(0);
  const [name, setName] = useState('');

  const finish = async () => {
    if (name.trim()) await saveProfile({ ...(await getProfile()), name: name.trim() });
    await AsyncStorage.setItem(ONBOARDED_KEY, '1');
    router.replace('/');
  };
  const next = () => (page < PAGES.length - 1 ? list.current?.scrollToIndex({ index: page + 1 }) : finish());

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 }}>
        <View style={{ width: 170 }}>
          <NeuSegmented value={lang} onChange={async (language) => saveSettings({ ...(await getSettings()), language })}
            options={[{ key: 'en', label: 'EN' }, { key: 'hi', label: 'हिं' }]} />
        </View>
        {page < PAGES.length - 1 ? <NeuButton small label={t('ob.skip')} onPress={finish} /> : null}
      </View>

      <FlatList
        ref={list}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.t}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index }) => (
          <View style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 26 }}>
            <View style={{ width: 200, height: 200, borderRadius: 100, alignItems: 'center', justifyContent: 'center',
              backgroundColor: C.bg, boxShadow: S.raised }}>
              <IconWell icon={item.icon} size={110} />
            </View>
            <Text style={[F.h1, { textAlign: 'center' }]}>{t(item.t)}</Text>
            <Text style={{ color: C.muted, fontSize: 16, textAlign: 'center', lineHeight: 23 }}>{t(item.b)}</Text>
            {index === PAGES.length - 1 && (
              <TextInput value={name} onChangeText={setName} placeholder={t('ob.name')} placeholderTextColor={C.muted}
                onSubmitEditing={finish} returnKeyType="done" accessibilityLabel={t('ob.name')}
                style={{ alignSelf: 'stretch', color: C.text, fontSize: 18, fontWeight: '700', textAlign: 'center',
                  backgroundColor: C.bg, boxShadow: S.inset, borderRadius: 999, paddingVertical: 14 }} />
            )}
          </View>
        )}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 22 }}>
        {PAGES.map((_, i) => (
          <View key={i} style={{ width: i === page ? 26 : 10, height: 10, borderRadius: 5,
            backgroundColor: i === page ? C.accent : C.bg, boxShadow: i === page ? undefined : S.insetSm }} />
        ))}
      </View>
      <View style={{ paddingHorizontal: 24 }}>
        <NeuButton accent label={page === PAGES.length - 1 ? t('ob.go') : t('ob.next')} icon={page === PAGES.length - 1 ? 'check' : 'arrow-right'} onPress={next} />
      </View>
    </View>
  );
}
