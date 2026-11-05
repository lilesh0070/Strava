// Two-channel update system:
//  1. Over-the-air (EAS Update): JS/asset changes. Downloaded in the background, applied on restart.
//  2. Full APK (GitHub Releases): native changes. Any phone with internet finds a new release (see
//     releaseInfo.ts for how this avoids GitHub's per-IP API limit), downloads it with progress, checks
//     the file is complete and hands it to the Android package installer.
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Updates from 'expo-updates';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { friendlyError, fromApiRelease, fromManifest, needsReinstall, newestRelease, pickUpdate, type ApkRelease } from './releaseInfo';
import { getSettings } from './storage';

export type { ApkRelease } from './releaseInfo';

export type UpdateState = {
  checking: boolean;
  lastChecked: number | null;
  ota: 'disabled' | 'none' | 'available' | 'downloading' | 'ready' | 'error';
  apk: ApkRelease | null;
  apkProgress: number | null; // 0..1 while downloading
  error: string | null;
  /** The update is signed with a different key: it has to be installed once by hand (see needsReinstall). */
  reinstall: boolean;
};

let state: UpdateState = {
  checking: false, lastChecked: null, ota: Updates.isEnabled ? 'none' : 'disabled',
  apk: null, apkProgress: null, error: null, reinstall: false,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<UpdateState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const useUpdateState = () => useSyncExternalStore(subscribe, () => state);
export const getUpdateState = () => state;

export const currentVersion = () => Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0';
/**
 * Build label for Settings: the native build number (Android versionCode / iOS build), plus the OTA update id
 * when one is running. "dev" only in a development build (it used to show "dev" in every release: OTA is off,
 * so expo-updates never reports an embedded launch).
 */
export const currentBuildId = () => {
  if (__DEV__) return 'dev';
  const native = Application.nativeBuildVersion ?? '';
  const ota = Updates.isEnabled && !Updates.isEmbeddedLaunch ? Updates.updateId?.slice(0, 8) : undefined;
  return [native, ota && `OTA ${ota}`].filter(Boolean).join(' · ') || currentVersion();
};
const extra = () => (Constants.expoConfig?.extra ?? {}) as { updateRepo?: string; signer?: string };
const repo = () => extra().updateRepo ?? 'lilesh0070/strava';
/** Fingerprint of the key this build was signed with (written into app.json by the release workflow). */
export const ownSigner = () => extra().signer ?? '';

async function checkOta() {
  if (!Updates.isEnabled) return;
  const r = await Updates.checkForUpdateAsync();
  if (!r.isAvailable) { set({ ota: 'none' }); return; }
  set({ ota: 'downloading' });
  const f = await Updates.fetchUpdateAsync();
  set({ ota: f.isNew ? 'ready' : 'none' });
}

const NO_CACHE = { 'Cache-Control': 'no-cache', Pragma: 'no-cache' };
const api = (path: string) => fetch(`https://api.github.com/repos/${repo()}${path}`, {
  headers: { Accept: 'application/vnd.github+json', ...NO_CACHE },
});

/** The latest normal release. */
async function stableRelease(): Promise<ApkRelease | null> {
  // 1. update.json via the download CDN (no per-IP API limit). A network error means we're offline.
  const res = await fetch(`https://github.com/${repo()}/releases/latest/download/update.json`, { headers: NO_CACHE });
  if (res.ok) {
    try { const m = fromManifest(JSON.parse(await res.text())); if (m) return m; } catch { /* not a manifest */ }
  }
  // 2. Releases published before update.json existed: ask the API.
  const r = await api('/releases/latest');
  if (r.status === 404) return null; // no releases yet
  if (!r.ok) throw new Error(`GitHub responded ${r.status}`);
  return fromApiRelease(await r.json());
}

/**
 * Link for someone who doesn't have the app yet: the newest APK itself (from the release's update.json),
 * or the release page when that can't be read (offline, or an old release without the manifest).
 */
export const releasePageLink = () => `https://github.com/${repo()}/releases/latest`;
export async function latestApkLink(): Promise<string> {
  const page = releasePageLink();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://github.com/${repo()}/releases/latest/download/update.json`, { headers: NO_CACHE, signal: ctrl.signal });
    if (res.ok) { const m = fromManifest(JSON.parse(await res.text())); if (m) return m.url; }
  } catch { /* offline or not a manifest: the release page always works */ } finally { clearTimeout(timer); }
  return page;
}

/** Newest release including test builds (pre-releases), for testers. */
async function testRelease(): Promise<ApkRelease | null> {
  const r = await api('/releases?per_page=15');
  if (!r.ok) return stableRelease(); // e.g. API limit reached: normal releases still work
  const newest = newestRelease(await r.json());
  const stable = await stableRelease().catch(() => null);
  return pickUpdate(newest, stable?.version ?? '0') ?? stable;
}

async function checkApk() {
  if (Platform.OS !== 'android') return;
  const { betaUpdates } = await getSettings();
  const apk = pickUpdate(await (betaUpdates ? testRelease() : stableRelease()), currentVersion());
  set({ apk, reinstall: needsReinstall(apk, ownSigner()) });
}

/**
 * Check both channels. Safe to call repeatedly; concurrent calls are coalesced. `silent` (automatic
 * checks) keeps quiet about failures such as being offline; a manual check shows them.
 */
let inflight: Promise<void> | null = null;
export function checkForUpdates(opts: { silent?: boolean } = {}): Promise<void> {
  if (inflight) return inflight;
  set({ checking: true, error: null });
  inflight = (async () => {
    const results = await Promise.allSettled([checkOta(), checkApk()]);
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed && results[0].status === 'rejected') set({ ota: 'error' });
    set({ checking: false, lastChecked: failed ? state.lastChecked : Date.now(),
      error: failed && !opts.silent ? friendlyError(failed.reason) : null });
  })().finally(() => { inflight = null; });
  return inflight;
}

/** Automatic re-check when the app comes back to the screen, at most every few hours. */
const RECHECK_MS = 3 * 3600_000;
export function checkIfStale() {
  if (state.checking || state.apkProgress != null) return;
  if (state.lastChecked && Date.now() - state.lastChecked < RECHECK_MS) return;
  checkForUpdates({ silent: true }).catch(() => undefined);
}

/** Restart into the downloaded OTA bundle. */
export const applyOta = () => Updates.reloadAsync();

/** Remove APKs of older updates left in the cache. */
function cleanOldApks(keep: string) {
  try {
    for (const f of new Directory(Paths.cache).list()) {
      if (f instanceof File && /^(tbdi-fittrack|stride)-.*\.apk$/i.test(f.name) && f.name !== keep) f.delete();
    }
  } catch { /* best effort */ }
}

/** Download the newer APK (reusing a complete earlier download) and open the system installer. */
export async function installApk(): Promise<void> {
  const rel = state.apk;
  if (!rel || state.apkProgress != null || state.reinstall) return; // a key change can't install over this app
  set({ apkProgress: 0, error: null });
  try {
    const name = `tbdi-fittrack-${rel.version}.apk`;
    cleanOldApks(name);
    const dest = new File(Paths.cache, name);
    const complete = (f: File) => f.exists && (f.size ?? 0) > 0 && (!rel.size || f.size === rel.size);
    let file = dest;
    if (!complete(dest)) {
      if (dest.exists) dest.delete(); // a half-finished earlier download
      file = await File.downloadFileAsync(rel.url, dest, {
        idempotent: true,
        onProgress: ({ bytesWritten, totalBytes }) => {
          const total = totalBytes > 0 ? totalBytes : rel.size;
          if (total > 0) set({ apkProgress: Math.min(1, bytesWritten / total) });
        },
      });
      // an interrupted transfer would make the installer fail with "problem parsing the package"
      if (!complete(file)) { if (file.exists) file.delete(); throw new Error('The download was incomplete. Please try again.'); }
    }
    // the APK must be exactly the one the release published (a damaged or swapped file is never installed)
    if (rel.sha256) {
      const got = await (file as unknown as { digest(a: 'SHA-256'): Promise<string> }).digest('SHA-256');
      if (got.toLowerCase() !== rel.sha256) { file.delete(); throw new Error('The downloaded file does not match the release. Please try again.'); }
    }
    set({ apkProgress: 1 });
    await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
      data: (file as unknown as { contentUri: string }).contentUri,
      type: 'application/vnd.android.package-archive',
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    });
  } catch (e) {
    set({ error: `Download failed: ${friendlyError(e)}` });
  } finally {
    set({ apkProgress: null });
  }
}
