// Animated "new record / new badge" card with a little confetti. Mounted once in the root layout so it
// floats over the screen that was just pushed (the activity detail after Save).
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dismissCelebration, useCelebration, type Celebration } from '../lib/celebrate';
import { useT } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { IconWell, NeuButton } from './Neu';

const CONFETTI = 18;

function Confetti({ colors }: { colors: string[] }) {
  const { width, height } = useWindowDimensions();
  const [t] = useState(() => new Animated.Value(0));
  const pieces = useMemo(() => Array.from({ length: CONFETTI }, (_, i) => ({
    x: ((i * 7919) % 97) / 97 * width, delay: (i * 37) % 400, size: 6 + (i % 4) * 2, spin: i % 2 ? 1 : -1, color: colors[i % colors.length],
  })), [width, colors]);
  useEffect(() => { Animated.timing(t, { toValue: 1, duration: 1600, useNativeDriver: true }).start(); }, [t]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: p.x, top: -20, width: p.size, height: p.size * 1.6, borderRadius: 2, backgroundColor: p.color,
          opacity: t.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, height * (0.6 + (i % 5) * 0.1)] }) },
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, ((i % 3) - 1) * 40] }) },
            { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin * (360 + (i % 4) * 90)}deg`] }) },
          ] }} />
      ))}
    </View>
  );
}

function Card({ c }: { c: Celebration }) {
  const { C, S } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [y] = useState(() => new Animated.Value(300));
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 7, tension: 60 }).start();
  }, [y, c.id]);
  return (
    <Animated.View accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 24,
      transform: [{ translateY: y }], borderRadius: 30, padding: 20, gap: 14, backgroundColor: C.bg, boxShadow: S.raised }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <IconWell icon="trophy" size={54} />
        <Text style={{ flex: 1, color: C.text, fontSize: 20, fontWeight: '900' }}>{t('cel.title')}</Text>
      </View>
      {c.items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 }}>
          <MaterialCommunityIcons name={(it.icon ?? (it.kind === 'pr' ? 'timer-outline' : 'medal-outline')) as never} size={22} color={C.accentInk} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>{it.kind === 'pr' ? t('cel.pr').toUpperCase() : t('cel.badge').toUpperCase()}</Text>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>{it.title}{it.value ? ` · ${it.value}` : ''}</Text>
          </View>
        </View>
      ))}
      <NeuButton accent label={t('cel.ok')} onPress={dismissCelebration} />
    </Animated.View>
  );
}

export default function CelebrationOverlay() {
  const { C } = useTheme();
  const c = useCelebration();
  const colors = useMemo(() => [C.accent, C.success, C.warnInk, C.infoInk], [C]);
  if (!c) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      <Pressable style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} onPress={dismissCelebration} accessibilityLabel="" />
      <Confetti key={c.id} colors={colors} />
      <Card c={c} />
    </View>
  );
}
