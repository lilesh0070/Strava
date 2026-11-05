import AsyncStorage from '@react-native-async-storage/async-storage';
import { bestEffort, simplify } from './geo';
import { DEFAULT_SETTINGS, type Activity, type Gear, type GearKind, type Settings } from './types';

const INDEX = 'stride:activities';
const item = (id: string) => `stride:activity:${id}`;
const PROFILE = 'stride:profile';
// Lists (feed, profile, badges) only need a light copy of each activity: a simplified route for
// the thumbnail and pre-computed best efforts. Reading thousands of raw GPS points for every
// card made the feed slow; full points are now loaded only on the detail screen.
// Each summary has its own key: Android can't read back a single value over 2 MB (its SQLite
// CursorWindow limit), which one combined blob reached after a few hundred activities.
const summaryKey = (id: string) => `stride:summary:${id}`;
const LEGACY_SUMMARIES = 'stride:summaries'; // one blob for all summaries (v1.2), migrated on first read
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

const CHUNK = 20;
async function multiSetChunked(pairs: [string, string][]) {
  for (let i = 0; i < pairs.length; i += CHUNK) await AsyncStorage.multiSet(pairs.slice(i, i + CHUNK));
}
/**
 * Read many keys, a few at a time. If a chunk fails (e.g. one value is too big to read on Android),
 * its keys are read one by one and only the unreadable ones are skipped, so one bad row can't hide all.
 */
async function readMany<T>(keys: string[]): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  const take = (k: string, v: string | null) => { if (v) { try { out.set(k, JSON.parse(v) as T); } catch { /* corrupt row */ } } };
  for (let i = 0; i < keys.length; i += CHUNK) {
    const part = keys.slice(i, i + CHUNK);
    try {
      for (const [k, v] of await AsyncStorage.multiGet(part)) take(k, v);
    } catch {
      for (const k of part) { try { take(k, await AsyncStorage.getItem(k)); } catch { /* unreadable */ } }
    }
  }
  return out;
}

let summaryCache: Record<string, Activity> | null = null;
/** One-time move of the old combined summaries blob to per-activity keys (every caller waits for it). */
let migration: Promise<void> | null = null;
const migrateLegacySummaries = () => (migration ??= (async () => {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_SUMMARIES);
    if (raw) {
      const old = JSON.parse(raw) as Record<string, Activity>;
      await multiSetChunked(Object.values(old).map((a) => [summaryKey(a.id), JSON.stringify(a)]));
    }
  } catch { /* unreadable: the summaries are rebuilt from the activities instead */ }
  await AsyncStorage.removeItem(LEGACY_SUMMARIES).catch(() => undefined);
})());

/** Summaries for these ids that exist in storage (cached in memory after the first read). */
async function readSummaries(ids: string[]): Promise<Record<string, Activity>> {
  await migrateLegacySummaries();
  const map = (summaryCache ??= {});
  const missing = ids.filter((id) => !map[id]);
  if (missing.length) for (const s of (await readMany<Activity>(missing.map(summaryKey))).values()) map[s.id] = s;
  return map;
}

/** Light copies for lists, newest first. Builds missing summaries once (migration from older versions). */
export async function listActivities(): Promise<Activity[]> {
  const ids = await readIndex();
  if (!ids.length) return [];
  const map = await readSummaries(ids);
  if (ids.some((id) => !map[id])) {
    // build missing summaries from the full activities, queued with the writes so a save that happens
    // meanwhile can't be overwritten by a summary of the older copy
    await serial(async () => {
      const missing = ids.filter((id) => !map[id]);
      const built: [string, string][] = [];
      for (const a of (await readMany<Activity>(missing.map(item))).values()) {
        const s = toSummary(a);
        map[a.id] = s;
        built.push([summaryKey(a.id), JSON.stringify(s)]);
      }
      await multiSetChunked(built);
    });
  }
  return ids.map((id) => map[id]).filter((a): a is Activity => !!a).sort((a, b) => b.startedAt - a.startedAt);
}

/** Full activities with every GPS point (backups only: this is slow with a big history). */
export async function listFullActivities(): Promise<Activity[]> {
  const ids = await readIndex();
  if (!ids.length) return [];
  return [...(await readMany<Activity>(ids.map(item))).values()];
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
    const summary = toSummary(a);
    await migrateLegacySummaries(); // the old combined blob must not be copied over this later
    // one atomic write: the activity, its summary and the index always agree
    await AsyncStorage.multiSet([[item(a.id), JSON.stringify(a)], [summaryKey(a.id), JSON.stringify(summary)], [INDEX, JSON.stringify(ids)]]);
    (summaryCache ??= {})[a.id] = summary;
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
    await migrateLegacySummaries();
    const map = (summaryCache ??= {});
    // a few activities per write keeps each native call (and its memory spike) small
    for (let i = 0; i < fresh.length; i += 10) {
      const pairs: [string, string][] = [];
      for (const a of fresh.slice(i, i + 10)) {
        const s = toSummary(a);
        map[a.id] = s;
        pairs.push([item(a.id), JSON.stringify(a)], [summaryKey(a.id), JSON.stringify(s)]);
      }
      await AsyncStorage.multiSet(pairs);
    }
    for (const a of fresh) ids.push(a.id);
    await AsyncStorage.setItem(INDEX, JSON.stringify(ids)); // the index last: a cut-short import leaves no dangling ids
    emit();
    return fresh.length;
  });
}

export function deleteActivity(id: string): Promise<Activity | null> {
  return serial(async () => {
    const full = await getActivity(id).catch(() => null); // an unreadable activity can still be deleted
    const ids = (await readIndex()).filter((x) => x !== id);
    await AsyncStorage.setItem(INDEX, JSON.stringify(ids));
    await AsyncStorage.multiRemove([item(id), summaryKey(id)]);
    if (summaryCache) delete summaryCache[id];
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
