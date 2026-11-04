# Stride

An original GPS activity tracker for Android and iOS, built with React Native and Expo. You can record runs, rides, walks and hikes, see the route on a map, and keep track of your progress.

The UI uses a neumorphic ("soft UI") design in light and dark. Every surface is shaped by a soft highlight and shadow, icons sit in inset wells, and the tab bar floats at the bottom.

## Features

- **Live recording.** Shows time, distance, and pace or speed while you move. You can pause and resume. Recording keeps going with the screen off (Android foreground service / iOS background location).
- **Crash-safe sessions.** The current recording is saved to storage, so if the app is killed it picks up where it left off.
- **GPS cleanup.** Drops low-accuracy fixes, standing-still jitter and impossible jumps.
- **Maps.** Uses Leaflet with OpenStreetMap tiles, so no API key is needed.
- **Feed.** A weekly summary plus activity cards with route previews.
- **Activity detail.** Route map, moving/elapsed time, elevation gain and profile, per-km splits, rename and delete.
- **Voice updates.** Announces time and pace (or speed) at every kilometre.
- **Auto-pause.** Optional. Pauses when you stop moving and resumes when you set off again.
- **Notes, effort and gear.** Add notes and a 1–10 effort rating to any activity, and track the distance on your shoes or bikes.
- **GPX export.** Share any activity as a `.gpx` file (works with other fitness apps and Google Earth).
- **Streak and calendar.** A weekly activity streak plus a month calendar showing your active days.
- **Profile.** An 8-week distance chart with a weekly goal, all-time totals, and running best efforts (1k / 5k / 10k / half).

- **Settings (cog, top-right).** App updates, theme (Auto/Light/Dark), voice, auto-pause, start countdown, GPS accuracy, and backup/restore.
- **In-app updates.**
  - **OTA:** JS changes published with `eas update` download in the background, and a "Restart" button applies them.
  - **New APK:** "Check for updates" reads the latest GitHub Release. If it is newer than the installed version, the APK downloads with a progress bar and the Android installer opens.
- **Feed search and sport filter**, a 3-2-1 start countdown, haptics at every km, and a battery-saver GPS mode.
- **Backup / restore.** Export everything to one JSON file and import it on another phone. Imports merge with existing data and never delete anything.

All data is stored on the device with AsyncStorage.

## Releasing an update

1. Set up once:
   - Run `npx eas-cli@latest init` and `npx eas-cli@latest update:configure` (this links the EAS project and enables OTA).
   - Add an `EXPO_TOKEN` repo secret.
2. **Small JS/UI fix:** run `npx eas-cli@latest update --channel preview -m "what changed"`. Users get it on their next launch.
3. **New native version:** bump `version` (and `android.versionCode`) in `app.json`, commit, then run `git tag v1.2.0 && git push --tags`. The `Release APK` workflow builds the APK on EAS and attaches it to a GitHub Release. The app's **Check for updates** then offers it.

## Run it

```bash
npm install
npx expo start
```

Background location and the WebView map need a **development build**, because Expo Go is not enough:

```bash
npx expo run:android            # local, needs Android SDK
# or build in the cloud:
npx eas-cli@latest build -p android --profile development
```

### Build an installable APK

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

EAS gives you a download link for the `.apk`.

## Project layout

```
src/app/                 Expo Router screens
  (tabs)/index.tsx       Feed
  (tabs)/record.tsx      Recorder
  (tabs)/profile.tsx     Stats, goal, best efforts
  activity/[id].tsx      Activity detail
src/components/          RouteMap (Leaflet WebView), RouteThumb (SVG), charts
src/lib/geo.ts           Distance, splits, elevation, best-effort maths (unit-tested)
src/lib/coach.ts         Voice cues, auto-pause rules, GPX, streaks (unit-tested)
src/lib/tracker.ts       Location task + recording state machine
src/lib/storage.ts       Activity persistence
src/lib/updates.ts       OTA + GitHub-release APK updater
src/lib/theme.tsx        Neumorphic light/dark theme
src/components/Neu.tsx   NeuCard, NeuButton, NeuSwitch, IconWell, NeuTile…
```

## Scripts

- `npm test`: unit tests for the geo maths and coach helpers
- `npm run typecheck`

## Roadmap ideas

Cloud sync and login (Firebase/Supabase), followers and kudos, segments and leaderboards, GPX import, heart-rate sensors over BLE.
