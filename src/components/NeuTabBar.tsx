// Floating pill tab bar: the active tab sits in a raised tile with accent colour.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const META: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Feed', icon: 'home-variant-outline' },
  record: { label: 'Record', icon: 'record-circle-outline' },
  profile: { label: 'You', icon: 'account-circle-outline' },
};

export default function NeuTabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const { C, S } = useTheme();
  return (
    <View style={{ backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10) + 4 }}>
      <View style={{ flexDirection: 'row', borderRadius: 30, padding: 8, backgroundColor: C.bg, boxShadow: S.raised }}>
        {state.routes.map((route, i) => {
          const m = META[route.name] ?? { label: route.name, icon: 'circle-outline' as IconName };
          const focused = state.index === i;
          const color = focused ? C.accent : C.muted;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={m.label}
              onPress={() => { if (!focused) { Haptics.selectionAsync().catch(() => undefined); navigateToTab(route.key); } }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 4, gap: 4 }}
            >
              <View style={{ width: 52, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                backgroundColor: C.bg, boxShadow: focused ? S.well : undefined }}>
                <MaterialCommunityIcons name={m.icon} size={24} color={color} />
              </View>
              <Text style={{ color, fontSize: 12, fontWeight: focused ? '800' : '600' }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
