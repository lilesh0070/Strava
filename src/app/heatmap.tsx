// Every GPS route you have recorded drawn on one map.
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { NeuButton } from '../components/Neu';
import RouteMap from '../components/RouteMap';
import type { Point } from '../lib/geo';
import { useTheme } from '../lib/theme';
import { SPORTS, type Sport } from '../lib/types';
import { useActivities } from '../lib/useActivities';

/** Keep every nth point so hundreds of activities stay light enough for the map. */
function thin(seg: Point[], maxPoints = 300): Point[] {
  if (seg.length <= maxPoints) return seg;
  const step = Math.ceil(seg.length / maxPoints);
  return seg.filter((_, i) => i % step === 0 || i === seg.length - 1);
}

export default function Heatmap() {
  const { C, S } = useTheme();
  const { items } = useActivities();
  const [sport, setSport] = useState<Sport | 'all'>('all');
  const segs = useMemo(
    () => (items ?? []).filter((a) => sport === 'all' || a.sport === sport).flatMap((a) => a.segments.filter((g) => g.length > 1).map((g) => thin(g))),
    [items, sport],
  );
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <NeuButton small label="All" selected={sport === 'all'} onPress={() => setSport('all')} />
        {SPORTS.map((s) => <NeuButton key={s.key} small label={s.label} selected={sport === s.key} onPress={() => setSport(s.key)} />)}
      </View>
      <View style={{ flex: 1, borderRadius: 30, padding: 6, backgroundColor: C.bg, boxShadow: S.inset }}>
        {segs.length ? <RouteMap segments={segs} fitKey={sport} style={{ flex: 1, borderRadius: 24 }} />
          : <Text style={{ color: C.muted, textAlign: 'center', marginTop: 40 }}>No GPS routes yet.</Text>}
      </View>
    </View>
  );
}
