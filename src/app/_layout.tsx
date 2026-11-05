import { startFriendsSync } from '../lib/friendsApp';
import { restore } from '../lib/tracker'; // the background task itself is defined from index.js, before any route loads
import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, Share } from 'react-native';
import CrashScreen, { ScreenCrash } from '../components/CrashScreen';
import { crashLogText, takeUnseenCrash } from '../lib/crashHandler';
import { getSettings } from '../lib/storage';
import { translate, type Key } from '../lib/strings';
import { showToast } from '../lib/toast';
import { ensureReminders } from '../lib/reminders';
import ToastHost from '../components/ToastHost';
import CelebrationOverlay from '../components/CelebrationOverlay';
import UpdateBanner from '../components/UpdateBanner';
import { I18nProvider, useT } from '../lib/i18n';
import { ThemeProvider, useTheme } from '../lib/theme';

// Show break reminders even while the app is open (quietly: no sound on top of a banner). The live
// recording stats refresh every few seconds and only belong in the shade, never as a banner.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => ({
      shouldShowBanner: n.request.content.data?.live !== true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
    }),
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

/** After the app closed on an uncaught error, say so once at the next launch and offer to send the log. */
function useCrashNotice() {
  useEffect(() => {
    if (__DEV__) return; // development shows the red box instead of closing
    const id = setTimeout(() => {
      const crash = takeUnseenCrash();
      if (!crash) return;
      getSettings().catch(() => null).then((s) => {
        const t = (k: Key) => translate(s?.language ?? 'en', k);
        showToast(t('crash.closed'), { label: t('crash.send'), run: () => { Share.share({ message: crashLogText() }).catch(() => undefined); } }, 10000);
      });
    }, 2500); // after the first screen (and the onboarding redirect) has settled
    return () => clearTimeout(id);
  }, []);
}

function Root() {
  const { C } = useTheme();
  const { t } = useT();
  // pick up a recording the OS interrupted and restart its GPS right away, not when Record is first opened
  useEffect(() => { restore().catch(() => undefined); }, []);
  useEffect(() => { startFriendsSync(); }, []);
  useCrashNotice();
  return (
    <>
      {Platform.OS !== 'web' && <NotificationLinks />}
      <StatusBar style={C.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        // a screen that fails to render shows the crash screen in its place: the tab bar, the back
        // button, Settings and the update banner keep working around it
        unstable_screenErrorBoundary={ScreenCrash}
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerShadowVisible: false,
          headerTintColor: C.text,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="activity/[id]" options={{ title: t('hdr.activity') }} />
        <Stack.Screen name="settings" options={{ title: t('hdr.settings') }} />
        <Stack.Screen name="add-activity" options={{ title: t('hdr.add'), presentation: 'modal' }} />
        <Stack.Screen name="heatmap" options={{ title: t('hdr.heatmap') }} />
        <Stack.Screen name="achievements" options={{ title: t('hdr.achievements') }} />
        <Stack.Screen name="workouts" options={{ title: t('hdr.workouts') }} />
        <Stack.Screen name="friends" options={{ title: t('hdr.friends') }} />
        <Stack.Screen name="break" options={{ title: '' }} />
        <Stack.Screen name="share/[id]" options={{ title: t('hdr.share') }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
      <UpdateBanner />
      <ToastHost />
      <CelebrationOverlay />
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

/** Last resort if the root layout itself fails to render (a screen's crash is caught by the Stack above), instead of a white screen. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <CrashScreen error={error} retry={retry} />;
}
