import AsyncStorage from '@react-native-async-storage/async-storage';
import { bestEffort, simplify } from './geo';
import { readBlob, removeBlob, writeBlob } from './blobStore';
import { DEFAULT_SETTINGS, type Activity, type Gear, type GearKind, type Settings } from './types';

const INDEX = 'stride:activities';
const item = (id: string) => `stride:activity:${id}`; // pre-1.3.2 location, kept only for migration
const blobKey = (id: string) => `activity-${id}`;
const PROFILE = 'stride:profile';
// Lists (feed, profile, badges) only need a light copy of each activity: a simplified route for
// the thumbnail and pre-computed best efforts. Reading thousands of raw GPS points for every
// card made the feed slow; full points are now loaded only on the detail screen.
const SUMMARIES = 'stride:summaries'; // pre-1.3.2 location
const SUMMARIES_BLOB = 'summaries';
const MIGRATED = 'stride:files-v1';
export const EFFORT_DISTANCES = [1000, 5000, 10000, 21097.5];

export type Profile = { name: string; weeklyGoalKm: number; weightKg: number; monthlyGoalKm: number; team: string };
export const DEFAULT_PROFILE: Profile = { name: 'Athlete', weeklyGoalKm: 20, weightKg: 70, monthlyGoalKm: 80, team: '' };

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

// Every write that reads first (index, summaries, gear, profile, settings) goes through one queue, so
// overlapping saves (e.g. a restore still running while a recording is saved) never drop each other.
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

// ---------- one-time move of activities from AsyncStorage into files ----------
// Each activity is copied, read back and compared before the old copy is removed, so nothing can
// be lost half-way. If anything fails it simply tries again on the next launch.
let migration: Promise<void> | null = null;
function migrate(): Promise<void> {
  if (!migration) {
    migration = (async () => {
      if (await AsyncStorage.getItem(MIGRATED)) return;
      let complete = true;
      for (const id of await readIndex()) {
        try {
          const old = await AsyncStorage.getItem(item(id));
          if (old == null) continue;
          await writeBlob(blobKey(id), old);
          if ((await readBlob(blobKey(id))) === old) await AsyncStorage.removeItem(item(id));
          else complete = false;
        } catch { complete = false; }
      }
      try {
        const sums = await AsyncStorage.getItem(SUMMARIES);
        if (sums != null) {
          await writeBlob(SUMMARIES_BLOB, sums);
          if ((await readBlob(SUMMARIES_BLOB)) === sums) await AsyncStorage.removeItem(SUMMARIES);
          else complete = false;
        }
      } catch { complete = false; }
      if (complete) await AsyncStorage.setItem(MIGRATED, '1');
    })().catch(() => { migration = null; });
  }
  return migration;
}

/** The full activity JSON, wherever it currently lives. */
async function readActivityRaw(id: string): Promise<string | null> {
  await migrate();
  return (await readBlob(blobKey(id))) ?? (await AsyncStorage.getItem(item(id)).catch(() => null));
}

/** Bump when bestEffort() changes meaning (v2: never across a rest longer than 2 min) so cached PRs are rebuilt. */
export const EFFORTS_V = 2;
export function toSummary(a: Activity): Activity {
  const efforts: Record<string, number> = {};
  if (a.sport === 'run' && !a.manual) {
    for (const m of EFFORT_DISTANCES) {
      const t = bestEffort(a.segments, m);
      if (t != null) efforts[m] = t;
    }
  }
  return { ...a, lite: true, efforts, effortsV: EFFORTS_V, segments: a.segments.map((g) => simplify(g, 8)) };
}

let summaryCache: Record<string, Activity> | null = null;
async function readSummaries(): Promise<Record<string, Activity>> {
  if (summaryCache) return summaryCache;
  await migrate();
  const raw = (await readBlob(SUMMARIES_BLOB)) ?? (await AsyncStorage.getItem(SUMMARIES).catch(() => null));
  summaryCache = raw ? JSON.parse(raw) : {};
  return summaryCache!;
}
async function writeSummaries(map: Record<string, Activity>) {
  summaryCache = map;
  await writeBlob(SUMMARIES_BLOB, JSON.stringify(map));
}

/** The full activity, or null if it is missing or can't be read (a corrupt file must not break lists). */
async function readActivitySafe(id: string): Promise<Activity | null> {
  try {
    const v = await readActivityRaw(id);
    return v ? (JSON.parse(v) as Activity) : null;
  } catch { return null; }
}

/** Light copies for lists, newest first. Builds missing summaries once (migration from older versions). */
export async function listActivities(): Promise<Activity[]> {
  const ids = await readIndex();
  if (!ids.length) return [];
  let map = await readSummaries();
  const stale = (s: Activity | undefined) => !s || (s.sport === 'run' && !s.manual && s.effortsV !== EFFORTS_V);
  if (ids.some((id) => stale(map[id]))) {
    // queued with the writes, so a save that happens meanwhile can't be replaced by an older summary
    map = await serial(async () => {
      const cur = await readSummaries();
      const missing = ids.filter((id) => stale(cur[id]));
      if (!missing.length) return cur;
      const next = { ...cur };
      for (const a of await Promise.all(missing.map(readActivitySafe))) if (a) next[a.id] = toSummary(a);
      await writeSummaries(next);
      return next;
    });
  }
  return ids.map((id) => map[id]).filter((a): a is Activity => !!a).sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Full activities with every GPS point (backups only: this is slow with a big history), plus the ids
 * of any that could not be read back, so a backup can say so instead of silently leaving them out.
 */
export async function listFullActivities(): Promise<{ activities: Activity[]; unreadable: string[] }> {
  const ids = await readIndex();
  const rows = await Promise.all(ids.map(async (id) => {
    try {
      const v = await readActivityRaw(id);
      return { id, a: v ? (JSON.parse(v) as Activity) : null, ok: true };
    } catch { return { id, a: null, ok: false }; }
  }));
  return {
    activities: rows.map((r) => r.a).filter((a): a is Activity => !!a),
    unreadable: rows.filter((r) => !r.ok).map((r) => r.id),
  };
}

export async function getActivity(id: string): Promise<Activity | null> {
  const raw = await readActivityRaw(id);
  return raw ? JSON.parse(raw) : null;
}

/** Saves the activity file first, then lists it: an interruption can never list a missing activity. */
export function saveActivity(a: Activity, opts: { silent?: boolean } = {}): Promise<void> {
  if (a.lite) return Promise.reject(new Error('Refusing to save a list summary over the full activity'));
  return serial(async () => {
    await migrate();
    await writeBlob(blobKey(a.id), JSON.stringify(a));
    const ids = await readIndex();
    if (!ids.includes(a.id)) { ids.push(a.id); await AsyncStorage.setItem(INDEX, JSON.stringify(ids)); }
    const map = await readSummaries();
    await writeSummaries({ ...map, [a.id]: toSummary(a) });
    if (!opts.silent) emit();
  });
}

/**
 * Add many activities at once (backup restore). Activities whose id already exists here are left
 * alone, so a restore never overwrites newer local edits. The index and the summaries are written
 * once at the end, not once per activity. Returns how many were added.
 */
export function importActivities(list: Activity[]): Promise<number> {
  return serial(async () => {
    await migrate();
    const ids = await readIndex();
    const have = new Set(ids);
    const fresh: Activity[] = [];
    for (const a of list) {
      if (have.has(a.id)) continue;
      have.add(a.id);
      fresh.push({ ...a, lite: undefined, efforts: undefined });
    }
    if (!fresh.length) return 0;
    for (const a of fresh) await writeBlob(blobKey(a.id), JSON.stringify(a)); // files first, then list them
    await AsyncStorage.setItem(INDEX, JSON.stringify([...ids, ...fresh.map((a) => a.id)]));
    const map = { ...(await readSummaries()) };
    for (const a of fresh) map[a.id] = toSummary(a);
    await writeSummaries(map);
    emit();
    return fresh.length;
  });
}

export function deleteActivity(id: string): Promise<Activity | null> {
  return serial(async () => {
    const full = await getActivity(id).catch(() => null); // an unreadable activity can still be deleted
    const ids = (await readIndex()).filter((x) => x !== id);
    const map = { ...(await readSummaries()) };
    delete map[id];
    await AsyncStorage.setItem(INDEX, JSON.stringify(ids));
    await removeBlob(blobKey(id));
    await AsyncStorage.removeItem(item(id)).catch(() => undefined);
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
  return { ...DEFAULT_PROFILE, ...(raw ? JSON.parse(raw) : {}) };
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
