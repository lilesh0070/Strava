import '../lib/tracker'; // registers the background location task at startup
import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import CrashScreen from '../components/CrashScreen';
import { ensureReminders } from '../lib/reminders';
import ToastHost from '../components/ToastHost';
import UpdateBanner from '../components/UpdateBanner';
import { I18nProvider } from '../lib/i18n';
import { ThemeProvider, useTheme } from '../lib/theme';

// Show break reminders even while the app is open (quietly: no sound on top of a banner).
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

/** Tapping a reminder opens the matching screen (e.g. a stretch break), also from a cold start. Native only. */
function NotificationLinks() {
  const last = Notifications.useLastNotificationResponse();
  // a few seconds after launch, so it never competes with the first screen
  useEffect(() => { const id = setTimeout(() => { ensureReminders().catch(() => undefined); }, 4000); return () => clearTimeout(id); }, []);
  useEffect(() => {
    if (!last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const url = last.notification.request.content.data?.url;
    if (typeof url !== 'string' || !url.startsWith('/')) return;
    Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    const id = setTimeout(() => { try { router.push(url as never); } catch { /* navigation not ready */ } }, 0);
    return () => clearTimeout(id);
  }, [last]);
  return null;
}

function Root() {
  const { C } = useTheme();
  return (
    <>
      {Platform.OS !== 'web' && <NotificationLinks />}
      <StatusBar style={C.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerShadowVisible: false,
          headerTintColor: C.text,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="activity/[id]" options={{ title: 'Activity' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="add-activity" options={{ title: 'Add activity', presentation: 'modal' }} />
        <Stack.Screen name="heatmap" options={{ title: 'Your heatmap' }} />
        <Stack.Screen name="achievements" options={{ title: 'Achievements' }} />
        <Stack.Screen name="workouts" options={{ title: 'Interval workouts' }} />
        <Stack.Screen name="break" options={{ title: '' }} />
        <Stack.Screen name="share/[id]" options={{ title: 'Share' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
      <UpdateBanner />
      <ToastHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <Root />
      </I18nProvider>
    </ThemeProvider>
  );
}

/** Last-resort screen if a render crashes, instead of a white screen. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <CrashScreen error={error} retry={retry} />;
}
