import { useEffect, useState } from 'react';
import { Animated, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { dismissToast, useToast } from '../lib/toast';
import { NeuButton } from './Neu';

/** Bottom snackbar (e.g. "Activity deleted · Undo"). Slides up with a native-driven animation. */
export default function ToastHost() {
  const { C, S } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [y] = useState(() => new Animated.Value(120));
  useEffect(() => {
    Animated.spring(y, { toValue: toast ? 0 : 120, useNativeDriver: true, friction: 9, tension: 80 }).start();
  }, [toast, y]);
  if (!toast) return null;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 96, transform: [{ translateY: y }],
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingLeft: 20, borderRadius: 26,
        backgroundColor: C.bg, boxShadow: S.raised }}>
      <Text style={{ flex: 1, color: C.text, fontWeight: '600' }}>{toast.text}</Text>
      {toast.action ? (
        <NeuButton small accent label={toast.action.label} onPress={() => { toast.action!.run(); dismissToast(); }} />
      ) : null}
    </Animated.View>
  );
}
