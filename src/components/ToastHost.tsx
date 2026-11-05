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
  // keep the last toast mounted while it slides out, so dismissing is a motion, not a cut
  const [shown, setShown] = useState(toast);
  const [y] = useState(() => new Animated.Value(120));
  if (toast && toast !== shown) setShown(toast); // show the new toast in this render (the slide-in runs below)
  useEffect(() => {
    if (toast) {
      Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 9, tension: 80 }).start();
    } else {
      Animated.timing(y, { toValue: 140, duration: 220, useNativeDriver: true }).start(({ finished }) => { if (finished) setShown(null); });
    }
  }, [toast, y]);
  if (!shown) return null;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 96, transform: [{ translateY: y }],
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingLeft: 20, borderRadius: 26,
        backgroundColor: C.bg, boxShadow: S.raised }}>
      <Text style={{ flex: 1, color: C.text, fontWeight: '600' }}>{shown.text}</Text>
      {shown.action ? (
        <NeuButton small accent label={shown.action.label} onPress={() => { shown.action!.run(); dismissToast(); }} />
      ) : null}
    </Animated.View>
  );
}
