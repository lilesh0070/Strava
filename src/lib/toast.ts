import { useSyncExternalStore } from 'react';

export type Toast = { id: number; text: string; action?: { label: string; run: () => void }; ms: number };
let current: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(text: string, action?: Toast['action'], ms = 5000) {
  if (timer) clearTimeout(timer);
  current = { id: Date.now(), text, action, ms };
  emit();
  timer = setTimeout(() => { current = null; emit(); }, ms);
}
export function dismissToast() { if (timer) clearTimeout(timer); current = null; emit(); }
export const useToast = () =>
  useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => current);
