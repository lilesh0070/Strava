// Node loader for running src/lib/tracker.ts outside React Native: native Expo modules are replaced by the
// small stubs in ./stubs (GPS fixes are injected by the tests), and extensionless relative imports resolve.
//   npm run test:tracker   end-to-end tests of the recording engine (tracker.test.ts)
//   npm run sim:gps        distance accuracy of the real tracker over synthetic routes (gps-sim.ts)
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
const stubs = new URL('./stubs/', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`
const S = ${JSON.stringify(stubs)};
const map = { '@react-native-async-storage/async-storage': 'async-storage.mjs', 'expo-location': 'location.mjs',
  'expo-task-manager': 'misc.mjs', 'expo-haptics': 'misc.mjs', 'expo-speech': 'misc.mjs', 'expo-secure-store': 'misc.mjs',
  'expo-document-picker': 'misc.mjs', 'expo-file-system': 'fs.mjs', 'expo-sensors': 'sensors.mjs', 'expo-audio': 'misc.mjs',
  'expo-sharing': 'misc.mjs', 'expo-notifications': 'notifications.mjs', 'react-native': 'misc.mjs' };
export async function resolve(spec, ctx, next) {
  if (map[spec]) return { url: S + map[spec], shortCircuit: true };
  try { return await next(spec, ctx); }
  catch (e) { if (spec.startsWith('.') && !/\\.[cm]?[jt]sx?$/.test(spec)) return next(spec + '.ts', ctx); throw e; }
}`));
export const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
