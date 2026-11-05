// Full local backup / restore as a single JSON document. Used both for the file export and for
// GitHub Gist sync, so the format is shared.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { DEFAULT_PROFILE, getSettings, importActivities, listFullActivities, listGear, getProfile, saveProfile, saveSettings, updateGear, type Profile } from './storage';
import type { Activity } from './types';

const FORMAT = 'stride-backup';
const VERSION = 1;

/** The backup document. `unreadable` lists activity ids that couldn't be read back and are not in it. */
export async function buildBackup(extra: Activity[] = []): Promise<{ json: string; count: number; unreadable: string[] }> {
  const [{ activities, unreadable }, gear, profile, settings] = await Promise.all([listFullActivities(), listGear(), getProfile(), getSettings()]);
  const all = [...activities, ...extra];
  const json = JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), activities: all, gear, profile, settings });
  return { json, count: all.length, unreadable };
}

export type BackupData = { format?: string; activities?: Activity[]; gear?: unknown[]; profile?: object; settings?: object };

/** Parse and sanity-check a backup document. */
export function parseBackup(text: string): BackupData & { activities: Activity[] } {
  let data: BackupData;
  try { data = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  if (!data || data.format !== FORMAT || !Array.isArray(data.activities)) throw new Error('That file is not a Stride backup.');
  const activities = data.activities.filter((a) => a && typeof a.id === 'string' && Array.isArray(a.segments) && typeof a.startedAt === 'number');
  return { ...data, activities };
}

/**
 * Merge a backup into local data. Nothing is deleted and nothing local is overwritten: activities and
 * gear are added by id, and profile fields are only taken where this phone still has the default (so a
 * name typed during onboarding stays, but goals and weight come back). Returns the number added.
 */
export async function applyBackup(text: string, opts: { includeSettings?: boolean } = {}): Promise<number> {
  const data = parseBackup(text);
  const added = await importActivities(data.activities);
  if (Array.isArray(data.gear)) {
    const incoming = (data.gear as Awaited<ReturnType<typeof listGear>>).filter((g) => g && typeof g.id === 'string');
    await updateGear((existing) => {
      const ids = new Set(existing.map((g) => g.id));
      return [...existing, ...incoming.filter((g) => !ids.has(g.id))];
    });
  }
  if (data.profile && typeof data.profile === 'object') {
    const local = await getProfile();
    const incoming = data.profile as Partial<Profile>;
    const merged: Profile = { ...local };
    let changed = false;
    for (const k of Object.keys(DEFAULT_PROFILE) as (keyof Profile)[]) {
      const v = incoming[k];
      if (v != null && typeof v === typeof DEFAULT_PROFILE[k] && local[k] === DEFAULT_PROFILE[k] && v !== local[k]) {
        (merged as Record<keyof Profile, unknown>)[k] = v;
        changed = true;
      }
    }
    if (changed) await saveProfile(merged);
  }
  if (data.settings && opts.includeSettings !== false) await saveSettings({ ...(await getSettings()), ...data.settings });
  return added;
}

/** Share a backup file. Returns how many activities it holds and how many couldn't be read. */
export async function exportBackup(): Promise<{ count: number; unreadable: number }> {
  const { json, count, unreadable } = await buildBackup();
  const file = new File(Paths.cache, `stride-backup-${new Date().toISOString().slice(0, 10)}.json`);
  file.create({ overwrite: true });
  await file.write(json); // async in SDK 58: share only once the file is complete
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Stride backup' });
  return { count, unreadable: unreadable.length };
}

/** Returns the number of activities imported, or null if the user cancelled. */
export async function importBackup(): Promise<number | null> {
  const pick = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (pick.canceled || !pick.assets?.[0]) return null;
  return applyBackup(await new File(pick.assets[0].uri).text());
}

export async function storageBytes(): Promise<number> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('stride:'));
  const rows = await AsyncStorage.multiGet(keys);
  return rows.reduce((s, [k, v]) => s + k.length + (v?.length ?? 0), 0);
}
