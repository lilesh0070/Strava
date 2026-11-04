import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Activity, Gear, GearKind, Settings } from './types';

const INDEX = 'stride:activities';
const item = (id: string) => `stride:activity:${id}`;
const PROFILE = 'stride:profile';

export type Profile = { name: string; weeklyGoalKm: number };

type Listener = () => void;
const listeners = new Set<Listener>();
export function onActivitiesChanged(fn: Listener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
const emit = () => listeners.forEach((l) => l());

async function readIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(INDEX);
  return raw ? JSON.parse(raw) : [];
}

export async function listActivities(): Promise<Activity[]> {
  const ids = await readIndex();
  if (!ids.length) return [];
  const rows = await AsyncStorage.multiGet(ids.map(item));
  return rows
    .map(([, v]) => (v ? (JSON.parse(v) as Activity) : null))
    .filter((a): a is Activity => !!a)
    .sort((a, b) => b.startedAt - a.startedAt);
}

export async function getActivity(id: string): Promise<Activity | null> {
  const raw = await AsyncStorage.getItem(item(id));
  return raw ? JSON.parse(raw) : null;
}

export async function saveActivity(a: Activity): Promise<void> {
  const ids = await readIndex();
  if (!ids.includes(a.id)) ids.push(a.id);
  await AsyncStorage.multiSet([[item(a.id), JSON.stringify(a)], [INDEX, JSON.stringify(ids)]]);
  emit();
}

export async function deleteActivity(id: string): Promise<void> {
  const ids = (await readIndex()).filter((x) => x !== id);
  await AsyncStorage.setItem(INDEX, JSON.stringify(ids));
  await AsyncStorage.removeItem(item(id));
  emit();
}

// ---------- settings ----------
const SETTINGS = 'stride:settings';
export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(SETTINGS);
  return { voiceCues: true, autoPause: false, ...(raw ? JSON.parse(raw) : {}) };
}
export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS, JSON.stringify(s));
  emit();
}

// ---------- gear ----------
const GEAR = 'stride:gear';
export async function listGear(): Promise<Gear[]> {
  const raw = await AsyncStorage.getItem(GEAR);
  return raw ? JSON.parse(raw) : [];
}
export async function saveGearList(list: Gear[]): Promise<void> {
  await AsyncStorage.setItem(GEAR, JSON.stringify(list));
  emit();
}
export async function defaultGear(kind: GearKind): Promise<Gear | undefined> {
  return (await listGear()).find((g) => g.kind === kind && g.isDefault && !g.retired);
}

export async function getProfile(): Promise<Profile> {
  const raw = await AsyncStorage.getItem(PROFILE);
  return { name: 'Athlete', weeklyGoalKm: 20, ...(raw ? JSON.parse(raw) : {}) };
}

export async function saveProfile(p: Profile): Promise<void> {
  await AsyncStorage.setItem(PROFILE, JSON.stringify(p));
  emit();
}
