// Writes an AltStore "source" (JSON) for the iPhone build, so AltStore / SideStore can install the app
// and show new versions as updates. Used by .github/workflows/ios.yml.
//
//   node scripts/altstore-source.mjs <Info.json> <path to .ipa> <tag> [release notes] > altstore.json
//
// Info.json is the built app's Info.plist converted to JSON (plutil). The version, build number, bundle
// id, minimum iOS and permission texts are taken from it, because AltStore checks that the source
// matches the .ipa it downloads.
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const [infoPath, ipaPath, tag, notes = ''] = process.argv.slice(2);
if (!infoPath || !ipaPath || !tag) {
  console.error('usage: altstore-source.mjs <Info.json> <ipa> <tag> [notes]');
  process.exit(1);
}
const info = JSON.parse(readFileSync(infoPath, 'utf8'));
const repo = 'lilesh0070/Strava';
const downloadURL = `https://github.com/${repo}/releases/download/${tag}/${basename(ipaPath)}`;
const iconURL = `https://raw.githubusercontent.com/${repo}/main/assets/icon.png`;
const description = 'GPS tracker for runs, walks, rides and hikes: live map, voice updates, interval workouts, '
  + 'history, a workplace Health tab, Instagram story stickers, and a weekly leaderboard with friends.';
// every usage text the app shows when it asks for a permission
const privacy = Object.fromEntries(Object.entries(info).filter(([k, v]) => /^NS.*UsageDescription$/.test(k) && typeof v === 'string'));

const version = {
  version: info.CFBundleShortVersionString,
  buildVersion: String(info.CFBundleVersion),
  date: new Date().toISOString(),
  localizedDescription: notes.trim() || `TBDI FitTrack ${tag}`,
  downloadURL,
  size: statSync(ipaPath).size,
  minOSVersion: info.MinimumOSVersion,
};

const source = {
  name: 'TBDI FitTrack',
  identifier: `${info.CFBundleIdentifier}.source`,
  subtitle: 'GPS run, walk and ride tracker',
  sourceURL: `https://github.com/${repo}/releases/latest/download/altstore.json`,
  iconURL,
  tintColor: 'F2762E',
  apps: [{
    name: info.CFBundleDisplayName || 'TBDI FitTrack',
    bundleIdentifier: info.CFBundleIdentifier,
    developerName: 'lilesh0070',
    subtitle: 'GPS run, walk and ride tracker',
    localizedDescription: description,
    iconURL,
    tintColor: 'F2762E',
    category: 'lifestyle',
    versions: [version],
    appPermissions: { entitlements: [], privacy },
    // fields read by older AltStore versions
    version: version.version,
    versionDate: version.date,
    versionDescription: version.localizedDescription,
    downloadURL,
    size: version.size,
  }],
  news: [],
};
process.stdout.write(JSON.stringify(source, null, 2) + '\n');
