import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { weekStreak } from '../lib/coach';
import { C, F } from '../lib/theme';
import type { Activity } from '../lib/types';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarCard({ activities }: { activities: Activity[] }) {
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
    <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={F.h2}>{streak} week streak</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>Weeks in a row with at least one activity</Text>
        </View>
        <MaterialCommunityIcons name="fire" size={30} color={streak ? C.accent : C.muted} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setOffset(offset + 1)} hitSlop={10}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={C.text} />
        </Pressable>
        <Text style={{ color: C.text, fontWeight: '700' }}>
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · {kmByDay.size} active days
        </Text>
        <Pressable onPress={() => setOffset(Math.max(0, offset - 1))} hitSlop={10} disabled={offset === 0}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={offset === 0 ? C.border : C.text} />
        </Pressable>
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
              {km ? <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: C.accent, opacity: 0.9 }} /> : null}
              {day ? <Text style={{ color: km ? C.accentText : C.muted, fontSize: 12, fontWeight: km ? '800' : '400' }}>{day}</Text> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
