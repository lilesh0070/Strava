// "You did it" moments (new personal record, new badge) shown as an animated card over whatever screen is
// open, instead of a grey OS dialog. Same tiny store pattern as toast.ts.
import { useSyncExternalStore } from 'react';

export type CelebrationItem = { kind: 'pr' | 'badge'; title: string; value?: string; icon?: string };
export type Celebration = { id: number; items: CelebrationItem[] };
let current: Celebration | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function celebrate(items: CelebrationItem[], ms = 6000) {
  if (!items.length) return;
  if (timer) clearTimeout(timer);
  current = { id: Date.now(), items };
  emit();
  timer = setTimeout(() => { current = null; emit(); }, ms);
}
export function dismissCelebration() { if (timer) clearTimeout(timer); current = null; emit(); }
export const useCelebration = () =>
  useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => current);
