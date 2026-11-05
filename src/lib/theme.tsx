// Neumorphic ("soft UI") design system: every surface shares the background colour and is
// shaped purely by a light highlight (top-left) and a soft shadow (bottom-right).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, type TextStyle } from 'react-native';
import { getSettings, onDataChanged } from './storage';
import type { ThemeChoice } from './types';

export type Palette = {
  scheme: 'light' | 'dark';
  bg: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentText: string;
  route: string;
  danger: string;
  success: string;
  /** Darker inks for small coloured text: the fills above don't reach 4.5:1 on the light background. */
  accentInk: string;
  successInk: string;
  warnInk: string;
  hi: string; // highlight shadow
  lo: string; // dark shadow
};

const light: Palette = {
  scheme: 'light',
  bg: '#E9EDF3',
  text: '#2A3140',
  muted: '#6F7889',
  faint: '#C3CAD5',
  accent: '#F2762E',
  accentText: '#FFFFFF',
  route: '#F2762E',
  danger: '#E5484D',
  success: '#30A46C',
  accentInk: '#B5490F', // 4.6:1 on bg
  successInk: '#1F7A4C',
  warnInk: '#9A5B00',
  hi: '#FFFFFF',
  lo: '#C3CBD8',
};

const dark: Palette = {
  scheme: 'dark',
  bg: '#262A31',
  text: '#E8ECF2',
  muted: '#8E98A8',
  faint: '#4A515C',
  accent: '#FF8A47',
  accentText: '#FFFFFF',
  route: '#FF8A47',
  danger: '#FF6369',
  success: '#4CC38A',
  accentInk: '#FF8A47', // the fills already pass on the dark background
  successInk: '#4CC38A',
  warnInk: '#F5A524',
  hi: '#323741',
  lo: '#181B20',
};

export function shadows(c: Palette) {
  return {
    raised: `-8px -8px 18px ${c.hi}, 8px 8px 18px ${c.lo}`,
    raisedSm: `-4px -4px 10px ${c.hi}, 4px 4px 10px ${c.lo}`,
    inset: `inset 5px 5px 10px ${c.lo}, inset -5px -5px 10px ${c.hi}`,
    insetSm: `inset 3px 3px 6px ${c.lo}, inset -3px -3px 6px ${c.hi}`,
    // soft "well" that holds an icon: barely raised with a gentle inner rim
    well: `-3px -3px 8px ${c.hi}, 3px 3px 8px ${c.lo}, inset 1px 1px 2px ${c.hi}`,
    glow: `0px 10px 22px ${c.accent}73, -4px -4px 10px ${c.hi}`,
  };
}

function typography(c: Palette) {
  return {
    h1: { fontSize: 28, fontWeight: '800', color: c.text, letterSpacing: -0.5 } as TextStyle,
    h2: { fontSize: 18, fontWeight: '700', color: c.text } as TextStyle,
    body: { fontSize: 15, color: c.text } as TextStyle,
    label: { fontSize: 11, color: c.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '600' } as TextStyle,
  };
}

export type Theme = { C: Palette; S: ReturnType<typeof shadows>; F: ReturnType<typeof typography>; choice: ThemeChoice };

const make = (c: Palette, choice: ThemeChoice): Theme => ({ C: c, S: shadows(c), F: typography(c), choice });
const Ctx = createContext<Theme>(make(light, 'system'));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoice] = useState<ThemeChoice>('system');
  useEffect(() => {
    const load = () => getSettings().then((s) => setChoice(s.theme));
    load();
    return onDataChanged(load);
  }, []);
  const scheme = choice === 'system' ? (system === 'dark' ? 'dark' : 'light') : choice;
  const theme = useMemo(() => make(scheme === 'dark' ? dark : light, choice), [scheme, choice]);
  return <Ctx.Provider value={theme}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
