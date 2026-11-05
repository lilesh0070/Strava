// A self-contained neumorphic card that gets captured as a PNG for sharing to WhatsApp, Instagram, etc.
import { forwardRef, type ComponentRef } from 'react';
import { Text, View } from 'react-native';
import { fmtDuration, fmtKm, fmtPace, fmtSpeed } from '../lib/geo';
import { useTheme } from '../lib/theme';
import { sportInfo, type Activity } from '../lib/types';
import { IconWell } from './Neu';
import RouteThumb from './RouteThumb';

const W = 360;

export type ShareCardHandle = ComponentRef<typeof View>;

const ShareCard = forwardRef<ShareCardHandle, { a: Activity }>(function ShareCard({ a }, ref) {
  const { C, S } = useTheme();
  const info = sportInfo(a.sport);
  const stat = (label: string, value: string) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: C.muted, fontSize: 10, letterSpacing: 1, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: '900' }}>{value}</Text>
    </View>
  );
  return (
    <View ref={ref} collapsable={false} style={{ width: W, padding: 22, backgroundColor: C.bg, gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconWell icon={info.icon as never} size={46} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: '800' }} numberOfLines={1}>{a.name}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{new Date(a.startedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </View>
      </View>
      {a.segments.some((g) => g.length > 1) ? (
        <View style={{ borderRadius: 22, padding: 4, backgroundColor: C.bg, boxShadow: S.inset }}>
          <RouteThumb segments={a.segments} width={W - 52} height={200} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', borderRadius: 22, paddingVertical: 14, backgroundColor: C.bg, boxShadow: S.raised }}>
        {stat('KM', fmtKm(a.distanceM))}
        {stat(info.usesPace ? 'PACE' : 'KM/H', info.usesPace ? fmtPace(a.distanceM, a.movingSec) : fmtSpeed(a.distanceM, a.movingSec))}
        {stat('TIME', fmtDuration(a.movingSec))}
      </View>
      <Text style={{ color: C.accent, fontWeight: '900', textAlign: 'center', letterSpacing: 2 }}>TBDI FITTRACK</Text>
    </View>
  );
});

export default ShareCard;
