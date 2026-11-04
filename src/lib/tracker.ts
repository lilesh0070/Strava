// GPS recording engine. Uses a background location task when "Always" permission is granted
// (keeps recording with the screen off via an Android foreground service), and falls back to a
// foreground watcher otherwise. Session state is persisted so a killed app can resume.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { acceptPoint, elevationGain, totalDistance, type Point } from './geo';
import { defaultName, sessionMovingSec, type Activity, type Session, type Sport } from './types';
import { saveActivity } from './storage';

export const LOCATION_TASK = 'stride-location-task';
const SESSION_KEY = 'stride:session';

let session: Session | null = null;
let loaded = false;
let watcher: Location.LocationSubscription | null = null;
let lastFix: Point | null = null;
const listeners = new Set<() => void>();

// Serialise all mutations so the background task and UI never clobber each other.
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

function notify() { listeners.forEach((l) => l()); }
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
  if (session) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else await AsyncStorage.removeItem(SESSION_KEY);
}

function toPoint(l: Location.LocationObject): Point {
  return {
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    alt: l.coords.altitude ?? null,
    acc: l.coords.accuracy ?? null,
    t: l.timestamp,
  };
}

export function ingest(locations: Location.LocationObject[]) {
  return locked(async () => {
    await load();
    for (const l of locations) {
      const p = toPoint(l);
      lastFix = p;
      if (!session || session.status !== 'recording') continue;
      const seg = session.segments[session.segments.length - 1];
      if (acceptPoint(seg[seg.length - 1], p, session.sport === 'ride' ? 45 : 12)) seg.push(p);
    }
    if (session) await persist();
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
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: sport === 'ride' ? 5 : 2,
  };
  const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (bg?.status === 'granted') {
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        ...opts,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Stride is recording',
          notificationBody: 'Your activity is being tracked.',
          notificationColor: '#C6F432',
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

export async function start(sport: Sport) {
  await locked(async () => {
    await load();
    session = {
      sport, startedAt: Date.now(), status: 'recording',
      pausedMs: 0, pauseStartedAt: null, segments: [lastFix && (lastFix.acc ?? 99) <= 35 ? [{ ...lastFix, t: Date.now() }] : []],
    };
    await persist();
  });
  await startUpdates(sport);
  notify();
}

export function pause() {
  return locked(async () => {
    if (!session || session.status !== 'recording') return;
    session.status = 'paused';
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
    session.segments.push([]);
    await persist();
    notify();
  });
}

export async function discard() {
  await stopUpdates();
  await locked(async () => { session = null; await persist(); });
  notify();
}

export async function finish(): Promise<Activity | null> {
  await stopUpdates();
  const activity = await locked(async () => {
    if (!session) return null;
    const s = session;
    const segments = s.segments.filter((seg) => seg.length > 1);
    const now = Date.now();
    const a: Activity = {
      id: `${s.startedAt.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: defaultName(s.sport, s.startedAt),
      sport: s.sport,
      startedAt: s.startedAt,
      movingSec: Math.round(sessionMovingSec(s, now)),
      elapsedSec: Math.round((now - s.startedAt) / 1000),
      distanceM: totalDistance(segments),
      elevGainM: Math.round(elevationGain(segments)),
      segments,
    };
    session = null;
    await persist();
    return a;
  });
  if (activity) await saveActivity(activity);
  notify();
  return activity;
}
