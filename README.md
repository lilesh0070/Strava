# Stride

An original GPS activity tracker for Android and iOS, built with React Native and Expo. You can record runs, rides, walks and hikes, see the route on a map, and keep track of your progress.

The UI uses a neumorphic ("soft UI") design in light and dark. Every surface is shaped by a soft highlight and shadow, icons sit in inset wells, and the tab bar floats at the bottom.


## Download

**[⬇ Download the latest APK](https://github.com/lilesh0070/Strava/releases/latest)** for Android. Open the link, tap `stride-v….apk`, allow "install unknown apps", then tap Install.

Once installed, new versions arrive through **Settings → Check for updates** inside the app.

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
- **Accurate live tracking.**
  - A Kalman filter smooths GPS zig-zag, which otherwise inflates distance by a few percent.
  - Low-accuracy and impossible fixes are dropped.
  - A GPS-quality gate before Start warns if the signal is weak.
  - A live ±m accuracy chip, with "signal lost" detection.
- **Live stats.** Pace now (rolling 30 s), average pace, the current lap, a lap button with voice summaries, and max speed.
- **Pace coach.** Set a target like 5:30/km and get voice nudges when you drift ±15 s.
- **Reliable background setup.** A shortcut to Android's battery-optimisation screen.
- **Interval workouts.** Presets include run/walk, 6×400 m, 5×1 km, pyramid and tempo. Voice cues for every step and a live "x left" counter.
- **Badges.** 11 achievements computed from your history (5K, 10K, half, century ride, early bird, streaks…), with a pop-up when you earn one.
- **Heatmap.** All your routes drawn on one map.
- **Pace chart** on every activity.
- **Calories.** MET-based estimate using your body weight.
- **Manual activities** for treadmill, gym, or a run you forgot to record.
- **Shoe wear.** A 700 km life bar with a "replace soon" warning.
- **Daily reminder** notification at a time you choose.
- **Battery-friendly tracking.**
  - Session saved every 15 s instead of every fix.
  - No UI or map work while the screen is off.
  - GPS fixes rounded and batched in battery-saver mode.
  - Crash screen that keeps your data safe.
- **Personal records.** Fastest 1k/5k/10k/half, longest, biggest climb. Shown as 🏆 chips and in a pop-up when you beat one.
- **Weekly insights.** This week vs the same point last week (km, time, % change).
- **Monthly goal ring** on the You tab.
- **Share as image.** A neumorphic activity card as a PNG for WhatsApp, Instagram, etc.
- **Fast with a big history.** Lists use a light copy of each activity (simplified route + pre-computed best efforts). Full GPS points load only on the detail screen. Cards are memoised and the list is virtualised.
- **हिन्दी.** The main screens and voice cues are available in Hindi (Settings → Language).
- **Onboarding** on first launch, skeleton loaders, tactile press feedback, and **Undo** after deleting an activity.
- **Original app icon** and splash screen (light and dark).
- **Feed search and sport filter**, a 3-2-1 start countdown, haptics at every km, and a battery-saver GPS mode.
- **Friends & weekly leaderboard.** Every phone gets a friend ID (Settings → Friends). Enter a friend's ID to send a request; once they accept, you both see who covered the most km this week. Friends only see your name and this week's km, never routes or locations.
- **Backup / restore.** Export everything to one JSON file and import it on another phone. Imports only add what is missing: they never delete anything and never overwrite activities, gear or a profile already on the phone.

All data is stored on the device with AsyncStorage.

## Releasing an update (all on GitHub)

Everything runs on GitHub. No Expo account and no computer are needed, and it works from the GitHub mobile app.

1. Open **GitHub → Actions → Release APK → Run workflow**.
2. Type the new version (e.g. `1.2.0`) and, optionally, release notes.
3. The workflow then does the rest:
   - runs the tests;
   - bumps `app.json`, then commits and tags;
   - generates the Android project and builds the APK with Gradle;
   - publishes a **GitHub Release** with `stride-v1.2.0.apk` attached.
4. On the phone, **Settings → Check for updates** finds the release, downloads the APK with a progress bar and opens the installer.

Pushing a tag (`git tag v1.2.0 && git push --tags`) does the same.

**Signing.** By default the APK is signed with the standard React Native debug key. It is identical on every build, so updates install over each other.

To use your own key, add these repo secrets:
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

After switching keys, uninstall the old app once.

Optional: OTA JS updates via `eas update` still work if you set up EAS, but nothing requires it.

## GitHub cloud backup

**Settings → GitHub cloud backup** stores all activities in a **secret Gist** on your own GitHub account:
- It needs a token with only the `gist` permission.
- The token is kept in the phone's encrypted keystore.
- It backs up automatically after every activity.
- **Restore** merges the backup into a new phone.
- Connecting a phone to an existing backup is safe: its first upload merges what is already in the cloud before saving, so a new phone can't replace your history.

## Friends & leaderboard setup (one time, free)

Friend requests and the leaderboard need a small online database. Stride uses Firebase on the free
Spark plan; the phones talk to it directly, with no server of your own.

1. Open [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (Analytics can stay off).
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
3. **Build → Firestore Database → Create database** (production mode; a nearby location such as `asia-south1`).
4. **Firestore → Rules**: replace everything with the contents of [`firestore.rules`](firestore.rules) → **Publish**.
5. **Project settings (gear) → General → Your apps → Web (`</>`)** → register an app, then copy `apiKey` and `projectId` from the config shown.
6. Put them in `app.json` → `expo.extra.firebase`, then release a new APK:
   ```json
   "firebase": { "apiKey": "AIza…", "projectId": "stride-12345" }
   ```

Notes:
- The Firebase web API key only identifies the project, so it is fine in the repo. Access is controlled by
  `firestore.rules`: people can read only their friends' name and weekly km. Don't restrict the key to
  Android apps, because the app calls Firebase's REST API directly.
- The friend ID belongs to the app install. After reinstalling (or on a new phone) you get a new ID and
  friends have to add you again.
- `npm run test:friends` tests the feature and the rules against the Firebase emulators (needs Java).

## Project layout

```
src/app/                 Expo Router screens
  (tabs)/index.tsx       Feed
  (tabs)/record.tsx      Recorder
  (tabs)/profile.tsx     Stats, goal, best efforts
  activity/[id].tsx      Activity detail
src/components/          RouteMap (Leaflet WebView), RouteThumb (SVG), charts
src/lib/geo.ts           Distance, splits, elevation, best-effort maths (unit-tested)
src/lib/live.ts          Kalman filter, rolling pace, laps, pace coach, GPS health (unit-tested)
src/lib/coach.ts         Voice cues, auto-pause rules, GPX, streaks (unit-tested)
src/lib/tracker.ts       Location task + recording state machine
src/lib/storage.ts       Activity persistence
src/lib/updates.ts       OTA + GitHub-release APK updater
src/lib/githubSync.ts    Secret-Gist cloud backup
src/lib/records.ts       PRs and weekly insights (unit-tested)
src/lib/friends.ts       Friend IDs, requests, weekly leaderboard (emulator-tested with firestore.rules)
src/lib/firebase.ts      Tiny Firebase REST client (anonymous sign-in + Firestore)
plugins/withReleaseSigning.js  Release signing from CI secrets
.github/workflows/release.yml  GitHub-only APK build + release
src/lib/theme.tsx        Neumorphic light/dark theme
src/components/Neu.tsx   NeuCard, NeuButton, NeuSwitch, IconWell, NeuTile…
```

## Scripts

- `npm test`: unit tests for the geo maths and coach helpers
- `npm run typecheck`
- `npm run lint`: ESLint via `expo lint`

## Roadmap ideas

Kudos and comments, segments, GPX import, heart-rate sensors over BLE.
