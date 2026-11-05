import { AppState } from './misc.mjs';

export const Accuracy = { High: 4, BestForNavigation: 6 }; export const ActivityType = { Fitness: 3 };
// task: the running location task ({ name, opts }) or null; taskFail: an error the next task starts throw
export const __w = { created: 0, removed: 0, cbs: [], task: null, taskStarts: 0, taskStops: 0, taskFail: null };
export async function requestForegroundPermissionsAsync() { return { status: 'granted' }; }
export async function getBackgroundPermissionsAsync() { return { status: 'denied', canAskAgain: true }; }
export async function requestBackgroundPermissionsAsync() { __w.bgAsked = (__w.bgAsked ?? 0) + 1; return { status: 'denied' }; }
export async function hasStartedLocationUpdatesAsync(name) { return __w.task?.name === name; }
export async function stopLocationUpdatesAsync(name) { if (__w.task?.name === name) { __w.task = null; __w.taskStops++; } }
// Like expo-location 58 on Android (LocationModule.kt): with a foregroundService, foreground permission is
// enough, but a start from the background is refused (ForegroundServiceStartNotAllowedException).
export async function startLocationUpdatesAsync(name, opts) {
  await new Promise((r) => setTimeout(r, 5));
  if (__w.taskFail) throw __w.taskFail;
  if (opts?.foregroundService && AppState.currentState !== 'active') throw new Error('ForegroundServiceStartNotAllowedException');
  if (!opts?.foregroundService && (await getBackgroundPermissionsAsync()).status !== 'granted') throw new Error('LocationBackgroundUnauthorizedException');
  __w.task = { name, opts };
  __w.taskStarts++;
}
export async function getLastKnownPositionAsync() { return null; }
export async function watchPositionAsync(_o, cb) { await new Promise((r) => setTimeout(r, 5)); __w.created++; __w.cbs.push(cb); return { remove() { __w.removed++; } }; }
export async function getForegroundPermissionsAsync() { return { granted: true, status: 'granted' }; }
export async function hasServicesEnabledAsync() { return true; }
export async function enableNetworkProviderAsync() {}
