// "My week" card, captured as a PNG for the Monday group message: 7 day bars, totals, best pace, streak.
import { forwardRef } from 'react';
import { Text, View } from 'react-native';
import { fmtDuration, fmtKm } from '../lib/geo';
import { useT } from '../lib/i18n';
import { fmtSteps } from '../lib/steps';
import { useTheme } from '../lib/theme';
import type { WeekRecap } from '../lib/weekRecap';
import { IconWell } from './Neu';
import type { ShareCardHandle } from './ShareCard';

const W = 360;
export const recapDateText = (r: WeekRecap) => {
  const f = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${f(r.start)} – ${f(r.end - 1)}`;
};

const WeekRecapCard = forwardRef<ShareCardHandle, { recap: WeekRecap; name: string; rank?: number | null }>(function WeekRecapCard({ recap: r, name, rank }, ref) {
  const { C, S } = useTheme();
  const { t } = useT();
  const labels = t('h.days').split(',');
  const max = Math.max(1, ...r.dayKm);
  const stat = (label: string, value: string) => (
    <View style={{ width: '50%', alignItems: 'center', paddingVertical: 10 }}>
      <Text style={{ color: C.muted, fontSize: 10, letterSpacing: 1, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: '900' }}>{value}</Text>
    </View>
  );
  return (
    <View ref={ref} collapsable={false} style={{ width: W, padding: 22, backgroundColor: C.bg, gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconWell icon="run-fast" size={46} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: '800' }} numberOfLines={1}>{t('wk.title')}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={1}>{name} · {recapDateText(r)}</Text>
        </View>
        {r.changePct != null && (
          <Text style={{ color: r.changePct >= 0 ? C.successInk : C.dangerInk, fontWeight: '800', fontSize: 13 }}>
            {r.changePct >= 0 ? '▲' : '▼'} {Math.abs(r.changePct)}%
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 110, paddingHorizontal: 6,
        borderRadius: 22, padding: 12, backgroundColor: C.bg, boxShadow: S.inset }}>
        {labels.map((l, i) => {
          const v = r.dayKm[i] ?? 0;
          return (
            <View key={i} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
              {v > 0 && <Text style={{ color: C.muted, fontSize: 9, fontWeight: '700' }}>{v.toFixed(1)}</Text>}
              <View style={{ width: 18, height: Math.max(4, (v / max) * 54), borderRadius: 9, backgroundColor: v > 0 ? C.accent : C.faint }} />
              <Text style={{ color: C.muted, fontSize: 10 }}>{l}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderRadius: 22, paddingVertical: 6, backgroundColor: C.bg, boxShadow: S.raised }}>
        {stat(t('wk.distance'), `${fmtKm(r.km * 1000)} km`)}
        {stat(t('wk.time'), fmtDuration(r.sec))}
        {r.bestPaceSec != null ? stat(t('wk.best'), `${fmtDuration(r.bestPaceSec)} /km`) : stat(t('wk.activities').toUpperCase(), String(r.count))}
        {r.steps > 0 ? stat(t('wk.steps'), fmtSteps(r.steps)) : stat(t('wk.streak'), `${r.streak} ${t('wk.weeks')}`)}
        {r.steps > 0 && r.streak > 1 ? stat(t('wk.streak'), `${r.streak} ${t('wk.weeks')}`) : null}
        {rank != null ? stat(t('wk.rank').toUpperCase(), `#${rank}`) : null}
      </View>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={{ color: C.accentInk, fontWeight: '900', letterSpacing: 2 }}>TBDI FITTRACK</Text>
        <Text style={{ color: C.muted, fontSize: 11 }}>{t('sc.join')} · Move • Monitor • Stay Healthy</Text>
      </View>
    </View>
  );
});

export default WeekRecapCard;
