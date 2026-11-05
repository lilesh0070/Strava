export const Accuracy = { High: 4, BestForNavigation: 6 }; export const ActivityType = { Fitness: 3 };
export const __w = { created: 0, removed: 0, cbs: [] };
export async function requestForegroundPermissionsAsync() { return { status: 'granted' }; }
export async function getBackgroundPermissionsAsync() { return { status: 'denied', canAskAgain: true }; }
export async function requestBackgroundPermissionsAsync() { __w.bgAsked = (__w.bgAsked ?? 0) + 1; return { status: 'denied' }; }
export async function hasStartedLocationUpdatesAsync() { return false; }
export async function stopLocationUpdatesAsync() {}
export async function startLocationUpdatesAsync() {}
export async function getLastKnownPositionAsync() { return null; }
export async function watchPositionAsync(_o, cb) { await new Promise((r) => setTimeout(r, 5)); __w.created++; __w.cbs.push(cb); return { remove() { __w.removed++; } }; }
export async function getForegroundPermissionsAsync() { return { granted: true, status: 'granted' }; }
export async function hasServicesEnabledAsync() { return true; }
export async function enableNetworkProviderAsync() {}
