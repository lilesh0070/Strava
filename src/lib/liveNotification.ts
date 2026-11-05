// Android: live distance, time and pace in a silent, ongoing notification while recording, so the
// numbers are on the lock screen and in the shade without opening the app. (expo-location's own
// foreground-service notification can't change its text once started, so this one sits next to it.)
// iOS has no equivalent without a paid Live Activity entitlement; nothing is shown there.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { liveSummary, liveTitle } from './liveText';
import type { Lang } from './strings';
import type { Session } from './types';

const ID = 'live-stats';
const CHANNEL = 'live';
let channelReady: Promise<void> | null = null;
let lastShownAt = 0;
let lastText = '';
let shown = false;
export const LIVE_NOTIFICATION_EVERY_MS = 10_000;

async function ensureChannel() {
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Live activity stats',
    // eslint-plugin-import can't see these enums through the package's compiled `export *`; tsc resolves them
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.LOW, // no sound, no pop-up, no vibration
    sound: null,
    enableVibrate: false,
    showBadge: false,
    // eslint-disable-next-line import/namespace
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  }).then(() => undefined).catch(() => { channelReady = null; });
  await channelReady;
}

/** Android 13+ needs the notification permission; asked once, when a recording starts. */
export async function ensureLiveNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (cur.canAskAgain === false) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch { return false; }
}

/** Post or refresh the live notification (throttled; call freely). */
export async function updateLiveNotification(s: Session, movingSec: number, speedMs: number | null, lang: Lang, force = false) {
  if (Platform.OS !== 'android') return;
  const now = Date.now();
  if (!force && now - lastShownAt < LIVE_NOTIFICATION_EVERY_MS) return;
  const body = liveSummary(s, movingSec, speedMs, lang);
  const title = liveTitle(s, lang);
  if (!force && title + body === lastText) return;
  lastShownAt = now;
  lastText = title + body;
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: ID, // same id: Android replaces the notification in place
      content: {
        title, body,
        sticky: true, // ongoing: can't be swiped away while recording
        autoDismiss: false,
        sound: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
        data: { url: '/record', live: true },
      },
      trigger: { channelId: CHANNEL },
    });
    shown = true;
  } catch { /* notifications off: the app still records */ }
}

/** Remove it (recording finished or discarded, or the feature was turned off). */
export async function clearLiveNotification() {
  if (Platform.OS !== 'android') return;
  lastText = '';
  lastShownAt = 0;
  if (!shown) return;
  shown = false;
  await Notifications.dismissNotificationAsync(ID).catch(() => undefined);
}

/** On launch: a notification left behind by a killed app with no recording to go with it. */
export async function clearStaleLiveNotification() {
  if (Platform.OS !== 'android') return;
  await Notifications.dismissNotificationAsync(ID).catch(() => undefined);
}
