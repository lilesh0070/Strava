import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PersonalRecord } from './records';
import { getSettings, onDataChanged } from './storage';
import { badgeDetailKey, badgeKey, translate, type Key, type Lang } from './strings';

export { badgeDetailKey, badgeKey, kmCueHi, speechLanguage, translate, voicePhrases, type Key, type Lang } from './strings';

const en = { t: (k: Key) => translate('en', k) };
const Ctx = createContext<{ lang: Lang; t: (k: Key) => string }>({ lang: 'en', t: en.t });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  useEffect(() => {
    const load = () => getSettings().then((s) => setLang(s.language));
    load();
    return onDataChanged(load);
  }, []);
  return <Ctx.Provider value={{ lang, t: (k) => translate(lang, k) }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);

/** Sport name in the app language (stored activities keep the English key). */
export const sportName = (t: (k: Key) => string, sport: string) =>
  t((sport === 'ride' ? 'sport.ride' : sport === 'walk' ? 'sport.walk' : sport === 'hike' ? 'sport.hike' : 'sport.run') as Key);

/** Translated name of a personal record: "Fastest 5 km", "Longest run" / "सबसे लंबी दौड़", "Biggest climb". */
export function prLabel(t: (k: Key) => string, r: PersonalRecord): string {
  const label = t(r.labelKey);
  // "Longest {sport}": lower-case the English sport name ("Longest run"); Devanagari has no case
  return r.kind === 'longest' ? label.replace('{sport}', sportName(t, r.sport).toLowerCase()) : label;
}

/** Translated badge title for an achievement rule id (`badge.<id>`, wellness `wbadge.<id>`); an unknown id shows as is. */
export function badgeTitle(t: (k: Key) => string, id: string): string {
  return t(badgeKey(id)) ?? id;
}

/** Translated one-line badge detail (`badge.<id>.d`). */
export function badgeDetail(t: (k: Key) => string, id: string): string {
  return t(badgeDetailKey(id)) ?? '';
}

