// Persistence for the daily wellness log (water, breaks, breathing, check-ins). Stays on the phone,
// travels with Backup / GitHub backup.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { addDays, dayKey, emptyDay, mergeLogs, type CheckIn, type DayLog, type WellnessLog } from './health';

const KEY = 'stride:wellness'; // "stride:" prefix: counted in storage usage like all other app data
const KEEP_DAYS = 730;

let cache: WellnessLog | null = null;
const listeners = new Set<() => void>();
export function onWellnessChanged(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export async function getWellness(): Promise<WellnessLog> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as WellnessLog) : {};
  } catch { cache = {}; }
  return cache;
}

let queue: Promise<unknown> = Promise.resolve();
function write(fn: (log: WellnessLog) => WellnessLog): Promise<void> {
  const run = queue.then(async () => {
    const next = fn({ ...(await getWellness()) });
    const oldest = addDays(dayKey(), -KEEP_DAYS);
    for (const k of Object.keys(next)) if (k < oldest) delete next[k];
    cache = next;
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    listeners.forEach((l) => l());
  });
  queue = run.catch(() => undefined);
  return run;
}

export function updateDay(fn: (d: DayLog) => DayLog, key = dayKey()) {
  return write((log) => ({ ...log, [key]: fn({ ...emptyDay(), ...log[key] }) }));
}

export const addWater = (ml: number) => updateDay((d) => ({ ...d, waterMl: Math.max(0, d.waterMl + ml) }));
export const logBreak = (kind: 'stretch' | 'eyes') =>
  updateDay((d) => (kind === 'eyes' ? { ...d, eyeBreaks: d.eyeBreaks + 1 } : { ...d, breaks: d.breaks + 1 }));
export const logMindful = (min: number) => updateDay((d) => ({ ...d, mindfulMin: d.mindfulMin + Math.max(0, min) }));
export const saveCheckin = (c: CheckIn) => updateDay((d) => ({ ...d, checkin: c }));

/** Restore: merge a backed-up log into this phone's log (nothing is lost on either side). */
export const mergeWellness = (incoming: WellnessLog) => write((log) => mergeLogs(log, incoming));

export function useWellness() {
  const [log, setLog] = useState<WellnessLog | null>(cache);
  const reload = useCallback(() => { getWellness().then((l) => setLog({ ...l })); }, []);
  useEffect(() => {
    reload();
    return onWellnessChanged(reload);
  }, [reload]);
  return log;
}
