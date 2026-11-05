import AsyncStorage from '@react-native-async-storage/async-storage';
import { bestEffort, simplify } from './geo';
import { DEFAULT_SETTINGS, type Activity, type Gear, type GearKind, type Settings } from './types';

const INDEX = 'stride:activities';
const item = (id: string) => `stride:activity:${id}`;
const PROFILE = 'stride:profile';
// Lists (feed, profile, badges) only need a light copy of each activity: a simplified route for
// the thumbnail and pre-computed best efforts. Reading thousands of raw GPS points for every
// card made the feed slow; full points are now loaded only on the detail screen.
const SUMMARIES = 'stride:summaries';
export const EFFORT_DISTANCES = [1000, 5000, 10000, 21097.5];

export type Profile = { name: string; weeklyGoalKm: number; weightKg: number; monthlyGoalKm: number };

type Listener = () => void;
const listeners = new Set<Listener>();
/** Fires whenever activities, gear, settings or profile change. */
export const onDataChanged = (fn: Listener) => onActivitiesChanged(fn);
export function onActivitiesChanged(fn: Listener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
const emit = () => listeners.forEach((l) => l());
export const notifyDataChanged = emit;

// Every write that reads first (index, summaries, gear) goes through one queue, so overlapping saves
// (e.g. a Restore still running while a recording is saved) can never drop each other's changes.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function readIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(INDEX);
  return raw ? JSON.parse(raw) : [];
}

export function toSummary(a: Activity): Activity {
  const efforts: Record<string, number> = {};
  if (a.sport === 'run' && !a.manual) {
    for (const m of EFFORT_DISTANCES) {
      const t = bestEffort(a.segments, m);
      if (t != null) efforts[m] = t;
    }
  }
  return { ...a, lite: true, efforts, segments: a.segments.map((g) => simplify(g, 8)) };
}

let summaryCache: Record<string, Activity> | null = null;
async function readSummaries(): Promise<Record<string, Activity>> {
  if (summaryCache) return summaryCache;
  const raw = await AsyncStorage.getItem(SUMMARIES);
  summaryCache = raw ? JSON.parse(raw) : {};
  return summaryCache!;
}
async function writeSummaries(map: Record<string, Activity>) {
  summaryCache = map;
  await AsyncStorage.setItem(SUMMARIES, JSON.stringify(map));
}

/** Light copies for lists, newest first. Builds missing summaries once (migration from older versions). */
export async function listActivities(): Promise<Activity[]> {
  const ids = await readIndex();
  if (!ids.length) return [];
  const map = await readSummaries();
  const missing = ids.filter((id) => !map[id]);
  if (missing.length) {
    const rows = await AsyncStorage.multiGet(missing.map(item));
    for (const [, v] of rows) if (v) { const a = JSON.parse(v) as Activity; map[a.id] = toSummary(a); }
    await writeSummaries({ ...map });
  }
  return ids.map((id) => map[id]).filter((a): a is Activity => !!a).sort((a, b) => b.startedAt - a.startedAt);
}

/** Full activities with every GPS point (backups only: this is slow with a big history). */
export async function listFullActivities(): Promise<Activity[]> {
  const ids = await readIndex();
  if (!ids.length) return [];
  const rows = await AsyncStorage.multiGet(ids.map(item));
  return rows.map(([, v]) => (v ? (JSON.parse(v) as Activity) : null)).filter((a): a is Activity => !!a);
}

export async function getActivity(id: string): Promise<Activity | null> {
  const raw = await AsyncStorage.getItem(item(id));
  return raw ? JSON.parse(raw) : null;
}

export function saveActivity(a: Activity, opts: { silent?: boolean } = {}): Promise<void> {
  if (a.lite) return Promise.reject(new Error('Refusing to save a list summary over the full activity'));
  return serial(async () => {
    const ids = await readIndex();
    if (!ids.includes(a.id)) ids.push(a.id);
    const map = await readSummaries();
    await AsyncStorage.multiSet([[item(a.id), JSON.stringify(a)], [INDEX, JSON.stringify(ids)]]);
    await writeSummaries({ ...map, [a.id]: toSummary(a) });
    if (!opts.silent) emit();
  });
}

/**
 * Add many activities at once (backup restore). Activities whose id already exists here are left
 * alone, so a restore never overwrites newer local edits. The index and summaries are written once,
 * not once per activity. Returns how many were added.
 */
export function importActivities(list: Activity[]): Promise<number> {
  return serial(async () => {
    const ids = await readIndex();
    const have = new Set(ids);
    const fresh: Activity[] = [];
    for (const a of list) {
      if (have.has(a.id)) continue;
      have.add(a.id);
      fresh.push({ ...a, lite: undefined, efforts: undefined });
    }
    if (!fresh.length) return 0;
    const map = { ...(await readSummaries()) };
    // a few activities per write keeps each native call (and its memory spike) small
    for (let i = 0; i < fresh.length; i += 20) {
      await AsyncStorage.multiSet(fresh.slice(i, i + 20).map((a) => [item(a.id), JSON.stringify(a)] as [string, string]));
    }
    for (const a of fresh) { ids.push(a.id); map[a.id] = toSummary(a); }
    await AsyncStorage.setItem(INDEX, JSON.stringify(ids));
    await writeSummaries(map);
    emit();
    return fresh.length;
  });
}

export function deleteActivity(id: string): Promise<Activity | null> {
  return serial(async () => {
    const full = await getActivity(id);
    const ids = (await readIndex()).filter((x) => x !== id);
    const map = { ...(await readSummaries()) };
    delete map[id];
    await AsyncStorage.setItem(INDEX, JSON.stringify(ids));
    await AsyncStorage.removeItem(item(id));
    await writeSummaries(map);
    emit();
    return full; // lets the caller offer "Undo"
  });
}

// ---------- settings ----------
const SETTINGS = 'stride:settings';
export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
}
export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS, JSON.stringify(s));
  emit();
}
/** Merge a change into the latest stored settings (queued, so quick successive changes all stick). */
export function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return serial(async () => {
    const next = { ...(await getSettings()), ...patch };
    await saveSettings(next);
    return next;
  });
}

// ---------- gear ----------
const GEAR = 'stride:gear';
export async function listGear(): Promise<Gear[]> {
  const raw = await AsyncStorage.getItem(GEAR);
  return raw ? JSON.parse(raw) : [];
}
export function saveGearList(list: Gear[]): Promise<void> {
  return serial(async () => {
    await AsyncStorage.setItem(GEAR, JSON.stringify(list));
    emit();
  });
}
/** Change the stored gear list in place (reads the latest copy first, so a stale screen can't overwrite it). */
export function updateGear(fn: (list: Gear[]) => Gear[]): Promise<Gear[]> {
  return serial(async () => {
    const next = fn(await listGear());
    await AsyncStorage.setItem(GEAR, JSON.stringify(next));
    emit();
    return next;
  });
}
export async function defaultGear(kind: GearKind): Promise<Gear | undefined> {
  return (await listGear()).find((g) => g.kind === kind && g.isDefault && !g.retired);
}

export async function getProfile(): Promise<Profile> {
  const raw = await AsyncStorage.getItem(PROFILE);
  return { name: 'Athlete', weeklyGoalKm: 20, weightKg: 70, monthlyGoalKm: 80, ...(raw ? JSON.parse(raw) : {}) };
}

export async function saveProfile(p: Profile): Promise<void> {
  await AsyncStorage.setItem(PROFILE, JSON.stringify(p));
  emit();
}
/** Merge a change into the latest stored profile (never a stale in-memory copy). */
export function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  return serial(async () => {
    const next = { ...(await getProfile()), ...patch };
    await saveProfile(next);
    return next;
  });
}
/** True once a profile has been saved on this phone (a restore then leaves it alone). */
export async function hasSavedProfile(): Promise<boolean> {
  return (await AsyncStorage.getItem(PROFILE)) != null;
}
