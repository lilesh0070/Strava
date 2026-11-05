// Expo config plugin: sign release builds with a keystore supplied through environment variables
// (STRIDE_KEYSTORE_*). Without them the build uses the template's fixed debug keystore, which is the same on
// every build so in-app updates keep installing. The release workflow deliberately leaves them unset: Gradle
// signs with the debug key and scripts/sign-apk-rotation.sh then adds the release key with v3 key rotation, so
// installed apps move to it in place. Signing directly with another key here is a key change without a
// lineage, which every phone would have to reinstall for; use it only for local experiments.
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
