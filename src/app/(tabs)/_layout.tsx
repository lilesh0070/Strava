import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';
import { NeuIconButton } from '../../components/Neu';
import NeuTabBar from '../../components/NeuTabBar';
import SettingsButton from '../../components/SettingsButton';
import { useTheme } from '../../lib/theme';
import { useT } from '../../lib/i18n';

export default function TabsLayout() {
  const { C } = useTheme();
  const { t } = useT();
  // first launch → onboarding (checked once; the flag lives in AsyncStorage)
  useEffect(() => {
    AsyncStorage.getItem('stride:onboarded').then((v) => { if (!v) router.replace('/onboarding'); }).catch(() => undefined);
  }, []);
  return (
    <Tabs
      tabBar={(props) => <NeuTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerShadowVisible: false,
        headerTintColor: C.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 26 },
        headerTitleAlign: 'left',
        headerRight: () => <SettingsButton />,
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: t('tab.feed'),
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <NeuIconButton icon="plus" size={40} accessibilityLabel="Add activity manually" onPress={() => router.push('/add-activity')} />
            <SettingsButton />
          </View>
        ),
      }} />
      <Tabs.Screen name="health" options={{ title: t('tab.health') }} />
      <Tabs.Screen name="record" options={{ title: t('tab.record'), headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: t('tab.you') }} />
    </Tabs>
  );
}
