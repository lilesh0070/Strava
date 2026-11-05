// Cloud backup on GitHub: your data lives in a *secret* Gist on your own GitHub account.
// Needs a personal access token with only the "gist" permission; it is kept in the phone's
// secure keystore (expo-secure-store), never in plain storage or in backups.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { applyBackup, buildBackup, parseBackup } from './backup';

const TOKEN_KEY = 'stride_github_token';
const META_KEY = 'stride:github-sync';
const FILE = 'stride-backup.json';
const API = 'https://api.github.com';

export type SyncMeta = {
  gistId?: string; login?: string; lastSyncAt?: number; lastError?: string | null; auto: boolean;
  /** Connected to a backup that already existed: merge it in before the first upload, so this phone can't replace it. */
  needsPull?: boolean;
};

let meta: SyncMeta = { auto: true };
let busy = false;
let pushAgain = false; // an upload was asked for while one was running
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let snapshot = { meta, busy };
const set = async (patch: Partial<SyncMeta>) => {
  meta = { ...meta, ...patch };
  snapshot = { meta, busy };
  emit();
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
};
const setBusy = (b: boolean) => { busy = b; snapshot = { meta, busy }; emit(); };

export async function loadSyncMeta() {
  if (loaded) return meta;
  const raw = await AsyncStorage.getItem(META_KEY);
  meta = { auto: true, ...(raw ? JSON.parse(raw) : {}) };
  loaded = true;
  snapshot = { meta, busy };
  emit();
  return meta;
}
export const useGithubSync = () =>
  useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => snapshot);

async function gh(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 401) throw new Error('GitHub rejected the token. Create a new one with the "gist" permission.');
  if (res.status === 403) throw new Error('GitHub refused the request (token needs the "gist" permission, or rate limited).');
  if (!res.ok) throw new Error(`GitHub error ${res.status}`);
  return res.json();
}

/** Save the token after checking it works, and find an existing Stride gist if there is one. */
export async function connect(token: string): Promise<void> {
  token = token.trim();
  if (!token) throw new Error('Paste a token first.');
  await loadSyncMeta();
  const user = await gh('/user', token);
  // look through every page of gists (100 per page) for an existing Stride backup
  let existing: { id: string } | undefined;
  for (let page = 1; page <= 30 && !existing; page++) {
    const gists: { id: string; files: Record<string, unknown> }[] = await gh(`/gists?per_page=100&page=${page}`, token);
    existing = gists.find((g) => g.files && FILE in g.files);
    if (gists.length < 100) break;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await set({ login: user.login, gistId: existing?.id, needsPull: !!existing, lastError: null });
}

/** The backup JSON stored in the gist, or null if the gist is gone. */
async function downloadBackup(token: string, gistId: string): Promise<string | null> {
  let gist: { files?: Record<string, { truncated?: boolean; raw_url: string; content: string }> };
  try { gist = await gh(`/gists/${gistId}`, token); }
  catch (e) { if (String((e as Error).message).includes('404')) return null; throw e; }
  const f = gist.files?.[FILE];
  if (!f) throw new Error('The backup gist has no Stride file.');
  if (!f.truncated) return f.content;
  // large files are truncated in the API response; fetch the raw file instead
  const res = await fetch(f.raw_url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Could not download the backup from GitHub (error ${res.status}).`);
  return res.text();
}

export async function disconnect() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await set({ login: undefined, gistId: undefined, lastSyncAt: undefined, lastError: null, needsPull: false });
}

export const setAutoSync = (auto: boolean) => set({ auto });

/** Upload everything to the gist (creating it the first time). */
export async function pushToGithub(): Promise<number> {
  await loadSyncMeta();
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) throw new Error('Connect GitHub first.');
  if (busy) { pushAgain = true; return 0; } // uploaded as soon as the running sync finishes
  setBusy(true);
  try {
    if (meta.needsPull && meta.gistId) {
      // first upload from this phone: keep what is already in the cloud by merging it in first
      const remote = await downloadBackup(token, meta.gistId);
      if (remote) await applyBackup(remote, { includeSettings: false });
      await set({ needsPull: false });
    }
    let { json, count, unreadable } = await buildBackup();
    if (unreadable.length && meta.gistId) {
      // activities this phone can't read back must not vanish from the cloud: keep the gist's copies
      const remote = await downloadBackup(token, meta.gistId);
      const keep = remote ? parseBackup(remote).activities.filter((a) => unreadable.includes(a.id)) : [];
      if (keep.length) ({ json, count } = await buildBackup(keep));
    }
    const body = JSON.stringify({ description: 'Stride activity backup (private)', files: { [FILE]: { content: json } } });
    let gistId = meta.gistId;
    if (gistId) {
      try { await gh(`/gists/${gistId}`, token, { method: 'PATCH', body }); }
      catch (e) {
        if (!String((e as Error).message).includes('404')) throw e;
        gistId = undefined; // gist was deleted on GitHub; make a new one
      }
    }
    if (!gistId) {
      const created = await gh('/gists', token, { method: 'POST', body: JSON.stringify({ ...JSON.parse(body), public: false }) });
      gistId = created.id;
    }
    await set({ gistId, lastSyncAt: Date.now(), lastError: null });
    return count;
  } catch (e) {
    await set({ lastError: (e as Error).message });
    throw e;
  } finally {
    setBusy(false);
    if (pushAgain) { pushAgain = false; pushToGithub().catch(() => undefined); }
  }
}

/** Download the gist and merge it into this phone (e.g. on a new phone). */
export async function pullFromGithub(): Promise<number> {
  await loadSyncMeta();
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) throw new Error('Connect GitHub first.');
  if (!meta.gistId) throw new Error('No Stride backup found on this GitHub account yet.');
  if (busy) throw new Error('A GitHub sync is already running. Try again in a moment.');
  setBusy(true);
  try {
    const text = await downloadBackup(token, meta.gistId);
    if (text == null) throw new Error('The backup gist was deleted on GitHub.');
    const n = await applyBackup(text, { includeSettings: false });
    await set({ lastSyncAt: Date.now(), lastError: null, needsPull: false });
    return n;
  } catch (e) {
    await set({ lastError: (e as Error).message });
    throw e;
  } finally {
    setBusy(false);
    if (pushAgain) { pushAgain = false; pushToGithub().catch(() => undefined); }
  }
}

/** Called after an activity is saved: quietly back up if connected and auto-sync is on. */
export async function autoSync() {
  await loadSyncMeta();
  if (!meta.auto || !meta.login) return;
  pushToGithub().catch(() => undefined); // error is recorded in meta and shown in Settings
}
