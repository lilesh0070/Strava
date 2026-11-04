// Expo config plugin: sign release builds with a keystore supplied through environment variables
// (set from GitHub Actions secrets). Without them the build falls back to the template's fixed
// debug keystore, which is still the same on every build so in-app updates keep installing.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// stride-release-signing';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes(MARK)) return cfg;
    g = g.replace(
      /signingConfigs\s*\{/,
      `signingConfigs {
        ${MARK}
        release {
            def ks = System.getenv('STRIDE_KEYSTORE_FILE')
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv('STRIDE_KEYSTORE_PASSWORD')
                keyAlias System.getenv('STRIDE_KEY_ALIAS')
                keyPassword System.getenv('STRIDE_KEY_PASSWORD')
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`,
    );
    // point the release build type at the release signing config
    g = g.replace(/(release\s*\{[^{}]*?)signingConfig\s+signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
    cfg.modResults.contents = g;
    return cfg;
  });
};
