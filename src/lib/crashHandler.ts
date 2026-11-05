// Safety net for errors no error boundary sees: event handlers, timers, listeners, promise callbacks
// and the background GPS task. Imported first from index.js, so it is in place before the recorder
// and the router load, also when Android starts the app without a screen to deliver GPS fixes.
//
// Each error goes into a small crash log (the last few, with time, version, message and the top of
// the stack; see crashLog.ts) before React Native's own handler runs. The write is synchronous: in a
// release build a fatal error closes the app right after. Unhandled promise rejections, which React
// Native drops silently in release builds, go to the same log. Settings shows the log, and the next
// launch after a crash offers to send it.
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { addCrash, crashEntry, crashReport, emptyCrashLog, parseCrashLog, unseenFatal, type CrashEntry, type CrashKind, type CrashLog } from './crashLog';

const useFiles = Platform.OS !== 'web';
const WEB_KEY = 'stride:crash-log';
type WebStorage = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
const webStorage = () => (globalThis as { localStorage?: WebStorage }).localStorage;

let logFile: File | null = null;
function file(): File {
  if (!logFile) {
    const dir = new Directory(Paths.document, 'tbdi-data'); // next to the activities (blobStore.ts)
    dir.create({ intermediates: true, idempotent: true });
    logFile = new File(dir, 'crash-log.json');
  }
  return logFile;
}

let cache: CrashLog | null = null;
function load(): CrashLog {
  if (cache) return cache;
  try {
    if (useFiles) { const f = file(); cache = parseCrashLog(f.exists ? f.textSync() : null); }
    else cache = parseCrashLog(webStorage()?.getItem(WEB_KEY));
  } catch { cache = emptyCrashLog(); }
  return cache;
}
function save(log: CrashLog) {
  cache = log;
  try {
    // a few KB: small enough to write synchronously even from inside a fatal error
    if (useFiles) file().writeSync(JSON.stringify(log));
    else webStorage()?.setItem(WEB_KEY, JSON.stringify(log));
  } catch { /* the log must never be what breaks the app */ }
}

const appVersion = () => Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '?';
const buildNumber = () => Application.nativeBuildVersion ?? (__DEV__ ? 'dev' : '?');

/** Record an error. Never throws. */
export function logError(e: unknown, kind: CrashKind): void {
  try { save(addCrash(load(), crashEntry(e, kind, { at: Date.now(), v: appVersion(), b: buildNumber() }))); } catch { /* never */ }
}

/** The log, oldest entry first. */
export const getCrashLog = (): CrashLog => load();

export function clearCrashLog(): void {
  cache = { seenAt: Date.now(), entries: [] };
  try {
    if (useFiles) { const f = file(); if (f.exists) f.delete(); } else webStorage()?.removeItem(WEB_KEY);
  } catch { /* best effort */ }
}

/** A crash that closed the app since the last launch the user saw; marks it as mentioned. */
export function takeUnseenCrash(): CrashEntry | null {
  const log = load();
  const c = unseenFatal(log);
  if (c) save({ ...log, seenAt: Date.now() });
  return c;
}

/** App, build and phone, the first line of every report. */
export const deviceLine = () =>
  `TBDI FitTrack ${appVersion()} (build ${buildNumber()}) · ${Platform.OS} ${String(Platform.Version)}`;

/** The whole log as text (newest first), for the clipboard or the share sheet. */
export const crashLogText = (): string => crashReport(load().entries, deviceLine());

/** An entry for an error without storing it (for the crash screen's details). */
export const describeError = (e: unknown, kind: CrashKind) => crashEntry(e, kind, { at: Date.now(), v: appVersion(), b: buildNumber() });

type Hermes = { enablePromiseRejectionTracker?: (o: { allRejections: boolean; onUnhandled: (id: number, e: unknown) => void; onHandled: (id: number) => void }) => void };

let installed = false;
export function installCrashHandler(): void {
  if (installed || typeof ErrorUtils === 'undefined' || !ErrorUtils.getGlobalHandler) return;
  installed = true;
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    logError(error, isFatal ? 'fatal' : 'error');
    previous?.(error, isFatal); // React Native's handler: the red box in development, closing the app when fatal in release
  });
  // Development keeps React Native's own tracker (it shows rejections as warnings); release builds have none.
  if (!__DEV__) {
    const hermes = (globalThis as { HermesInternal?: Hermes | null }).HermesInternal;
    hermes?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id, e) => logError(e, 'promise'),
      onHandled: () => undefined,
    });
  }
}

installCrashHandler();
