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
import { defaultGear, getSettings, saveActivity } from './storage';
import {
  DEFAULT_SETTINGS, defaultName, gearKindFor, sessionMovingSec, sportInfo,
  type Activity, type Session, type Settings, type Sport,
} from './types';

export const LOCATION_TASK = 'stride-location-task';
const SESSION_KEY = 'stride:session';

let session: Session | null = null;
let loaded = false;
let watcher: Location.LocationSubscription | null = null;
let lastFix: Point | null = null;
let settings: Settings = { ...DEFAULT_SETTINGS };
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
  else persist().catch(() => undefined); // make sure nothing is lost if the OS kills us
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

async function load() {
  if (loaded) return;
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  session = raw ? JSON.parse(raw) : null;
  loaded = true;
}
async function persist() {
  lastPersistAt = Date.now();
  if (session) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else await AsyncStorage.removeItem(SESSION_KEY);
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
      const s = session;
      const seg = s.segments[s.segments.length - 1];
      const last = seg[seg.length - 1] ?? s.segments.flat().at(-1);

      if (s.status === 'paused') {
        // auto-resume once the athlete clearly moves away from where they stopped
        if (s.autoPaused && last && (p.acc ?? 99) <= 35 && haversine(last, p) >= AUTO_RESUME_DIST_M) {
          s.pausedMs += p.t - (s.pauseStartedAt ?? p.t);
          s.pauseStartedAt = null;
          s.status = 'recording';
          s.autoPaused = false;
          s.segments.push([p]);
          s.kf = null;
          if (settings.voiceCues) Speech.speak('Resumed');
        }
        continue;
      }

      // smooth good-quality fixes before deciding whether to keep them
      let q = p;
      if ((p.acc ?? 99) <= 35) {
        s.kf = kalmanStep(s.kf, p, expectedSpeed(s.sport));
        q = { ...p, lat: s.kf.lat, lng: s.kf.lng };
      }
      if (acceptPoint(seg[seg.length - 1], q, s.sport === 'ride' ? 45 : 12)) {
        const prev = seg[seg.length - 1];
        if (prev) {
          const d = haversine(prev, q);
          s.distanceM = (s.distanceM ?? 0) + d;
          const v = d / Math.max(1, (q.t - prev.t) / 1000);
          if (seg.length > 3) s.maxSpeedMs = Math.max(s.maxSpeedMs ?? 0, v);
        }
        seg.push(q);
        coachPace(s, seg, q.t);
        stepWorkout(s, q.t);
        const km = Math.floor((s.distanceM ?? 0) / 1000);
        if (km > (s.lastCueKm ?? 0)) {
          s.lastCueKm = km;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          if (settings.voiceCues) Speech.speak(kmCue(km, sessionMovingSec(s, p.t), sportInfo(s.sport).usesPace));
        }
      } else if (settings.autoPause && shouldAutoPause(last?.t ?? s.startedAt, p.t) && (s.distanceM ?? 0) > 0) {
        s.status = 'paused';
        s.autoPaused = true;
        s.pauseStartedAt = last?.t ?? p.t;
        if (settings.voiceCues) Speech.speak('Auto paused');
      }
    }
    if (session) await (session.status !== statusBefore ? persist() : persistSoon());
    notify();
  });
}

function coachPace(s: Session, seg: Point[], now: number) {
  const target = settings.targetPaceSec;
  if (!target || !settings.voiceCues || !sportInfo(s.sport).usesPace) return;
  if (now - (s.lastPaceAlertAt ?? s.startedAt) < 90_000) return; // at most every 90 s
  const v = rollingSpeed(seg, 60);
  const advice = paceAdvice(v ? 1000 / v : null, target);
  if (!advice) return;
  s.lastPaceAlertAt = now;
  Speech.speak(advice === 'faster' ? 'Pick up the pace' : 'Ease off a little, you are ahead of target');
}

function stepWorkout(s: Session, now: number) {
  const w = findWorkout(s.workout?.workoutId);
  if (!w || !s.workout || s.status !== 'recording') return false;
  const r = advance(w, s.workout, s.distanceM ?? 0, sessionMovingSec(s, now));
  if (!r.changed) return false;
  s.workout = r.p;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  Speech.speak(stepCue(w, r.p)); // workout cues always speak: they are the point of the feature
  return true;
}

/** Time-based interval steps also need checking when no new GPS fix arrives (e.g. standing rest). */
export function workoutTick() {
  return locked(async () => {
    if (session && stepWorkout(session, Date.now())) { await persist(); notify(); }
  });
}

/** Current pace/speed from the last 30 s of movement (m/s). */
export function currentSpeed(): number | null {
  if (!session || session.status !== 'recording') return null;
  return rollingSpeed(session.segments[session.segments.length - 1], 30);
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
      Speech.speak(`Lap ${session.laps.length}. ${(d / 1000).toFixed(2)} kilometres in ${Math.floor(t / 60)} minutes ${Math.round(t % 60)} seconds.`);
    }
    notify();
  });
}

// Must be defined at module scope so it is registered when the JS runtime boots in the background.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations) return;
  await ingest(data.locations);
});

export async function restore(): Promise<Session | null> {
  await locked(load);
  if (session && !(await isTracking())) await startUpdates(session.sport);
  notify();
  return session;
}

async function isTracking() {
  if (watcher) return true;
  try { return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK); } catch { return false; }
}

export type PermissionResult = 'background' | 'foreground' | 'denied';

export async function ensurePermissions(): Promise<PermissionResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status === 'granted') return 'background';
  } catch { /* not available (e.g. Expo Go) */ }
  return 'foreground';
}

async function startUpdates(sport: Sport) {
  const opts: Location.LocationOptions = {
    accuracy: settings.gpsMode === 'saver' ? Location.Accuracy.High : Location.Accuracy.BestForNavigation,
    timeInterval: settings.gpsMode === 'saver' ? 3000 : 1000,
    distanceInterval: settings.autoPause ? 0 : sport === 'ride' ? 5 : 2,
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
  watcher = await Location.watchPositionAsync(opts, (l) => { ingest([l]); });
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

export async function start(sport: Sport, workoutId?: string | null) {
  await refreshSettings();
  await locked(async () => {
    await load();
    session = {
      sport, startedAt: Date.now(), status: 'recording',
      pausedMs: 0, pauseStartedAt: null, distanceM: 0, lastCueKm: 0,
      workout: findWorkout(workoutId) ? startProgress(workoutId!, 0, 0) : null,
      segments: [lastFix && (lastFix.acc ?? 99) <= 35 ? [{ ...lastFix, t: Date.now() }] : []],
    };
    await persist();
  });
  await startUpdates(sport);
  const w = findWorkout(workoutId);
  if (w && session?.workout) Speech.speak(`${w.name}. ${stepCue(w, session.workout)}`);
  notify();
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
    session.pausedMs += Date.now() - (session.pauseStartedAt ?? Date.now());
    session.pauseStartedAt = null;
    session.status = 'recording';
    session.autoPaused = false;
    session.kf = null;
    session.segments.push([]);
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

export async function finish(): Promise<Activity | null> {
  Speech.stop();
  await stopUpdates();
  const gear = session ? await defaultGear(gearKindFor(session.sport)).catch(() => undefined) : undefined;
  const activity = await locked(async () => {
    if (!session) return null;
    const s = session;
    const segments = s.segments.filter((seg) => seg.length > 1);
    const now = Date.now();
    const movingSec = Math.round(sessionMovingSec(s, now));
    const distanceM = totalDistance(segments);
    const a: Activity = {
      id: `${s.startedAt.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: defaultName(s.sport, s.startedAt),
      sport: s.sport,
      startedAt: s.startedAt,
      movingSec,
      elapsedSec: Math.round((now - s.startedAt) / 1000),
      distanceM,
      elevGainM: Math.round(elevationGain(segments)),
      segments,
      gearId: gear?.id,
      laps: s.laps?.length ? lapsFromMarks(s.laps, distanceM, movingSec) : undefined,
      maxSpeedMs: s.maxSpeedMs,
      workoutName: findWorkout(s.workout?.workoutId)?.name,
    };
    session = null;
    await persist();
    return a;
  });
  if (activity) { await saveActivity(activity); autoSync(); }
  notify();
  return activity;
}
