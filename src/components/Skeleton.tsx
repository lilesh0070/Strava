import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { useTheme } from '../lib/theme';

/** Soft pulsing placeholder cards shown while data loads, instead of a spinner. */
export default function FeedSkeleton({ count = 2 }: { count?: number }) {
  const { C, S } = useTheme();
  const [o] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [o]);
  const bar = (w: number | `${number}%`, h = 14) => <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: C.bg, boxShadow: S.insetSm }} />;
  return (
    <Animated.View style={{ opacity: o, padding: 20, gap: 22 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ borderRadius: 28, padding: 18, gap: 14, backgroundColor: C.bg, boxShadow: S.raised }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 17, backgroundColor: C.bg, boxShadow: S.insetSm }} />
            <View style={{ flex: 1, gap: 8 }}>{bar('60%')}{bar('40%', 10)}</View>
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>{bar('25%', 22)}{bar('25%', 22)}{bar('25%', 22)}</View>
          <View style={{ height: 120, borderRadius: 20, backgroundColor: C.bg, boxShadow: S.inset }} />
        </View>
      ))}
    </Animated.View>
  );
}
