// Optional daily nudge, scheduled locally (no server, works offline).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { BREAK_MESSAGES, breakSlots } from './breaks';
import { getSettings } from './storage';
import type { Settings } from './types';

const ID = 'stride-daily-reminder';

export async function setDailyReminder(enabled: boolean, hour: number): Promise<boolean> {
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
  if (!enabled) return true;
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Workout reminders', importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: { title: 'Time to move 🏃', body: 'A short run or walk keeps your streak alive.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: 'reminders' },
  });
  return true;
}

// ---------- workday break reminders ----------
const BREAK_PREFIX = 'tbdi-break-';

/** (Re)schedule the weekly break nudges for the current settings. Returns false if notifications are blocked. */
let chain: Promise<unknown> = Promise.resolve();
export function setBreakReminders(s: Settings): Promise<boolean> {
  // serialised: quick taps in Settings must not interleave a cancel with an older schedule
  const run = chain.then(() => scheduleBreaks(s), () => scheduleBreaks(s));
  chain = run.catch(() => undefined);
  return run;
}

async function scheduleBreaks(s: Settings): Promise<boolean> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(scheduled.filter((n) => n.identifier.startsWith(BREAK_PREFIX))
    .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined)));
  if (!s.breakReminders) return true;
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('wellness', {
      name: 'Workday break reminders', importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  // iOS keeps at most 64 pending notifications; leave room for the daily reminder
  const slots = breakSlots({ everyMin: s.breakEveryMin, startH: s.workStartH, endH: s.workEndH, days: s.workDays },
    Platform.OS === 'ios' ? 60 : 200);
  for (const sl of slots) {
    const msg = BREAK_MESSAGES[sl.kind];
    await Notifications.scheduleNotificationAsync({
      identifier: `${BREAK_PREFIX}${sl.weekday}-${sl.hour}-${sl.minute}`,
      content: { title: msg.title[s.language], body: msg.body[s.language], data: { url: msg.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: sl.weekday, hour: sl.hour, minute: sl.minute, channelId: 'wellness' },
    });
  }
  return true;
}

/**
 * Startup check: if reminders are on but the OS lost them (some phones drop alarms after an app
 * update, a reboot or a battery "clean-up"), schedule them again. Never shows a permission prompt.
 */
export async function ensureReminders(): Promise<void> {
  const s = await getSettings();
  if (!s.breakReminders && !s.reminder) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  const ids = (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier);
  if (s.breakReminders && !ids.some((id) => id.startsWith(BREAK_PREFIX))) await setBreakReminders(s);
  if (s.reminder && !ids.includes(ID)) await setDailyReminder(true, s.reminderHour);
}
