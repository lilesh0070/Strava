// Large JSON documents (every activity with its GPS points, the list summaries, the live recording)
// live in files instead of AsyncStorage. On Android, AsyncStorage caps the whole database at 6 MB
// and a single value at ~2 MB, so a few dozen GPS-rich runs would silently stop saving. Files have no
// such limit and are part of Android's automatic app backup. The web build keeps using localStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const useFiles = Platform.OS !== 'web';
const webKey = (key: string) => `stride:blob:${key}`;
const safe = (key: string) => key.replace(/[^a-zA-Z0-9_-]/g, '_');

let folder: Directory | null = null;
function dir(): Directory {
  if (!folder) {
    folder = new Directory(Paths.document, 'tbdi-data');
    folder.create({ intermediates: true, idempotent: true });
  }
  return folder;
}
const mainFile = (key: string) => new File(dir(), `${safe(key)}.json`);
const tempFile = (key: string) => new File(dir(), `${safe(key)}.json.tmp`);

const isJson = (text: string) => { try { JSON.parse(text); return true; } catch { return false; } };

export async function readBlob(key: string): Promise<string | null> {
  if (!useFiles) return AsyncStorage.getItem(webKey(key));
  const f = mainFile(key), t = tempFile(key);
  const main = f.exists ? await f.text() : null;
  if (main != null && isJson(main)) return main;
  // The swap below is a copy on Android: if the phone died half-way, the main file can be cut short
  // while the temp file still holds the complete new content.
  const temp = t.exists ? await t.text() : null;
  if (temp != null && isJson(temp)) return temp;
  return main;
}

/** Crash-safe write: the new content is written completely to a temp file, then swapped in. */
export async function writeBlob(key: string, value: string): Promise<void> {
  if (!useFiles) return AsyncStorage.setItem(webKey(key), value);
  const t = tempFile(key);
  t.create({ overwrite: true });
  await t.write(value);
  await t.move(mainFile(key), { overwrite: true }); // the temp copy is removed only after a full copy
}

export async function removeBlob(key: string): Promise<void> {
  if (!useFiles) return AsyncStorage.removeItem(webKey(key));
  for (const f of [mainFile(key), tempFile(key)]) if (f.exists) f.delete();
}

/** Bytes used by all blobs (for the "storage used" line in Settings). */
export function blobBytes(): number {
  if (!useFiles) return 0; // counted with the rest of localStorage
  try {
    return dir().list().reduce((s, x) => s + (x instanceof File ? x.size ?? 0 : 0), 0);
  } catch { return 0; }
}
