// GPS recording engine. Uses a background location task when "Always" permission is granted
// (keeps recording with the screen off via an Android foreground service), and falls back to a
// foreground watcher otherwise. Session state is persisted so a killed app can resume.
//
// Precision: full GNSS every second with no distance filter (so the live position and the ±m chip
// never go stale), a constant-velocity Kalman filter fed with GPS Doppler speed + course, outlier
// rejection, a stale-fix guard and a stationary gate. A watchdog restarts GPS if fixes stop arriving.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Pedometer } from 'expo-sensors';
import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { AUTO_RESUME_DIST_M, kmCue, shouldAutoPause } from './coach';
import { acceptPoint, elevationGain, haversine, totalDistance, type Point } from './geo';
import { advance, findWorkout, startProgress, stepCue } from './workouts';
import { STOPPED_MS, kalmanStep, lapsFromMarks, paceAdvice, processNoise, rollingSpeed, type GpsFix, type KalmanState } from './live';
import { autoSync } from './githubSync';
import { kmCueHi, speechLanguage, voicePhrases } from './strings';
import { readBlob, removeBlob, writeBlob } from './blobStore';
import { isOnFoot, stepDelta } from './steps';
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
/** Wall-clock time the last fix arrived (fix timestamps come from the GPS clock and may be skewed). */
let lastFixAt = 0;
/** How old the last fix already was when it arrived (a cached "last location" can be minutes old). */
let lastFixAge = Infinity;
/** Pre-start smoothing, handed to the session on Start so the filter is already settled. */
let warmKf: KalmanState | null = null;
let settings: Settings = { ...DEFAULT_SETTINGS };
/** Speak in the app language (Hindi voice when Hindi is selected). */
const say = (text: string, lang = settings.language) => Speech.speak(text, { language: speechLanguage(lang) });

/**
 * iOS: by default speech uses an "ambient" audio session, which the Silent switch mutes and which can't
 * play while the phone is locked. During a recording use a playback session that keeps going in the
 * background (with the "audio" background mode) and mixes with the user's music instead of stopping it.
 */
function prepareSpeechAudio() {
  if (Platform.OS !== 'ios') return;
  setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
}
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
  syncWarm(); // pre-start GPS only runs while the app is on screen
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
export const getLastFixAt = () => lastFixAt;

// The live recording is kept in a file (a long ride's GPS points outgrow AsyncStorage's per-value
// limit on Android); older versions kept it in AsyncStorage, which is still read once after an update.
const SESSION_BLOB = 'session';
let keepUnreadable = false; // a stored session we couldn't read: leave it until a new one replaces it
async function load() {
  if (loaded) return;
  const raw = (await readBlob(SESSION_BLOB).catch(() => null)) ?? (await AsyncStorage.getItem(SESSION_KEY).catch(() => null));
  try {
    session = raw ? JSON.parse(raw) : null;
  } catch {
    // corrupt: don't fail every later start/ingest, and don't delete it either
    session = null;
    keepUnreadable = true;
  }
  loaded = true;
}
async function persist() {
  lastPersistAt = Date.now();
  if (session) { await writeBlob(SESSION_BLOB, JSON.stringify(session)); keepUnreadable = false; }
  else if (!keepUnreadable) { await removeBlob(SESSION_BLOB); await AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined); }
}
/** Writing the whole session every second is the biggest CPU/battery cost after GPS; throttle it. */
async function persistSoon() {
  if (Date.now() - lastPersistAt >= PERSIST_EVERY_MS) await persist();
}

const r = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const DAY_MS = 86_400_000;
function toFix(l: Location.LocationObject): GpsFix {
  const c = l.coords;
  // A few Android chips report GPS-week-rollover timestamps years off; fall back to the phone clock.
  const t = Math.abs(l.timestamp - Date.now()) > DAY_MS ? Date.now() : l.timestamp;
  return {
    lat: c.latitude, lng: c.longitude,
    alt: c.altitude == null ? null : r(c.altitude, 1),
    acc: c.accuracy == null ? null : r(c.accuracy, 1),
    t, spd: c.speed, hdg: c.heading,
  };
}
/** What gets stored: ~10 cm precision is plenty and keeps activities small. */
const toPoint = (f: Pick<Point, 'lat' | 'lng' | 'alt' | 'acc' | 't'>): Point => ({
  lat: r(f.lat, 6), lng: r(f.lng, 6), alt: f.alt, acc: f.acc == null ? null : Math.round(f.acc), t: f.t,
});

// ---------- stale-fix guard ----------
// Android hands over its cached "last location" when updates (re)start or when a broadcast has no
// fresh result. Such a fix can be minutes old and far away, and as the first point of a segment it
// would add a phantom jump. Lag = arrival time − fix time; the smallest recent lag is the clock skew
// between the GPS and phone clocks, so a skewed clock never makes every fix look stale.
const lags: number[] = [];
function staleness(f: GpsFix): number {
  lags.push(Date.now() - f.t);
  if (lags.length > 30) lags.shift();
  return Date.now() - f.t - Math.min(...lags);
}
const STALE_MS = 30_000; // cached fixes are minutes old; background batches are at most ~15 s old
const accOk = (f: { acc: number | null }, max: number) => f.acc != null && f.acc <= max;

export function ingest(locations: Location.LocationObject[]) {
  return locked(async () => {
    await load();
    const statusBefore = session?.status;
    const fixes = locations.map(toFix).sort((a, b) => a.t - b.t);
    for (const f of fixes) {
      lastFixAt = Date.now();
      const age = staleness(f);
      lastFixAge = age;
      if (lastFix && f.t <= lastFix.t) continue; // duplicate or out-of-order delivery
      const p = toPoint(f);
      lastFix = p;
      if (!session) continue;
      const s = session;
      const seg = s.segments[s.segments.length - 1];
      const last = seg[seg.length - 1] ?? s.segments.flat().at(-1);

      if (s.status === 'paused') {
        // auto-resume once the athlete clearly moves away from where they stopped
        if (s.autoPaused && last && age <= STALE_MS && accOk(p, 25) && haversine(last, p) >= AUTO_RESUME_DIST_M) {
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
        stepWorkout(s, p.t); // a standing (auto-paused) rest still counts down
        continue;
      }

      // a cached fix from before this segment must not become its first point
      if (!seg.length && age > STALE_MS) continue;

      // smooth good-quality fixes before deciding whether to keep them
      let q = p;
      let ok = true;
      if (accOk(f, 35)) {
        const kf = kalmanStep(s.kf, f, processNoise(s.sport));
        s.kf = kf;
        if (kf.outlier) ok = false; // multipath jump: ignore it
        else {
          q = toPoint({ ...f, lat: kf.lat, lng: kf.lng });
          lastFix = q; // the live dot follows the smoothed track, the chip keeps the raw accuracy
          // standing still (Doppler says so): don't let leftover jitter creep into the distance
          if (seg.length && Math.hypot(kf.ve, kf.vn) < STOPPED_MS) ok = false;
        }
      }
      if (ok && acceptPoint(seg[seg.length - 1], q, s.sport === 'ride' ? 45 : 12)) {
        const prev = seg[seg.length - 1];
        if (prev) s.distanceM = (s.distanceM ?? 0) + haversine(prev, q);
        // filtered Doppler speed: no spikes from a single noisy fix
        if (s.kf && s.kf.n > 5) s.maxSpeedMs = Math.max(s.maxSpeedMs ?? 0, s.kf.vs);
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
      } else {
        // Idle since the last kept point, or since this segment began. Never measured from a point
        // before the last resume, or a manual pause would be subtracted a second time.
        const kept = seg[seg.length - 1];
        const idleSince = kept?.t ?? s.segStartedAt ?? (s.segments.length === 1 ? s.startedAt : p.t);
        if (settings.autoPause && shouldAutoPause(idleSince, p.t) && (s.distanceM ?? 0) > 0) {
          s.status = 'paused';
          s.autoPaused = true;
          s.pauseStartedAt = idleSince;
          if (settings.voiceCues) say(phrase().paused);
        }
      }
      stepWorkout(s, p.t); // time-based interval steps: checked on every fix, kept or not
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

/** Live speed (m/s): the filtered GPS Doppler speed, or the last 30 s of track when that is unavailable. */
export function currentSpeed(): number | null {
  if (!session || session.status !== 'recording') return null;
  const kf = session.kf;
  if (kf && typeof kf.vs === 'number' && kf.n > 2 && Date.now() - lastFixAt < 5_000) return kf.vs < STOPPED_MS ? null : kf.vs;
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

// ---------- steps ----------
// The phone's hardware step counter (almost no battery). Its readings are a running total since we
// subscribed; only the increase while recording is added, so paused time doesn't count.
let stepSub: { remove(): void } | null = null;
let stepLast: number | null = null;
async function startSteps() {
  if (stepSub || !session || !isOnFoot(session.sport)) return;
  try {
    if (!(await Pedometer.isAvailableAsync()) || !(await Pedometer.getPermissionsAsync()).granted) return;
    if (!session || stepSub) return;
    session.steps ??= 0;
    stepLast = null;
    stepSub = Pedometer.watchStepCount(({ steps }) => {
      const d = stepDelta(stepLast, steps);
      stepLast = steps;
      if (session && session.status === 'recording' && d > 0) session.steps = (session.steps ?? 0) + d; // shown on the next 1 s tick
    });
  } catch { /* no step sensor: activities fall back to an estimate */ }
}
function stopSteps() { stepSub?.remove(); stepSub = null; stepLast = null; }
export const currentSteps = () => session?.steps;

/** Ask once for the "Physical activity" permission the step counter needs (Android 10+). */
export async function ensureStepPermission(): Promise<boolean> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return false;
    const p = await Pedometer.getPermissionsAsync();
    if (p.granted) return true;
    return p.canAskAgain ? (await Pedometer.requestPermissionsAsync()).granted : false;
  } catch { return false; }
}

export async function restore(): Promise<Session | null> {
  await locked(load);
  if (session && !lastFixAt) lastFixAt = Date.now(); // give GPS a moment before the watchdog judges it
  if (session && !(await isTracking())) { lastFixAt = Date.now(); await startUpdates(); }
  if (session) { startSteps(); prepareSpeechAudio(); }
  syncWarm();
  notify();
  return session;
}

// ---------- watchdog ----------
// Some Android builds silently stop delivering fixes (provider hiccup, OEM battery killers). Called every
// second by the Record screen: if a recording has had no fix for 20 s, GPS is restarted.
let restartedAt = 0;
let restarting = false;
export async function watchdog() {
  if (!session || !appActive || restarting) return;
  const now = Date.now();
  if (now - lastFixAt < 20_000 || now - restartedAt < 45_000) return;
  restarting = true;
  restartedAt = now;
  try {
    await stopUpdates();
    if (session) await startUpdates();
  } catch { /* try again on the next tick */ } finally { restarting = false; }
}

async function isTracking() {
  if (watcher) return true;
  try { return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK); } catch { return false; }
}

export type PermissionResult = 'background' | 'foreground' | 'denied';
export type Precision = 'precise' | 'approximate' | 'off';

/** Whether the OS will hand over GNSS-grade fixes: location on, and precise (not approximate) access. */
export async function locationPrecision(): Promise<Precision> {
  try { if (!(await Location.hasServicesEnabledAsync())) return 'off'; } catch { /* unknown: assume on */ }
  const p = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (p?.granted && (p.android?.accuracy === 'coarse' || p.ios?.accuracy === 'reduced')) return 'approximate';
  return 'precise';
}

/**
 * Ask the OS for its best location mode. Android can fix both cases in-app: the permission dialog
 * offers "Change to precise location", and the Play-services dialog turns on location with Google
 * Location Accuracy. iOS can only be changed in Settings, so the caller offers that.
 */
export async function improvePrecision(): Promise<Precision> {
  const now = await locationPrecision();
  if (now === 'precise' || Platform.OS !== 'android') return now;
  if (now === 'approximate') await Location.requestForegroundPermissionsAsync().catch(() => null);
  else await Location.enableNetworkProviderAsync().catch(() => undefined);
  return locationPrecision();
}

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

async function startUpdates() {
  const opts: Location.LocationOptions = {
    // Highest = GNSS at full rate on Android (same as BestForNavigation there) and kCLLocationAccuracyBest
    // on iOS; Apple reserves BestForNavigation for plugged-in navigation apps because of its extra sensor cost.
    accuracy: settings.gpsMode === 'saver' ? Location.Accuracy.High : Location.Accuracy.Highest,
    timeInterval: settings.gpsMode === 'saver' ? 3000 : 1000,
    // No distance filter: a fix every interval even when standing still, so the live position and
    // accuracy stay current (a distance filter makes the OS go quiet and the app thinks GPS is lost).
    // Jitter is removed by the Kalman filter and the stationary gate instead.
    distanceInterval: 0,
    mayShowUserSettingsDialog: true, // Android: offer to turn on high-accuracy location if it is off
  };
  const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (bg?.status === 'granted') {
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        ...opts,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        // Background only (both platforms deliver immediately while the app is on screen): fixes are still
        // taken every second, but handed to JS in batches, so the phone wakes the app every 5 s (15 s in
        // battery saver) instead of every second. Distance and route are identical.
        deferredUpdatesInterval: settings.gpsMode === 'saver' ? 15_000 : 5_000,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'TBDI FitTrack is recording',
          notificationBody: 'Your activity is being tracked.',
          notificationColor: '#F2762E',
        },
      });
      return;
    } catch { /* fall through to foreground watcher */ }
  }
  const w = await Location.watchPositionAsync(opts, (l) => { ingest([l]); }, () => {
    restartedAt = 0; lastFixAt = 0; // let the watchdog restart it on the next tick
  });
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

// ---------- pre-start GPS ("warm-up") ----------
// Runs only while the Record tab is visible, the app is in the foreground and nothing is recording,
// so GPS never stays on behind the user's back (screen off, other app, or after Start, when the
// recording's own location updates take over).
let warmWanted = false;
let warmSub: Location.LocationSubscription | null = null;
let warmBusy = false;
let warmAgain = false;
export function setWarmUp(on: boolean) { warmWanted = on; syncWarm(); }
async function syncWarm() {
  if (warmBusy) { warmAgain = true; return; }
  warmBusy = true;
  try {
    do {
      warmAgain = false;
      const want = warmWanted && appActive && !session;
      if (want && !warmSub) warmSub = await warmUp();
      else if (!want && warmSub) { warmSub.remove(); warmSub = null; }
    } while (warmAgain);
  } finally { warmBusy = false; }
}

/**
 * Start GPS without recording, so the map shows the current position and the GPS chip a live
 * accuracy before Start. Runs the same filter as a recording, so Start begins with a settled fix.
 */
async function warmUp(): Promise<Location.LocationSubscription | null> {
  const onFix = (loc: Location.LocationObject) => {
    if (session) return; // a running session ingests these itself
    const f = toFix(loc);
    lastFixAt = Date.now();
    lastFixAge = staleness(f);
    if (lastFix && f.t <= lastFix.t) return;
    lastFix = toPoint(f);
    if (accOk(f, 35)) {
      warmKf = kalmanStep(warmKf, f, 1);
      if (!warmKf.outlier) lastFix = toPoint({ ...f, lat: warmKf.lat, lng: warmKf.lng });
    }
    notify();
  };
  try {
    // only a recent cached fix: an old one would put the dot somewhere you no longer are
    const l = await Location.getLastKnownPositionAsync({ maxAge: 15_000, requiredAccuracy: 50 }).catch(() => null);
    if (l && !session) { lastFix = toPoint(toFix(l)); notify(); }
    return await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Highest, timeInterval: 1000, distanceInterval: 0, mayShowUserSettingsDialog: true },
      onFix,
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
      // begin exactly where you stand, but only from a fresh, accurate fix
      // (arrived in the last 3 s and is itself recent: not an old cached fix handed over when GPS started;
      // the very first fix can't be judged by the clock-skew estimate, so its own time is checked too)
      const fresh = lastFix && now - lastFixAt <= 3_000 && lastFixAge <= 10_000 && Math.abs(now - lastFix.t) <= 30_000
        && accOk(lastFix, 20) ? lastFix : null;
      const kf = fresh && warmKf && warmKf.t === fresh.t ? { ...warmKf, rej: 0, outlier: false } : null;
      session = {
        sport, startedAt: now, status: 'recording', segStartedAt: now, activityId: newActivityId(now),
        pausedMs: 0, pauseStartedAt: null, distanceM: 0, lastCueKm: 0,
        workout: findWorkout(workoutId) ? startProgress(workoutId!, 0, 0) : null,
        segments: [fresh ? [fresh] : []],
        kf,
      };
      await persist();
      return true;
    });
    if (!created) return;
    prepareSpeechAudio();
    lastFixAt = Date.now();
    restartedAt = Date.now();
    await startUpdates();
    startSteps();
    syncWarm(); // the recording's own updates take over from the pre-start GPS
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
  stopSteps();
  await stopUpdates();
  await locked(async () => { session = null; await persist(); });
  syncWarm();
  notify();
}

export async function finish(): Promise<Activity | null> {
  Speech.stop();
  stopSteps();
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
      id: (s.activityId ??= newActivityId(s.startedAt)), // stable across retries: a retried save overwrites
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
      steps: isOnFoot(s.sport) && s.steps ? s.steps : undefined,
    };
    // Save first, clear the recording only once the activity is safely stored. If saving fails
    // the recording stays (paused) so nothing is lost and Save can simply be tried again.
    try {
      await saveActivity(a);
    } catch (e) {
      if (s.status === 'recording') { s.status = 'paused'; s.autoPaused = false; s.pauseStartedAt = now; }
      await persist().catch(() => undefined);
      throw e;
    }
    session = null;
    await persist();
    return a;
  });
  if (activity) autoSync();
  syncWarm();
  notify();
  return activity;
}
