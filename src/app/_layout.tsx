import { restore } from '../lib/tracker'; // the background task itself is defined from index.js, before any route loads
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import CrashScreen from '../components/CrashScreen';
import ToastHost from '../components/ToastHost';
import UpdateBanner from '../components/UpdateBanner';
import { I18nProvider } from '../lib/i18n';
import { ThemeProvider, useTheme } from '../lib/theme';

function Root() {
  const { C } = useTheme();
  // pick up a recording the OS interrupted and restart its GPS right away, not when Record is first opened
  useEffect(() => { restore().catch(() => undefined); }, []);
  return (
    <>
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
