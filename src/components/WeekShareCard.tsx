// "My wellness week" card, captured as a PNG and shared to a team group to spark friendly challenges.
import { forwardRef } from 'react';
import { Text, View } from 'react-native';
import { keyToDate, type WeekSummary } from '../lib/health';
import { useT } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { IconWell } from './Neu';
import type { ShareCardHandle } from './ShareCard';

const W = 360;

const WeekShareCard = forwardRef<ShareCardHandle, { week: WeekSummary; name: string; team: string }>(function WeekShareCard({ week, name, team }, ref) {
  const { C, S } = useTheme();
  const { t } = useT();
  const labels = t('h.days').split(',');
  const fmt = (k: string) => keyToDate(k).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const stat = (label: string, value: string) => (
    <View style={{ width: '50%', alignItems: 'center', paddingVertical: 10 }}>
      <Text style={{ color: C.muted, fontSize: 10, letterSpacing: 1, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: '900' }}>{value}</Text>
    </View>
  );
  return (
    <View ref={ref} collapsable={false} style={{ width: W, padding: 22, backgroundColor: C.bg, gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconWell icon="heart-pulse" size={46} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: '800' }} numberOfLines={1}>{t('sc.week')}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={1}>
            {name}{team ? ` · ${team}` : ''} · {fmt(week.start)} – {fmt(week.days[week.days.length - 1])}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 96, paddingHorizontal: 6,
        borderRadius: 22, padding: 12, backgroundColor: C.bg, boxShadow: S.inset }}>
        {labels.map((l, i) => {
          const v = week.scores[i];
          return (
            <View key={i} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
              <View style={{ width: 18, height: Math.max(4, ((v ?? 0) / 100) * 54), borderRadius: 9,
                backgroundColor: v == null ? 'transparent' : v >= 50 ? C.accent : C.faint }} />
              <Text style={{ color: C.muted, fontSize: 10 }}>{l}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderRadius: 22, paddingVertical: 6, backgroundColor: C.bg, boxShadow: S.raised }}>
        {stat(t('sc.active'), `${week.activeMin}/150`)}
        {stat(t('sc.score'), String(week.avgScore))}
        {stat(t('sc.water'), `${week.waterDays}/${week.days.length}`)}
        {stat(t('sc.breaks'), String(week.breaks))}
        {week.km > 0 ? stat('KM', week.km.toFixed(1)) : null}
        {week.avgSleep != null ? stat(t('sc.sleep'), `${week.avgSleep.toFixed(1)} h`) : null}
      </View>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={{ color: C.accent, fontWeight: '900', letterSpacing: 2 }}>TBDI FITTRACK</Text>
        <Text style={{ color: C.muted, fontSize: 11 }}>{t('sc.join')} · Move • Monitor • Stay Healthy</Text>
      </View>
    </View>
  );
});

export default WeekShareCard;
