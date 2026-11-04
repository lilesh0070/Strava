import { Tabs } from 'expo-router/js-tabs';
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
      <Tabs.Screen name="index" options={{ title: 'Feed' }} />
      <Tabs.Screen name="record" options={{ title: 'Record', headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: 'You' }} />
    </Tabs>
  );
}
