// Two-channel update system:
//  1. Over-the-air (EAS Update): JS/asset changes. Downloaded in the background, applied on restart.
//  2. Full APK (GitHub Releases): native changes. Downloaded with progress, then handed to the
//     Android package installer.
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Updates from 'expo-updates';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { compareVersions } from './semver';

export type ApkRelease = { version: string; notes: string; url: string; size: number; name: string; htmlUrl: string };

export type UpdateState = {
  checking: boolean;
  lastChecked: number | null;
  ota: 'disabled' | 'none' | 'available' | 'downloading' | 'ready' | 'error';
  apk: ApkRelease | null;
  apkProgress: number | null; // 0..1 while downloading
  error: string | null;
};

let state: UpdateState = {
  checking: false, lastChecked: null, ota: Updates.isEnabled ? 'none' : 'disabled',
  apk: null, apkProgress: null, error: null,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<UpdateState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const useUpdateState = () => useSyncExternalStore(subscribe, () => state);
export const getUpdateState = () => state;

export const currentVersion = () => Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0';
export const currentBuildId = () => Updates.updateId?.slice(0, 8) ?? (Updates.isEmbeddedLaunch ? 'embedded' : 'dev');
const repo = () => (Constants.expoConfig?.extra as { updateRepo?: string } | undefined)?.updateRepo ?? 'lilesh0070/strava';

async function checkOta() {
  if (!Updates.isEnabled) return;
  const r = await Updates.checkForUpdateAsync();
  if (!r.isAvailable) { set({ ota: 'none' }); return; }
  set({ ota: 'downloading' });
  const f = await Updates.fetchUpdateAsync();
  set({ ota: f.isNew ? 'ready' : 'none' });
}

async function checkApk() {
  if (Platform.OS !== 'android') return;
  const res = await fetch(`https://api.github.com/repos/${repo()}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) { set({ apk: null }); return; } // no releases yet
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  const rel = await res.json();
  const asset = (rel.assets ?? []).find((a: { name: string }) => a.name.toLowerCase().endsWith('.apk'));
  const version = String(rel.tag_name ?? '');
  if (asset && compareVersions(version, currentVersion()) > 0) {
    set({ apk: { version: version.replace(/^v/i, ''), notes: rel.body ?? '', url: asset.browser_download_url,
      size: asset.size ?? 0, name: asset.name, htmlUrl: rel.html_url } });
  } else set({ apk: null });
}

/** Check both channels. Safe to call repeatedly; concurrent calls are coalesced. */
let inflight: Promise<void> | null = null;
export function checkForUpdates(): Promise<void> {
  if (inflight) return inflight;
  set({ checking: true, error: null });
  inflight = (async () => {
    const results = await Promise.allSettled([checkOta(), checkApk()]);
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed && results[0].status === 'rejected') set({ ota: 'error' });
    set({ checking: false, lastChecked: Date.now(), error: failed ? String(failed.reason?.message ?? failed.reason) : null });
  })().finally(() => { inflight = null; });
  return inflight;
}

/** Restart into the downloaded OTA bundle. */
export const applyOta = () => Updates.reloadAsync();

/** Download the newer APK and open the system installer. */
export async function installApk(): Promise<void> {
  const rel = state.apk;
  if (!rel) return;
  set({ apkProgress: 0, error: null });
  try {
    const dest = new File(Paths.cache, `stride-${rel.version}.apk`);
    const file = await File.downloadFileAsync(rel.url, dest, {
      idempotent: true,
      onProgress: ({ bytesWritten, totalBytes }) => {
        const total = totalBytes > 0 ? totalBytes : rel.size;
        if (total > 0) set({ apkProgress: bytesWritten / total });
      },
    });
    set({ apkProgress: 1 });
    await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
      data: (file as unknown as { contentUri: string }).contentUri,
      type: 'application/vnd.android.package-archive',
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    });
  } catch (e) {
    set({ error: `Download failed: ${(e as Error)?.message ?? e}` });
  } finally {
    set({ apkProgress: null });
  }
}
