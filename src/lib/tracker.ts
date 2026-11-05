// GPS recording engine. Uses a background location task when "Always" permission is granted
// (keeps recording with the screen off via an Android foreground service), and falls back to a
// foreground watcher otherwise. Session state is persisted so a killed app can resume.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { AUTO_RESUME_DIST_M, kmCue, shouldAutoPause } from './coach';
import { acceptPoint, elevationGain, haversine, totalDistance, type Point } from './geo';
import { advance, findWorkout, startProgress, stepCue } from './workouts';
import { expectedSpeed, kalmanStep, lapsFromMarks, paceAdvice, rollingSpeed } from './live';
import { autoSync } from './githubSync';
import { kmCueHi, speechLanguage, voicePhrases } from './strings';
import { defaultGear, getSettings, saveActivity } from './storage';
import {
  DEFAULT_SETTINGS, defaultName, gearKindFor, newActivityId, sessionMovingSec, sportInfo, workoutSec,
  type Activity, type Session, type Settings, type Sport,
} from './types';

export const LOCATION_TASK = 'stride-location-task';
const SESSION_KEY = 'stride:session';

let session: Session | null = null;
let loaded = false;
let watcher: Location.LocationSubscription | null = null;
let lastFix: Point | null = null;
let settings: Settings = { ...DEFAULT_SETTINGS };
/** Speak in the app language (Hindi voice when Hindi is selected). */
const say = (text: string, lang = settings.language) => Speech.speak(text, { language: speechLanguage(lang) });
const phrase = () => voicePhrases[settings.language] ?? voicePhrases.en;
const refreshSettings = () => getSettings().then((x) => { settings = x; }).catch(() => undefined);
refreshSettings();
export const getSettingsCache = () => settings;
export { refreshSettings };
const listeners = new Set<() => void>();

// Serialise all mutations so the background task and UI never clobber each other.
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

// Battery: while the app is in the background nobody can see the UI, so skip re-rendering
// (and the map WebView redraw it triggers) and only persist periodically.
let appActive = AppState.currentState === 'active';
AppState.addEventListener('change', (st) => {
  appActive = st === 'active';
  if (appActive) notify();
  else locked(persist).catch(() => undefined); // make sure nothing is lost if the OS kills us (queued, so it can't revive a finished session)
});
function notify() { if (appActive) listeners.forEach((l) => l()); }

const PERSIST_EVERY_MS = 15_000;
let lastPersistAt = 0;
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export const getSession = () => session;
export const getLastFix = () => lastFix;

// The session's points are stored in chunks, not inside one value: Android can't read back a value
// over 2 MB (about 8 hours of 1 Hz GPS). Points are only ever appended, so a save rewrites just the
// session info and the last chunk instead of the whole track.
const chunkKey = (i: number) => `${SESSION_KEY}:pts:${i}`;
const POINTS_PER_CHUNK = 4000; // ~300 KB
let persistedPoints = 0; // points already safely in full chunks + the last chunk
let storedChunks = 0;
let keepUnreadable = false; // a stored session we couldn't read: leave it until a new one replaces it

async function load() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    if (stored && Array.isArray(stored.segLens)) {
      const { segLens, chunks, ...rest } = stored as Omit<Session, 'segments'> & { segLens: number[]; chunks: number };
      const rows = await AsyncStorage.multiGet(Array.from({ length: chunks }, (_, i) => chunkKey(i)));
      const flat: Point[] = rows.flatMap(([, v]) => (v ? (JSON.parse(v) as Point[]) : []));
      let o = 0;
      const segments = segLens.map((n) => { const seg = flat.slice(o, o + n); o += n; return seg; });
      session = { ...rest, segments };
      persistedPoints = flat.length;
      storedChunks = chunks;
    } else {
      session = stored; // saved by v1.2: points inline
    }
  } catch {
    // unreadable (corrupt, or a huge v1.2 session over the read limit): don't fail every later
    // start/ingest, and don't delete it either
    session = null;
    keepUnreadable = true;
  }
  loaded = true;
}
async function persist() {
  lastPersistAt = Date.now();
  if (session) {
    const { segments, ...info } = session;
    const flat = segments.flat();
    const n = Math.ceil(flat.length / POINTS_PER_CHUNK);
    const firstDirty = Math.floor(Math.min(persistedPoints, flat.length) / POINTS_PER_CHUNK);
    const pairs: [string, string][] = [[SESSION_KEY, JSON.stringify({ ...info, segLens: segments.map((g) => g.length), chunks: n })]];
    for (let i = firstDirty; i < n; i++) pairs.push([chunkKey(i), JSON.stringify(flat.slice(i * POINTS_PER_CHUNK, (i + 1) * POINTS_PER_CHUNK))]);
    await AsyncStorage.multiSet(pairs); // info and chunks together, so they always agree
    if (storedChunks > n) await AsyncStorage.multiRemove(Array.from({ length: storedChunks - n }, (_, i) => chunkKey(n + i)));
    persistedPoints = flat.length;
    storedChunks = n;
    keepUnreadable = false;
  } else if (!keepUnreadable) {
    await AsyncStorage.multiRemove([SESSION_KEY, ...Array.from({ length: storedChunks }, (_, i) => chunkKey(i))]);
    persistedPoints = 0;
    storedChunks = 0;
  }
}
/** Writing the whole session every second is the biggest CPU/battery cost after GPS; throttle it. */
async function persistSoon() {
  if (Date.now() - lastPersistAt >= PERSIST_EVERY_MS) await persist();
}

const r = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
function toPoint(l: Location.LocationObject): Point {
  // ~10 cm precision is plenty and keeps stored activities small
  return {
    lat: r(l.coords.latitude, 6),
    lng: r(l.coords.longitude, 6),
    alt: l.coords.altitude == null ? null : r(l.coords.altitude, 1),
    acc: l.coords.accuracy == null ? null : Math.round(l.coords.accuracy),
    t: l.timestamp,
  };
}

export function ingest(locations: Location.LocationObject[]) {
  return locked(async () => {
    await load();
    const statusBefore = session?.status;
    for (const l of locations) {
      const p = toPoint(l);
      lastFix = p;
      if (!session) continue;
      ingestFix(session, p);
      // time-based interval steps are checked on every fix, kept or not (standing rests, screen off)
      stepWorkout(session, p.t);
    }
    if (session) await (session.status !== statusBefore ? persist() : persistSoon());
    notify();
  });
}

function ingestFix(s: Session, p: Point) {
  const seg = s.segments[s.segments.length - 1];
  const prev = seg[seg.length - 1];

  if (s.status === 'paused') {
    // auto-resume once the athlete clearly moves away from where they stopped
    const last = prev ?? s.segments.flat().at(-1);
    if (s.autoPaused && last && (p.acc ?? 99) <= 35 && haversine(last, p) >= AUTO_RESUME_DIST_M) {
      const pausedFor = Math.max(0, p.t - (s.pauseStartedAt ?? p.t));
      s.pausedMs += pausedFor;
      s.autoPausedMs = (s.autoPausedMs ?? 0) + pausedFor;
      s.pauseStartedAt = null;
      s.status = 'recording';
      s.autoPaused = false;
      s.segments.push([p]);
      s.segStartedAt = p.t;
      s.kf = null;
      if (settings.voiceCues) say(phrase().resumed);
    }
    return;
  }

  // smooth good-quality fixes before deciding whether to keep them
  let q = p;
  if ((p.acc ?? 99) <= 35) {
    s.kf = kalmanStep(s.kf, p, expectedSpeed(s.sport));
    q = { ...p, lat: r(s.kf.lat, 6), lng: r(s.kf.lng, 6) }; // same ~10 cm precision as raw fixes
  }
  if (acceptPoint(prev, q, s.sport === 'ride' ? 45 : 12)) {
    if (prev) {
      const d = haversine(prev, q);
      s.distanceM = (s.distanceM ?? 0) + d;
      const v = d / Math.max(1, (q.t - prev.t) / 1000);
      if (seg.length > 3) s.maxSpeedMs = Math.max(s.maxSpeedMs ?? 0, v);
    }
    seg.push(q);
    coachPace(s, seg, q.t);
    const km = Math.floor((s.distanceM ?? 0) / 1000);
    if (km > (s.lastCueKm ?? 0)) {
      s.lastCueKm = km;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (settings.voiceCues) {
        const args = [km, sessionMovingSec(s, p.t), sportInfo(s.sport).usesPace] as const;
        say(settings.language === 'hi' ? kmCueHi(...args) : kmCue(...args));
      }
    }
    return;
  }
  // Idle since the last kept point, or since this segment began. Never measured from a point before the
  // last resume, or a manual pause would be counted twice.
  const idleSince = prev?.t ?? s.segStartedAt ?? (s.segments.length === 1 ? s.startedAt : p.t);
  if (settings.autoPause && shouldAutoPause(idleSince, p.t) && (s.distanceM ?? 0) > 0) {
    s.status = 'paused';
    s.autoPaused = true;
    s.pauseStartedAt = idleSince;
    if (settings.voiceCues) say(phrase().paused);
  }
}

function coachPace(s: Session, seg: Point[], now: number) {
  const target = settings.targetPaceSec;
  if (!target || !settings.voiceCues || !sportInfo(s.sport).usesPace) return;
  if (now - (s.lastPaceAlertAt ?? s.startedAt) < 90_000) return; // at most every 90 s
  const v = rollingSpeed(seg, 60);
  const advice = paceAdvice(v ? 1000 / v : null, target);
  if (!advice) return;
  s.lastPaceAlertAt = now;
  say(advice === 'faster' ? phrase().faster : phrase().slower);
}

function stepWorkout(s: Session, now: number) {
  const w = findWorkout(s.workout?.workoutId);
  // a manual pause freezes the workout; an auto-pause (standing rest) does not
  if (!w || !s.workout || (s.status !== 'recording' && !s.autoPaused)) return false;
  const r = advance(w, s.workout, s.distanceM ?? 0, workoutSec(s, now));
  if (!r.changed) return false;
  s.workout = r.p;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  say(stepCue(w, r.p), 'en'); // workout cues always speak (English): they are the point of the feature
  return true;
}

/** Time-based interval steps also need checking when no new GPS fix arrives (e.g. standing rest). */
export function workoutTick() {
  return locked(async () => {
    if (session && stepWorkout(session, Date.now())) { await persist(); notify(); }
  });
}

/** Current pace/speed from the last 30 s of movement (m/s); 0 once no movement has been kept for a while. */
export function currentSpeed(now = Date.now()): number | null {
  if (!session || session.status !== 'recording') return null;
  const seg = session.segments[session.segments.length - 1];
  const last = seg[seg.length - 1];
  // fixes less than 3 m apart are dropped, so a long gap since the last kept one means standing still
  if (!last || now - last.t > 15_000) return 0;
  return rollingSpeed(seg, 30);
}

/** Close the current lap. */
export function lap() {
  return locked(async () => {
    if (!session) return;
    const marks = session.laps ?? [];
    const dist = session.distanceM ?? 0;
    const sec = sessionMovingSec(session);
    const prev = marks[marks.length - 1] ?? { distanceM: 0, movingSec: 0 };
    if (sec - prev.movingSec < 3) return; // ignore double taps
    session.laps = [...marks, { distanceM: dist, movingSec: sec }];
    await persist();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    if (settings.voiceCues) {
      const d = dist - prev.distanceM, t = sec - prev.movingSec;
      say(phrase().lap(session.laps.length, (d / 1000).toFixed(2), t));
    }
    notify();
  });
}

// Must be defined at module scope so it is registered when the JS runtime boots in the background.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations) return;
  await ingest(data.locations);
});

/** Pick up a session left by a killed app and restart GPS for it. Called once at app start. */
let restoring: Promise<Session | null> | null = null;
export function restore(): Promise<Session | null> {
  restoring ??= (async () => {
    await locked(load);
    if (session && !(await isTracking())) await startUpdates(session.sport, !!session.workout);
    notify();
    return session;
  })().finally(() => { restoring = null; });
  return restoring;
}

async function isTracking() {
  if (watcher) return true;
  try { return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK); } catch { return false; }
}

export type PermissionResult = 'background' | 'foreground' | 'denied';

const BG_ASKED = 'stride:bg-permission-asked';

/**
 * Location permission. Background ("Allow all the time") is only requested when `askBackground` is set
 * (on Start), and only once: on Android 11+ that request opens the system Settings page, which must not
 * happen every time the Record tab is opened.
 */
export async function ensurePermissions(askBackground = false): Promise<PermissionResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  try {
    const cur = await Location.getBackgroundPermissionsAsync();
    if (cur.status === 'granted') return 'background';
    if (askBackground && cur.canAskAgain !== false && !(await AsyncStorage.getItem(BG_ASKED))) {
      await AsyncStorage.setItem(BG_ASKED, '1');
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status === 'granted') return 'background';
    }
  } catch { /* not available (e.g. Expo Go) */ }
  return 'foreground';
}

async function startUpdates(sport: Sport, hasWorkout = false) {
  const opts: Location.LocationOptions = {
    accuracy: settings.gpsMode === 'saver' ? Location.Accuracy.High : Location.Accuracy.BestForNavigation,
    timeInterval: settings.gpsMode === 'saver' ? 3000 : 1000,
    // auto-pause and interval timers need fixes while standing still too
    distanceInterval: settings.autoPause || hasWorkout ? 0 : sport === 'ride' ? 5 : 2,
  };
  const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (bg?.status === 'granted') {
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        ...opts,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        // battery saver: let the OS batch fixes and wake the JS runtime less often
        deferredUpdatesInterval: settings.gpsMode === 'saver' ? 10_000 : 0,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Stride is recording',
          notificationBody: 'Your activity is being tracked.',
          notificationColor: '#F2762E',
        },
      });
      return;
    } catch { /* fall through to foreground watcher */ }
  }
  const w = await Location.watchPositionAsync(opts, (l) => { ingest([l]); });
  watcher?.remove(); // never leave a second watcher running
  watcher = w;
}

async function stopUpdates() {
  watcher?.remove();
  watcher = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch { /* ignore */ }
}

/** Start GPS without recording, so the map can show the current position before Start. */
export async function warmUp(): Promise<Location.LocationSubscription | null> {
  try {
    const l = await Location.getLastKnownPositionAsync();
    if (l) { lastFix = toPoint(l); notify(); }
    return await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 2 },
      (loc) => { lastFix = toPoint(loc); notify(); },
    );
  } catch { return null; }
}

let starting = false;
export async function start(sport: Sport, workoutId?: string | null) {
  if (starting) return; // a double tap must not start (and leak) a second GPS watcher
  starting = true;
  try {
    await refreshSettings();
    const created = await locked(async () => {
      await load();
      if (session) return false; // already recording
      const now = Date.now();
      // seed with the warm-up fix only if it is fresh; an old last-known position would add a phantom jump
      const seed = lastFix && (lastFix.acc ?? 99) <= 35 && now - lastFix.t < 10_000 ? [{ ...lastFix, t: now }] : [];
      persistedPoints = 0; // a new track: every chunk gets written fresh
      session = {
        sport, startedAt: now, status: 'recording', segStartedAt: now, activityId: newActivityId(now),
        pausedMs: 0, pauseStartedAt: null, distanceM: 0, lastCueKm: 0,
        workout: findWorkout(workoutId) ? startProgress(workoutId!, 0, 0) : null,
        segments: [seed],
      };
      await persist();
      return true;
    });
    if (!created) return;
    await startUpdates(sport, !!session?.workout);
    const w = findWorkout(workoutId);
    if (w && session?.workout) say(`${w.name}. ${stepCue(w, session.workout)}`, 'en');
    notify();
  } finally {
    starting = false;
  }
}

export function pause() {
  return locked(async () => {
    if (!session || session.status !== 'recording') return;
    session.status = 'paused';
    session.autoPaused = false;
    session.pauseStartedAt = Date.now();
    await persist();
    notify();
  });
}

export function resume() {
  return locked(async () => {
    if (!session || session.status !== 'paused') return;
    const now = Date.now();
    const pausedFor = Math.max(0, now - (session.pauseStartedAt ?? now));
    session.pausedMs += pausedFor;
    if (session.autoPaused) session.autoPausedMs = (session.autoPausedMs ?? 0) + pausedFor;
    session.pauseStartedAt = null;
    session.status = 'recording';
    session.autoPaused = false;
    session.kf = null;
    session.segments.push([]);
    session.segStartedAt = now;
    await persist();
    notify();
  });
}

export async function discard() {
  Speech.stop();
  await stopUpdates();
  await locked(async () => { session = null; await persist(); });
  notify();
}

/**
 * Save the session as an activity. The session is only cleared once the activity is safely stored: if
 * saving fails, the recording stays (and GPS restarts) so nothing is lost and Save can be tried again.
 */
export async function finish(): Promise<Activity | null> {
  Speech.stop();
  await stopUpdates();
  const gear = session ? await defaultGear(gearKindFor(session.sport)).catch(() => undefined) : undefined;
  let activity: Activity | null;
  try {
    activity = await locked(() => saveSession(gear?.id));
  } catch (e) {
    if (session) await startUpdates(session.sport, !!session.workout).catch(() => undefined);
    notify();
    throw e;
  }
  if (activity) autoSync();
  notify();
  return activity;
}

async function saveSession(gearId: string | undefined): Promise<Activity | null> {
  if (!session) return null;
  const s = session;
  const segments = s.segments.filter((seg) => seg.length > 1);
  const now = Date.now();
  const movingSec = Math.round(sessionMovingSec(s, now));
  const distanceM = totalDistance(segments);
  const a: Activity = {
    id: (s.activityId ??= newActivityId(s.startedAt)), // stable across retries
    name: defaultName(s.sport, s.startedAt),
    sport: s.sport,
    startedAt: s.startedAt,
    movingSec,
    elapsedSec: Math.round((now - s.startedAt) / 1000),
    distanceM,
    elevGainM: Math.round(elevationGain(segments)),
    segments,
    gearId,
    laps: s.laps?.length ? lapsFromMarks(s.laps, distanceM, movingSec) : undefined,
    maxSpeedMs: s.maxSpeedMs,
    workoutName: findWorkout(s.workout?.workoutId)?.name,
  };
  await saveActivity(a);
  session = null;
  await persist();
  return a;
}
