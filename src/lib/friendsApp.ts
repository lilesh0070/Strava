// Wires the friends feature into the app: Firebase config from app.json, the sign-in kept in the
// secure keystore, and this week's km shared automatically when activities change.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import { mondayOf } from './coach';
import { createFirebase } from './firebase';
import { createFriends, type Friends, type MyStats } from './friends';
import { getProfile, listActivities, onDataChanged } from './storage';

type Config = { apiKey?: string; projectId?: string };
const cfg = (Constants.expoConfig?.extra as { firebase?: Config } | undefined)?.firebase;
/** Friends need a Firebase project in app.json → expo.extra.firebase (see README → Friends & leaderboard). */
export const friendsAvailable = !!(cfg?.apiKey && cfg?.projectId);

const CRED_KEY = 'stride_firebase_session';
const LOCAL_KEY = 'stride:friends';

/** Name and total distance (all sports) since Monday. */
async function myWeek(): Promise<MyStats> {
  const weekStart = mondayOf(Date.now());
  const [acts, profile] = await Promise.all([listActivities(), getProfile()]);
  const m = acts.filter((a) => a.startedAt >= weekStart).reduce((s, a) => s + a.distanceM, 0);
  return { name: profile.name, weekKm: m / 1000, weekStart };
}

export const friends: Friends | null = friendsAvailable
  ? createFriends({
    client: createFirebase({ apiKey: cfg!.apiKey!, projectId: cfg!.projectId! }, {
      get: () => SecureStore.getItemAsync(CRED_KEY),
      set: async (v) => { if (v) await SecureStore.setItemAsync(CRED_KEY, v); else await SecureStore.deleteItemAsync(CRED_KEY); },
    }),
    kv: { get: () => AsyncStorage.getItem(LOCAL_KEY), set: (v) => AsyncStorage.setItem(LOCAL_KEY, v) },
    stats: myWeek,
  })
  : null;

let started = false;
/** Keep the km friends see up to date: after activities change, and when the app comes back (new week). */
export function startFriendsSync() {
  if (!friends || started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { friends.share().catch(() => undefined); }, 3000); // offline: retried next time
  };
  soon();
  onDataChanged(soon);
  AppState.addEventListener('change', (s) => { if (s === 'active') soon(); });
}
