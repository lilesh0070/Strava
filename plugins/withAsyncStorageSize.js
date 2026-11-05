// Expo config plugin: raise the Android AsyncStorage database limit.
// @react-native-async-storage on Android keeps everything in one SQLite database capped at 6 MB by
// default. Stride stores full GPS tracks there (roughly 150-200 KB per hour of recording), so the
// default fills up after about 30 hours of activities, and every save after that fails. The cap is
// read from the root `gradle.properties` (AsyncStorage_db_size_in_MB) when the native project is built.
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'AsyncStorage_db_size_in_MB';

module.exports = function withAsyncStorageSize(config, { sizeMB = 512 } = {}) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === KEY));
    cfg.modResults.push({ type: 'property', key: KEY, value: String(sizeMB) });
    return cfg;
  });
};
