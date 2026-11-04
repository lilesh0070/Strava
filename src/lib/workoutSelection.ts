import { useSyncExternalStore } from 'react';

// Which interval workout (if any) the next recording should follow. In-memory: it is a
// per-session choice, not a setting.
let selected: string | null = null;
const listeners = new Set<() => void>();
export function selectWorkout(id: string | null) { selected = id; listeners.forEach((l) => l()); }
export const useSelectedWorkout = () =>
  useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => selected);
