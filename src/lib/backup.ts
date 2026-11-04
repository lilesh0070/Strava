// Full local backup / restore as a single JSON file (the app has no cloud yet, so this is
// how users move data to a new phone or survive a reinstall).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { listActivities, listGear, getProfile, getSettings, saveActivity, saveGearList, saveProfile, saveSettings } from './storage';
import type { Activity } from './types';

const FORMAT = 'stride-backup';
const VERSION = 1;

export async function exportBackup(): Promise<number> {
  const [activities, gear, profile, settings] = await Promise.all([listActivities(), listGear(), getProfile(), getSettings()]);
  const body = JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), activities, gear, profile, settings });
  const file = new File(Paths.cache, `stride-backup-${new Date().toISOString().slice(0, 10)}.json`);
  file.create({ overwrite: true });
  file.write(body);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Stride backup' });
  return activities.length;
}

/** Returns the number of activities imported, or null if the user cancelled. Merges by id. */
export async function importBackup(): Promise<number | null> {
  const pick = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (pick.canceled || !pick.assets?.[0]) return null;
  const text = await new File(pick.assets[0].uri).text();
  let data: { format?: string; activities?: Activity[]; gear?: unknown[]; profile?: object; settings?: object };
  try { data = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  if (data.format !== FORMAT || !Array.isArray(data.activities)) throw new Error('That file is not a Stride backup.');

  const valid = data.activities.filter((a) => a && typeof a.id === 'string' && Array.isArray(a.segments) && typeof a.startedAt === 'number');
  for (const a of valid) await saveActivity(a);
  if (Array.isArray(data.gear)) {
    const existing = await listGear();
    const ids = new Set(existing.map((g) => g.id));
    await saveGearList([...existing, ...(data.gear as typeof existing).filter((g) => g && !ids.has(g.id))]);
  }
  if (data.profile) await saveProfile({ ...(await getProfile()), ...data.profile });
  if (data.settings) await saveSettings({ ...(await getSettings()), ...data.settings });
  return valid.length;
}

export async function storageBytes(): Promise<number> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('stride:'));
  const rows = await AsyncStorage.multiGet(keys);
  return rows.reduce((s, [k, v]) => s + k.length + (v?.length ?? 0), 0);
}
