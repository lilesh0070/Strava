import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSettings, onDataChanged } from './storage';
import { translate, type Key, type Lang } from './strings';

export { kmCueHi, speechLanguage, translate, voicePhrases, type Lang } from './strings';

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

