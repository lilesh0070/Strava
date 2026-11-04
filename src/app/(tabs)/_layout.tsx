import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';
import { NeuIconButton } from '../../components/Neu';
import NeuTabBar from '../../components/NeuTabBar';
import SettingsButton from '../../components/SettingsButton';
import { useTheme } from '../../lib/theme';

export default function TabsLayout() {
  const { C } = useTheme();
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
        title: 'Feed',
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <NeuIconButton icon="plus" size={40} accessibilityLabel="Add activity manually" onPress={() => router.push('/add-activity')} />
            <SettingsButton />
          </View>
        ),
      }} />
      <Tabs.Screen name="record" options={{ title: 'Record', headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: 'You' }} />
    </Tabs>
  );
}
