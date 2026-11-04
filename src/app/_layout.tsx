import '../lib/tracker'; // registers the background location task at startup
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import UpdateBanner from '../components/UpdateBanner';
import { ThemeProvider, useTheme } from '../lib/theme';

function Root() {
  const { C } = useTheme();
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
      </Stack>
      <UpdateBanner />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}
