// App entry. The background location task must be defined as soon as the JS bundle starts. When
// Android relaunches the app in the background to deliver location updates, no screen is rendered,
// and Expo Router only loads route files (including app/_layout) when they render. So the recorder is
// loaded here, before the router, instead of from a route. The crash log's global error handler comes
// first, so it also records errors thrown while the recorder loads or runs in the background.
import './src/lib/crashHandler';
import './src/lib/tracker';
import 'expo-router/entry';
