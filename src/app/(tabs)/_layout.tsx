import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { C } from '../../lib/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: unknown; size: number }) => (
  <MaterialCommunityIcons name={name} color={color as string} size={size} />
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.text,
        headerTitleStyle: { fontWeight: '800' },
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed', tabBarIcon: icon('home-variant') }} />
      <Tabs.Screen name="record" options={{ title: 'Record', tabBarIcon: icon('record-circle'), headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: icon('account-circle') }} />
    </Tabs>
  );
}
