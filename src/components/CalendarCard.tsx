import { useState } from 'react';
import { Text, View } from 'react-native';
import { weekStreak } from '../lib/coach';
import { useTheme } from '../lib/theme';
import { IconWell, NeuCard, NeuIconButton } from './Neu';
import type { Activity } from '../lib/types';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarCard({ activities }: { activities: Activity[] }) {
  const { C, S, F } = useTheme();
  const [offset, setOffset] = useState(0); // months back from now
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (month.getDay() + 6) % 7;

  const kmByDay = new Map<number, number>();
  for (const a of activities) {
    const d = new Date(a.startedAt);
    if (d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()) {
      kmByDay.set(d.getDate(), (kmByDay.get(d.getDate()) ?? 0) + a.distanceM / 1000);
    }
  }
  const maxKm = Math.max(1, ...kmByDay.values());
  const streak = weekStreak(activities.map((a) => a.startedAt));
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <NeuCard radius={28} style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconWell icon="fire" color={streak ? C.accent : C.muted} />
        <View style={{ flex: 1 }}>
          <Text style={F.h2}>{streak} week streak</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>Weeks in a row with at least one activity</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <NeuIconButton icon="chevron-left" size={36} accessibilityLabel="Previous month" onPress={() => setOffset(offset + 1)} />
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · {kmByDay.size} active days
        </Text>
        <NeuIconButton icon="chevron-right" size={36} accessibilityLabel="Next month" color={offset === 0 ? C.faint : C.text}
          onPress={() => setOffset(Math.max(0, offset - 1))} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {DOW.map((d, i) => (
          <Text key={`h${i}`} style={{ width: `${100 / 7}%`, textAlign: 'center', color: C.muted, fontSize: 11, marginBottom: 4 }}>{d}</Text>
        ))}
        {cells.map((day, i) => {
          const km = day ? kmByDay.get(day) : undefined;
          const size = km ? 18 + (km / maxKm) * 14 : 0;
          return (
            <View key={i} style={{ width: `${100 / 7}%`, height: 38, alignItems: 'center', justifyContent: 'center' }}>
              {km ? <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: C.accent, boxShadow: S.raisedSm }} /> : null}
              {day ? <Text style={{ color: km ? C.accentText : C.muted, fontSize: 12, fontWeight: km ? '800' : '400' }}>{day}</Text> : null}
            </View>
          );
        })}
      </View>
    </NeuCard>
  );
}
