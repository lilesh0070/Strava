// Text for the live-stats notification (pure, so it can be unit-tested without native modules).
import { fmtDuration, fmtKm, fmtPace, fmtSpeed } from './geo';
import { translate, type Key, type Lang } from './strings';
import { sportInfo, type Session } from './types';

const sportKey = (sport: string): Key => (sport === 'ride' ? 'sport.ride' : sport === 'walk' ? 'sport.walk' : sport === 'hike' ? 'sport.hike' : 'sport.run');

/** Title: "Recording · Run" or "Paused · Run". */
export function liveTitle(s: Session, lang: Lang): string {
  return `${translate(lang, s.status === 'paused' ? 'live.paused' : 'live.recording')} · ${translate(lang, sportKey(s.sport))}`;
}

/** One line: distance · moving time · average pace or speed · current pace/speed (when moving). */
export function liveSummary(s: Session, movingSec: number, speedMs: number | null, lang: Lang = 'en'): string {
  const info = sportInfo(s.sport);
  const dist = s.distanceM ?? 0;
  const avg = info.usesPace ? `${fmtPace(dist, movingSec)} /km` : `${fmtSpeed(dist, movingSec)} km/h`;
  let now = '';
  if (speedMs != null && speedMs > 0.4 && s.status === 'recording') {
    const cur = info.usesPace ? `${fmtPace(1000, 1000 / speedMs)} /km` : `${(speedMs * 3.6).toFixed(1)} km/h`;
    now = ` · ${translate(lang, 'live.now')} ${cur}`;
  }
  return `${fmtKm(dist)} km · ${fmtDuration(movingSec)} · ${avg}${now}`;
}
