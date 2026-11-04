// Optional daily nudge, scheduled locally (no server, works offline).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
