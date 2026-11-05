// Full local backup / restore as a single JSON document. Used both for the file export and for
// GitHub Gist sync, so the format is shared.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getSettings, hasSavedProfile, importActivities, listFullActivities, listGear, getProfile, saveProfile, saveSettings, updateGear } from './storage';
import type { Activity } from './types';

const FORMAT = 'stride-backup';
const VERSION = 1;

export async function buildBackup(): Promise<{ json: string; count: number }> {
  const [activities, gear, profile, settings] = await Promise.all([listFullActivities(), listGear(), getProfile(), getSettings()]);
  const json = JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), activities, gear, profile, settings });
  return { json, count: activities.length };
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
 * gear are added by id, and the profile is only taken when this phone has none yet. Returns the number
 * of activities added.
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
  if (data.profile && !(await hasSavedProfile())) await saveProfile({ ...(await getProfile()), ...data.profile });
  if (data.settings && opts.includeSettings !== false) await saveSettings({ ...(await getSettings()), ...data.settings });
  return added;
}

export async function exportBackup(): Promise<number> {
  const { json, count } = await buildBackup();
  const file = new File(Paths.cache, `stride-backup-${new Date().toISOString().slice(0, 10)}.json`);
  file.create({ overwrite: true });
  await file.write(json); // async in SDK 58: share only once the file is complete
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Stride backup' });
  return count;
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
