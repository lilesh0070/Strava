# TBDI FitTrack

*Move • Monitor • Stay Healthy*

An original GPS activity tracker for Android and iOS, built with React Native and Expo. You can record runs, rides, walks and hikes, see the route on a map, and keep track of your progress.

The UI uses a neumorphic ("soft UI") design in light and dark. Every surface is shaped by a soft highlight and shadow, icons sit in inset wells, and the tab bar floats at the bottom.


## Download

**Android:** **[⬇ Download the latest APK](https://github.com/lilesh0070/Strava/releases/latest)**. Open the link, tap `tbdi-fittrack-v….apk`, allow "install unknown apps", then tap Install. Once installed, new versions arrive through **Settings → Check for updates** inside the app.

**iPhone (AltStore / SideStore, free Apple ID):** every release also has `TBDI-FitTrack-v….ipa`, an unsigned iPhone build that [AltStore](https://altstore.io) or [SideStore](https://sidestore.io) signs on your phone with your own Apple ID. Add this AltStore **source** once, and new versions show up in AltStore as updates:

```
https://github.com/lilesh0070/Strava/releases/latest/download/altstore.json
```

Limits of a free Apple ID: the app has to be refreshed every 7 days (AltStore does it automatically when AltServer is running on your computer on the same Wi-Fi; SideStore needs no computer after setup), and at most 3 sideloaded apps at a time. For many iPhone users, TestFlight with an Apple Developer account ($99/year) is the easier route.

## Workplace wellness (Health tab)

Built for employees, so healthy habits fit into a working day:

- **Wellness score (0–100).** Rewards small daily actions: move 35, water 25, desk breaks 20, mind 10, check-in 10. A streak counts days with 50+.
- **Water tracker.** One tap per glass. The daily goal comes from your body weight (35 ml/kg), plus about 500 ml per hour of exercise.
- **Active minutes vs the WHO goal** of 150 minutes a week, from your recorded activities.
- **Guided micro-breaks.**
  - A 3-minute desk stretch: 9 office-friendly moves with voice cues.
  - Box breathing (1–3 min).
  - A 20-20-20 eye break.
- **10-second daily check-in.** Mood, energy, sleep and stress.
- **Personal insights.**
  - Short sleep or high stress over the week.
  - Low water.
  - Whether moving lifts your mood.
  - How many WHO minutes are left this week.
  - No desk break yet today.
- **Tip of the day.** 20 evidence-based tips.
- **Workday break reminders.** Stretch, water, eye and walk nudges during your work hours (every 45–120 min, Mon–Fri or Mon–Sat). Tapping one opens the right guided break.
- **Wellness badges**, alongside the activity badges.
- **Share my week.** An image card for the team WhatsApp group, to start friendly challenges. Add your team or department on the You tab.
- Everything is in English and Hindi, stays on the phone and is included in backups.

Wellbeing guidance only, not medical advice.

## Features

- **Live recording.** Shows time, distance, and pace or speed while you move. You can pause and resume. Recording keeps going with the screen off (Android foreground service with its "recording" notification / iOS background location with the blue indicator). Only "While using the app" location access is needed; the app never asks for "Allow all the time" / "Always", and the Android app doesn't declare background location at all.
- **Crash-safe sessions.** The current recording is saved to storage, so if the app is killed it picks up where it left off.
- **GPS cleanup.** Drops low-accuracy fixes, stale cached fixes, standing-still jitter and multipath jumps.
- **Live stats on the lock screen (Android).** While recording, a silent notification shows distance, time and pace, refreshed about every 10 seconds (Settings → Recording to turn off).
- **Auto-lap and targets.** Close a lap every N km automatically (voice summary), and get a one-time cue when you reach a distance or time target. The Record screen shows progress bars for the target and the weekly goal.
- **Celebrations.** A new personal record or badge pops up as an animated card (with confetti) in your language, not a system dialog.
- **Share my week.** The History header has a share button: a branded week card (7 day bars, km, time, best pace, steps, streak, friends rank) as an image, or a text block for WhatsApp. Early in the week it recaps last week.
- **Works offline.** The map library is bundled, so the route and position dot draw with no internet; only the street tiles need data (a small pill says so).
- **Steps.** Counted by the phone's hardware step counter during walks, runs and hikes (not while paused), with live steps and cadence. Older activities show an estimate from distance and speed, marked "≈".
- **Your data is kept safe.**
  - Every activity, with all its GPS points, is stored as its own file.
  - There is no size limit (AsyncStorage on Android caps the whole database at 6 MB).
  - Writes are crash-safe.
  - Files are included in Android's automatic backup.
  - A recording is only cleared once its activity is safely saved.
  - Existing activities move over automatically on first launch.
- **Maps.** Uses Leaflet with OpenStreetMap tiles, so no API key is needed.
- **History.** Every activity ever recorded, newest first and grouped by month with totals (km, steps). Tap one to open it, or tap its share button to post it. Search and sport filters included.
- **Activity detail.** Route map, moving/elapsed time, elevation gain and profile, per-km splits, rename and delete.
- **Voice updates.** Announces time and pace (or speed) at every kilometre.
- **Auto-pause.** Optional. Pauses when you stop moving and resumes when you set off again.
- **Notes, effort and gear.** Add notes and a 1–10 effort rating to any activity, and track the distance on your shoes or bikes.
- **GPX export.** Share any activity as a `.gpx` file (works with other fitness apps and Google Earth).
- **Streak and calendar.** A weekly activity streak plus a month calendar showing your active days.
- **Profile.** An 8-week distance chart with a weekly goal, all-time totals, and running best efforts (1k / 5k / 10k / half).

- **Settings (cog, top-right).** App updates, theme (Auto/Light/Dark), language, voice, auto-pause, auto-lap, targets, start countdown, GPS accuracy, lock-screen stats, workday break reminders, and backup/restore.
- **In-app updates.** Any phone with internet finds a new GitHub release on its own:
  - It checks when the app opens and again when you come back to it (at most every 3 hours), or any time with **Settings → Check for updates**. A banner says when a new version is out, and **Update** downloads it with a progress bar and opens the Android installer. Your data is kept.
  - It reads a small `update.json` that every release ships, from GitHub's download CDN. That avoids the GitHub API's 60-requests-per-hour-per-IP limit, which a whole office on one Wi-Fi would hit. Older releases fall back to the API.
  - The APK's size is checked before installing, so a broken download never reaches the installer. An earlier complete download is reused. If downloading fails there is an "Open download page" button.
  - **Test builds:** releases marked *pre-release* are only offered to phones with **Settings → Test builds** on.
  - **OTA:** the app can apply JS updates published with `eas update` ("Restart" button), but OTA is not configured yet (see *Releasing an update*), so today every fix ships as a release.
- **Precise live tracking.**
  - Full GPS (highest accuracy: best-for-navigation on Android, "Best" on iPhone) every second (every 3 s in battery saver) with no distance filter, so the live position never goes stale, even when you stand still.
  - A constant-velocity Kalman filter fed with the GPS chip's Doppler speed and course: no zig-zag, no lag behind you, no corner cutting.
  - Distance is credited for every filtered fix: on foot the filtered speed is integrated over time (position noise inflated walks by 3-6 %), rides use the filtered position, and phones whose chip reports no speed get a second, accuracy-aware smoother. A "still" state with hysteresis counts a stop as 0 m without clipping slow hikers; a GPS outage credits the straight line.
  - Simulator results (`npm run sim:gps`: real tracker code, realistic noise, 14 routes incl. traffic-light stops, standing 10 min, slow hikes, a 400 m track, a 60 s outage): mean distance error ≈ 0.7 % (Android), 0.8 % (iPhone), 2.0 % (no Doppler); standing ten minutes adds ~3 m on Android, ~5 m on iPhone and ~50 m without Doppler (was 281 m on Android).
  - Every stored point carries the recorded distance, so splits, best efforts and the pace chart agree with the headline number (GPX exports positions only; other apps re-measure them, within ~0.5 % in the simulator). Best efforts never span a pause.
  - iPhones report "speed 0, course −1" when standing and Android "0/0" for a stop or for no speed at all; both conventions are handled, so a stop reads as a stop and a budget phone's walk is not pinned at zero.
  - Standing still adds no distance; a single multipath jump is rejected; Android's cached "last location" can't start a route in the wrong place.
  - Pace now and max speed come from the filtered Doppler speed (held steady unless it moves by 3 s/km); without Doppler the live pace is the recorded distance over the last 30 s.
  - Auto-pause keeps the filter warm and resumes on three fast fixes or a real move of the smoothed position, so a multipath spike never flaps Resume/Pause; the first metres away from the stop count.
  - Elevation gain comes from a smoothed altitude with an 8 m hysteresis; altitude the chip flags as poor (vertical accuracy > 30 m) is dropped.
  - The ±m accuracy chip re-checks every second and switches to "Finding GPS…" as soon as fixes stop.
  - Detects approximate-only permission or location turned off, and offers the fix (Android: in-app dialogs).
  - A watchdog restarts GPS if fixes stop arriving during a recording (only while the app is on screen: Android doesn't allow starting the foreground service from the background).
  - If the screen-off recording can't start (the app was relaunched in the background, or the service was refused), GPS falls back to an on-screen-only watcher, the Record screen says "Keep the app open while recording", and the recording moves back to the foreground service as soon as the app is on screen again.
  - A GPS-quality gate before Start warns if the signal is weak.
- **Live stats.** Pace now, average pace, the current lap, a lap button with voice summaries, and max speed.
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
  - The live map receives only new points (about 76 bytes a second instead of the whole route, ~70 KB after an hour), and pauses while another tab is showing.
  - Pre-start GPS runs only while the Record tab is on screen; it stops in the background, on other tabs and once a recording takes over.
  - In the background, fixes are still taken every second (every 3 s in battery saver) but handed to the app in batches (every 5 s, or 15 s in battery saver), so the phone wakes far less often.
  - iOS uses "Best" accuracy rather than the navigation mode Apple reserves for plugged-in devices.
  - Session saved every 15 s instead of every fix, and no UI work while the screen is off.
  - Break reminders are scheduled with the OS, so the app never runs in the background for them.
  - Reminders are re-checked at launch and rescheduled if the phone dropped them.
  - Crash screen that keeps your data safe.
- **Personal records.** Fastest 1k/5k/10k/half, longest, biggest climb. Shown as 🏆 chips and in a pop-up when you beat one.
- **Weekly insights.** This week vs the same point last week (km, time, % change).
- **Monthly goal ring** on the You tab.
- **Share to Instagram stories and anywhere else** (Strava-style). From any activity, or its card in History, tap Share:
  - **Swipe through styles.** *Transparent* comes first: a sticker with the clean orange route line (no start or end markers) and your key stats on a see-through background. Then *Your photo*, *Dark* and *Orange*, where you drag the stats wherever you like.
  - **Instagram Story:**
    - With a Facebook App ID set (see below), the sticker opens straight in Instagram's story editor, where you pick a photo or video.
    - Without one, the sticker is saved to your gallery and Instagram opens: pick your photo or video, then use *Stickers → Photo*.
    - For the photo, dark and orange styles, the share sheet opens; choose Instagram → Stories.
  - **Copy sticker:** puts the image on the clipboard, so it can be pasted from the keyboard's clipboard. **Save:** to the gallery. **More:** any app.
  - **Copy as text:** the whole activity as one block of plain text: name, date, the chosen numbers with emojis, and the route drawn with Braille dot characters (it keeps the route's real shape). In an Instagram story tap **Aa**, paste, and pick orange so the line matches the app's route colour. Also handy for WhatsApp and captions.
  - Choose what to show: route, distance, time, average pace and speed, steps, climb, calories, title, logo. White or dark text.
  - Exports are 1080 px wide. The classic summary card is still there.
  - **Direct Instagram stickers:** Instagram only accepts them from apps with a Facebook App ID. Create a free app at developers.facebook.com (no review needed), put its App ID in `app.json` → `expo.extra.facebookAppId`, and release a new version.
- **Fast with a big history.** Lists use a light copy of each activity (simplified route + pre-computed best efforts). Full GPS points load only on the detail screen. Cards are memoised and the list is virtualised.
- **हिन्दी.** The whole app and the voice cues are available in Hindi (Settings → Language); `npm run check:i18n` guards against new English-only strings.
- **Onboarding** on first launch, skeleton loaders, tactile press feedback, and **Undo** after deleting an activity.
- **TBDI FitTrack app icon** (adaptive, with a themed Android 13+ variant) and splash screen (light and dark).
- **Feed search and sport filter**, a 3-2-1 start countdown, haptics at every km, and a battery-saver GPS mode.
- **Friends & leaderboard.** Every phone gets a friend ID (Settings → Friends). Enter a friend's ID to send a request; once they accept, you both see who covered the most km this week, this month or all-time (also on the You tab). Friends only see your name and your km totals, never routes or locations. **Invite a friend** sends the app's download link together with your ID.
- **Share this app.** Settings → Share this app sends a link to the newest APK (from an iPhone: the release page with the APK and the .ipa).
- **Backup / restore.** Export everything to one JSON file and import it on another phone. Imports only add what is missing: they never delete anything and never overwrite activities, gear or a profile already on the phone.

Your data stays on the phone: activities, their GPS points, the list summaries and the live recording are files (see `src/lib/blobStore.ts`); settings, gear, profile and the wellness log are in AsyncStorage. Only two optional features go online: GitHub cloud backup (a secret Gist on your own account) and Friends (your name and your week/month/total km in Firebase).

## Releasing an update (all on GitHub)

Everything runs on GitHub. No Expo account and no computer are needed, and it works from the GitHub mobile app.

> **Always release from `main`.** Do the work on a branch, open a pull request, merge it into `main`, and only then run the release. Versions v1.3.0–v1.3.4 were once released from a side branch that never reached `main`, and the next release from `main` would have silently dropped all of that work. If a branch was ever released from, merge it into `main` before the next release.

0. If `firestore.rules` changed since the last release, run `npm run test:friends` and **publish the rules first**
   in the Firebase console (project `stribe-a8108`, Firestore → Rules → paste → Publish). Phones on the new
   version write the new fields; until the rules allow them they fall back to the weekly fields only.
1. Open **GitHub → Actions → Release APK → Run workflow**, with *Use workflow from* left on `main`.
2. Type the new version and, optionally, release notes (shown in the app's update screen). The version must be newer than `expo.version` in `app.json` (a pre-release counts too: after pre-release 1.3.9, promote it or release 1.3.10). Tick **prerelease** for a test build that only phones with *Test builds* on are offered.
3. The workflow then does the rest:
   - runs the unit tests and the typecheck (`npm test && npx tsc --noEmit`); a failure stops the run before anything is bumped;
   - bumps `expo.version` and `expo.android.versionCode` in `app.json`, then commits and tags;
   - generates the Android project and builds the APK with Gradle;
   - publishes a **GitHub Release** with `tbdi-fittrack-v1.2.0.apk` and `update.json` attached;
   - then, in a separate job on macOS, builds the iPhone `.ipa` and attaches it together with `altstore.json` (workflow `iOS IPA (AltStore)`). If the iPhone build fails, the Android release is already out, but the AltStore source (`releases/latest/download/altstore.json`) returns 404 until an .ipa is attached. A transient failure (runner, network, CocoaPods) is fixed by **Actions → iOS IPA (AltStore) → Run workflow** with the tag (e.g. `v1.2.0`). That run builds the code *at the tag*: a fix in `ios.yml` itself is picked up (it is read from the branch you run it from), a fix in app code, `app.json`, `plugins/` or `scripts/` needs the next release.
4. Every Android phone with internet then sees the update: automatically (banner) or with **Settings → Check for updates**. iPhones see it in AltStore.

If a release run fails or is cancelled **after** the "Bump version" step, the version's tag already exists but has no release. Don't reuse that number: release the next one (e.g. `1.2.1`). Phones are only ever offered the latest *published* release.

To send a tested pre-release to everyone: open it on GitHub → **Edit** → untick *Set as a pre-release*, tick *Set as the latest release* → **Update release**.

Two other things start a release by themselves, so avoid both:
- A push to `main` that changes `expo.version` in `app.json` (e.g. merging a PR that bumps it) releases that
  version at once: no notes, never a pre-release, and `versionCode` is not raised. **Never change the version
  in a pull request**; let the Run workflow button bump `version` and `versionCode`.
- Pushing a tag `vX.Y.Z` releases it only if `app.json` already says `X.Y.Z` (the run stops otherwise), and
  it does not raise `versionCode` either.

Never run **Release APK** from a side branch, not even as a pre-release: it commits and tags on the branch it
runs on.

**Signing (production).** Without secrets the APK is signed with the public React Native debug key
(fingerprint `FA:C6:17:45:…:03:3B:9C`). It is the same for every React Native developer, so anyone could
sign an APK that installs over TBDI FitTrack, and Play Protect warns about it. A production release uses a
private key, given to the workflow as four repository secrets (Settings → Secrets and variables → Actions):
- `ANDROID_KEYSTORE_BASE64` (the .jks / PKCS12 file, base64 on one line)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD` (same as the store password for a PKCS12 keystore)

Create a key once with `keytool -genkeypair -keystore release.jks -storetype PKCS12 -alias tbdi-fittrack
-keyalg RSA -keysize 4096 -validity 36500 -dname "CN=TBDI FitTrack, O=TBDI, C=IN"` and keep the file and
password somewhere safe: **if the key is lost, phones can't update again without uninstalling.**

Switching keys: Android only installs an update signed with the same key, so each phone reinstalls once.
Every release writes the signing certificate's SHA-256 fingerprint into the app and into `update.json`
(step *Signing fingerprint*); from v1.3.10 on the app notices a key change and shows the steps (back up,
download the new APK, uninstall, install, restore) instead of a failing installer. So: release v1.3.10 or
newer with the old key first, let phones update to it, then add the secrets and release the next version.
The run log shows the fingerprint it signed with.

Optional: OTA JS updates via `eas update` need an Expo account and `npx eas-cli@latest update:configure` (adds `updates.url` and `extra.eas.projectId` to `app.json`). They only reach phones running a version released after that; today's builds have OTA off, so ship fixes as a release.

## GitHub cloud backup

**Settings → GitHub cloud backup** stores all activities in a **secret Gist** on your own GitHub account:
- It needs a token with only the `gist` permission.
- The token is kept in the phone's encrypted keystore.
- It backs up automatically after every activity.
- **Restore** merges the backup into a new phone.
- Connecting a phone to an existing backup is safe: its first upload merges what is already in the cloud before saving, so a new phone can't replace your history.

## Friends & leaderboard (Firebase)

Friend requests and the leaderboard need a small online database. The app uses Firebase on the free
Spark plan; the phones talk to it directly over its REST API (no Firebase SDK, no server of your own).

**It is already set up** for project `stribe-a8108` (see `app.json` → `expo.extra.firebase`), with
Anonymous sign-in on and the rules from [`firestore.rules`](firestore.rules) published. **If you change
`firestore.rules`, publish it again** in the Firebase console (Firestore → Rules → paste → Publish); the
app doesn't do that for you. Run `npm run test:friends` first.

To move to a new Firebase project (one time, free):

1. Open [console.firebase.google.com](https://console.firebase.google.com) → **Create a project** (Analytics can stay off).
2. **Security → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**
3. **Databases & Storage → Firestore → Create database**: Standard edition, database ID `(default)`, location `asia-south1` (Mumbai), production mode.
4. **Firestore → Rules**: replace everything with the contents of [`firestore.rules`](firestore.rules) → **Publish**.
5. **Settings → General → Your apps → Web (`</>`)** → register an app, then copy `apiKey` and `projectId` from the config shown.
6. Put them in `app.json` → `expo.extra.firebase`, then release a new version:
   ```json
   "firebase": { "apiKey": "AIza…", "projectId": "stride-12345" }
   ```

Notes:
- The Firebase web API key only identifies the project, so it is fine in the repo. Access is controlled by
  `firestore.rules`: people can read only their friends' name and km totals (week, month and all-time). Don't restrict the key to
  Android apps, because the app calls Firebase's REST API directly.
- The friend ID belongs to the app install. After reinstalling (or on a new phone) you get a new ID and
  friends have to add you again.
- `npm run test:friends` tests the feature and the rules against the Firebase emulators. It needs Java 21
  (what it is run with here) and internet on the first run (it downloads firebase-tools 15.35.0 and the emulators).

## Project layout

```
index.js                 App entry: loads the recorder (background GPS task) before Expo Router
src/app/                 Expo Router screens
  (tabs)/index.tsx       History
  (tabs)/record.tsx      Recorder
  (tabs)/health.tsx      Health tab: wellness score, water, check-in, insights, weekly share
  (tabs)/profile.tsx     You: stats, goals, best efforts, gear
  activity/[id].tsx      Activity detail
  share/[id].tsx         Share screen: stickers, stories, Copy sticker / Copy as text
  friends.tsx            Friend ID, requests, week / month / all-time leaderboard
  settings.tsx           Settings (updates, recording, reminders, backup, friends, share app)
  break.tsx              Guided desk stretch, box breathing, eye break
  _layout.tsx          Root stack, notification handler (hides data.live banners), restore() of a recording
  achievements.tsx     Badges
  add-activity.tsx     Add an activity by hand
  heatmap.tsx          All routes on one map
  onboarding.tsx       First-launch walkthrough
  workouts.tsx         Interval workout picker
src/components/          RouteMap (Leaflet WebView), RouteThumb (SVG), StoryOverlay, charts, Neu* UI kit
  Neu.tsx                Neumorphic UI kit (NeuButton/Card/Switch/Progress…): spring press, busy/disabled states
  ToastHost.tsx          Bottom snackbar (Undo after delete / discard)
  CelebrationOverlay.tsx Animated "new record / badge" card with confetti (store: src/lib/celebrate.ts)
  WeekRecapCard.tsx      "My week" share card (numbers: src/lib/weekRecap.ts)
src/lib/tracker.ts       Location task + recording state machine (steps, watchdog, voice cues)
src/lib/live.ts          Kalman filter, distance stage (still state, gaps, no-Doppler smoother), laps, pace coach (unit-tested)
src/lib/liveNotification.ts  Android lock-screen stats notification; liveText.ts builds its text (unit-tested)
src/lib/weekRecap.ts     "Share my week" numbers (unit-tested); components/WeekRecapCard.tsx draws the card
src/lib/celebrate.ts     PR / badge celebration store; components/CelebrationOverlay.tsx shows it
src/lib/leafletSrc.ts    Leaflet JS+CSS inlined into the map page (generated by scripts/vendor-leaflet.mjs)
src/lib/geo.ts           Distance, splits, elevation, best-effort maths (unit-tested)
src/lib/coach.ts         Voice cues, auto-pause rules, GPX, week keys and streaks (unit-tested)
src/lib/types.ts         Activity, Session, Settings + DEFAULT_SETTINGS, defaultName()
src/lib/records.ts       Personal records, week-over-week insights (unit-tested)
src/lib/achievements.ts  Badges from the history
src/lib/workouts.ts      Interval workouts (nameKey / descKey, step cues)
src/lib/steps.ts         Step counting and estimates
src/lib/reminders.ts     Daily and break reminders
src/lib/releaseInfo.ts   update.json / release parsing for the updater (unit-tested)
src/lib/storage.ts       Activities, summaries, gear, profile, settings (writes are serialised)
src/lib/blobStore.ts     Crash-safe file storage for activities and the live recording
src/lib/backup.ts        File backup / restore (restore only adds, never overwrites)
src/lib/githubSync.ts    Secret-Gist cloud backup
src/lib/updates.ts       In-app updater (update.json / GitHub releases, OTA), share-app link
src/lib/friends.ts       Friend IDs, requests, leaderboard (emulator-tested with firestore.rules; weekly-only fallback for old rules)
src/lib/firebase.ts      Tiny Firebase REST client (anonymous sign-in + Firestore)
src/lib/friendsApp.ts    Wires friends into the app (config, keystore, automatic weekly sharing)
src/lib/shareStats.ts    Numbers on the share sticker; shareText.ts: "Copy as text" (unit-tested)
src/lib/health.ts        Wellness score, water goal, streaks, insights, wellness badges (unit-tested)
src/lib/breaks.ts        Stretch routine and break-reminder schedule (unit-tested)
src/lib/strings.ts       English + Hindi texts (every key in both; strings.test.ts checks it); i18n.tsx: useT, sportName, prLabel, badgeTitle
modules/instagram-story  Local Expo module (Android): send a sticker to Instagram's story editor
plugins/withReleaseSigning.js   Release signing from CI secrets
plugins/withAsyncStorageSize.js Raises Android's AsyncStorage size limit
firestore.rules          Who may read/write what in Firebase (publish after every change)
scripts/friends-rules.test.ts   Friends + rules test against the Firebase emulators
scripts/sim/             Node harness for the recording engine: loader + stubs, tracker.test.ts, gps-sim.ts, autopause-sim.ts
scripts/check-i18n.mjs   Fails on English-only UI strings in src/app and src/components
scripts/vendor-leaflet.mjs      Regenerates src/lib/leafletSrc.ts from the leaflet devDependency
scripts/test-resolve.mjs        Lets `node --test` resolve extensionless imports like Metro
scripts/altstore-source.mjs     Writes altstore.json for the iPhone build
.github/workflows/release.yml   Release: tests, version bump, APK, GitHub release, then the iPhone build
.github/workflows/ios.yml       Unsigned iPhone .ipa (AltStore) on macOS
```

## Rules for changing the code

Read this before touching the parts below; each rule exists because breaking it caused a real bug.

**GPS / distance (`src/lib/live.ts`, `src/lib/tracker.ts`, `src/lib/geo.ts`)**
- The headline distance is `session.distanceM`. It grows through `distanceStep()` for **every filtered fix**
  (not only for the points kept for the route), plus `settleDistance()` in `tracker.ts` when a segment ends
  (pause, auto-pause, finish) and the stop-to-resume hop when auto-pause resumes (paused branch of
  `ingest()`). Nothing else may add to it. Never add distance from the gap between two stored points: that
  integrated whole stops into the total.
- Stored points are for the map only (smoothed, ≥ 3 m apart, none while standing). Each one carries `d`,
  the recorded distance when it was stored; `cumulative()`, `splits()`, `bestEffort()`, `speedSeries()` and
  `totalDistance()` read `d` when every point has it, and fall back to chords for activities from before
  v1.3.9. Keep writing `d` on every pushed point, and when a segment ends call `settleDistance(s)` in
  `tracker.ts` (it credits `settlePending()` from `live.ts` and also updates the last point's `d`; don't call
  `settlePending()` directly), otherwise the splits stop matching the headline.
- Speed 0 means two things: iPhones report speed 0 with course −1 when standing (a real stop); Android
  reports 0 / 0 both for a stop and for "this fix has no speed" (phones without Doppler). `fixVelocity()`
  tells them apart with `recentDoppler`; don't simplify it to "0 = stopped" (it pinned budget phones' walks
  at zero) or "0 = unknown" (it made every iPhone stop creep).
- The "still" state lives in `distanceStep()` (`src/lib/live.ts`) and decides when a stop counts as 0 m:
  `STILL_MS` 0.25 m/s on 3 fixes to enter; to leave, `MOVING_MS` 0.8 m/s on 2 fixes, 5 fixes ≥ 0.5 m/s, or a
  move of ≥ max(8 m, 0.8 × accuracy) (those last numbers are literals in the function). `MOVING_MS` is also
  the auto-resume speed for walks in `tracker.ts`, so changing it changes auto-pause too. `STOPPED_MS` (0.4)
  is a different threshold (Kalman filter, "pace now"). A 0.5 m/s hiker must not be clipped.
- Auto-pause is off for hikes on purpose, and auto-resume needs three fixes beyond the threshold (or one
  accurate fix): a single multipath jump must not resume. With no usable fixes (indoors, underpass, tunnel)
  it waits 30 s instead of 12 s, and a resume far from the stop point (≥ 1 m/s on average) undoes the pause,
  so running through a blind stretch is never removed from moving time or turned into a fake PR.
- After changing any of this, run `npm run test:tracker`, `npm run sim:gps` and `npm run sim:autopause`
  and compare with today's baseline by eye (the simulators only print, nothing fails): `sim:gps` mean |error|
  ≈ 0.7 / 0.8 / 2.0 % (Android / iPhone / no Doppler) and `stand 10m` creep ≈ 3 / 5 / 50 m; `sim:autopause`
  "run city 6 stops" → 6 / 6 / ≈4.5 pauses of 6, and 0 pauses on the hikes. Put a new scenario in
  `scripts/sim/gps-sim.ts` when you fix a case.
- The session is persisted and restored after an app kill **and after an app update**. A new `Session` or
  `DistanceState` field must be optional and the code must work when it is missing.
- If you change what `bestEffort()` returns, bump `EFFORTS_V` in `src/lib/storage.ts` so the cached
  efforts in list summaries are rebuilt once.
- Screen-off recording is the location task (`startTask()` in `tracker.ts`: `startLocationUpdatesAsync` with
  `foregroundService` and `showsBackgroundLocationIndicator`). It needs only foreground ("While using")
  permission, but only when started while the app is in the foreground: Android throws
  `ForegroundServiceStartNotAllowedException` from the background, and iOS doesn't start a When-In-Use app's
  updates there. So never start or restart GPS from the background (the watchdog returns early there);
  `watchPositionAsync` is only the fallback, and `upgradeUpdates()` moves the recording back to the task once
  the app is on screen. Don't ask for background permission: `ACCESS_BACKGROUND_LOCATION` is in
  `android.blockedPermissions` in `app.json` (Play requires a prominent disclosure and review for it).

**Texts and languages**
- Every user-facing string goes through `t('key')` with an English and a Hindi value in `src/lib/strings.ts`
  (`npm test` fails if an English key has no Hindi value; `{placeholders}` are only compared for the keys
  listed in `src/lib/strings.test.ts`, so add a new key with a placeholder to that list). `npm run check:i18n`
  only catches `label="…"`/`title="…"`-style JSX attributes, `Alert.alert('…')` and plain JSX text; strings
  passed as arguments (e.g. `toggle(icon, 'Title', 'Sub', key)` in settings.tsx) or as `{'…'}` are not caught,
  so check those yourself.
- Stored data stays English: badge `title`, `PersonalRecord.label`, `workoutName` on activities. Screens
  translate at render with `badgeTitle(t, id)`, `prLabel(t, record)`, `t(workout.nameKey)`. Workout voice
  cues are English on purpose. New activity names use the app language (`defaultName(sport, startedAt, lang)`).

**Settings**
- A new setting needs a field in `Settings` and a default in `DEFAULT_SETTINGS` (`src/lib/types.ts`);
  `getSettings()` merges stored settings over the defaults, so phones updating from an older version get the
  default. In `src/app/settings.tsx` add it with the `toggle(icon, t('set.x'), t('set.xSub'), 'x')` helper (or
  `set({...})`): it saves through `updateSettings()` (queued) and calls `refreshSettings()`, so the recorder's
  cached copy sees it. Don't call `saveSettings()` directly.

**Friends (Firebase)**
- A new field on `profiles/{uid}`: add it to `hasOnly([...])` in `firestore.rules` **as optional**
  (`!('x' in request.resource.data) || …`), because older app versions keep writing profiles without it. Run
  `npm run test:friends`, then **publish the rules in the Firebase console before releasing** the app version
  that writes the field. Unpublished rules reject the write; `share()` then falls back to the weekly fields
  and retries the full write every 6 hours (keep that fallback). In code: add the field to `MyStats` and to
  the `changed` check in `share()` (`src/lib/friends.ts`), fill it in `myWeek()` (`src/lib/friendsApp.ts`),
  read it in `board()` with a default (friends on old versions don't send it), show it in
  `src/app/friends.tsx`, add it to `device()` in `scripts/friends-rules.test.ts`, and update the privacy note
  under *Friends & leaderboard*.

**Map**
- Leaflet is inlined from `src/lib/leafletSrc.ts` (generated: don't edit it, don't go back to a CDN `<script>`,
  which left the map blank offline). After bumping the `leaflet` devDependency run `node scripts/vendor-leaflet.mjs`.
- The map page starts at opacity 0 and fades in on the first position or route; it posts `tiles-offline` /
  `tiles-online` to the app.

**Notifications**
- The Android lock-screen stats use their own silent channel `live` and carry `data.live = true`, which
  the handler in `src/app/_layout.tsx` uses to never show them as a banner; their `data.url = '/record'`
  opens the recorder when tapped (reminders use `data.url` the same way). Android keeps a channel's
  importance and sound once it exists, so to change them create a channel with a new id instead of editing
  `live`'s settings.

## Working on the code

Setup: Node 22.6 or newer (the tests use `--experimental-strip-types`), then `npm ci`. Unit tests go in
`src/lib/<name>.test.ts` (the only place `npm test` looks) and can import only modules without React
Native imports; recorder-level tests go in `scripts/sim/tracker.test.ts`, which stubs the native modules.

Trying a change on a phone: the app uses native modules that Expo Go doesn't have. Android: connect the
phone by USB and run `npx expo run:android` (needs the Android SDK and JDK 17; a debug app that loads JS from
`npx expo start`). iPhone: **Actions → iOS IPA (AltStore) → Run workflow** on your branch with the tag left
empty, then install the .ipa from the run's artifacts with AltStore. `eas build --profile development` would
first need `npx expo install expo-dev-client` and an Expo account.

Before every pull request:

- `npm run typecheck`, `npm run lint`, `npm test` and `npm run check:i18n` must pass. **No checks run on pull
  requests**: the release workflow runs only `npm test && npx tsc --noEmit` (before the version bump) and
  stops on a failure; lint, check:i18n, test:tracker, the simulators and test:friends never run in CI, so run
  them yourself. Test files (`*.test.ts`) and `scripts/sim` are not type-checked. Every user-facing string goes through
  `t('key')` with an English and a Hindi value in `src/lib/strings.ts`. Read *Rules for changing the code* first.
- If you touched `src/lib/tracker.ts`, `src/lib/live.ts` or `src/lib/geo.ts`: `npm run test:tracker` (the recording engine
  end to end under Node) and `npm run sim:gps` (distance error of the real tracker over synthetic routes
  for Android, iPhone and no-Doppler phones; keep the means near 0.7 / 0.8 / 2.0 % and the 10-minute
  standing creep near 3 / 5 / 50 m). `npm run sim:autopause` checks auto-pause/resume behaviour.
- If you touched `src/lib/friends.ts`, `src/lib/firebase.ts` or `firestore.rules`: `npm run test:friends`
  (needs Java 21; downloads firebase-tools and the emulators the first time).
- Add native libraries with `npx expo install <package>` so the version matches Expo SDK 58. A new
  native library or config plugin needs a new release (APK/IPA); it can't arrive as an OTA update.
- Keep `index.js` importing `./src/lib/tracker` before `expo-router/entry`: Android can start the app in
  the background (no screen) to deliver GPS fixes, and the location task must be defined then.
- `ios/` and `android/` are generated by `npx expo prebuild` (they are git-ignored). Configure native
  things in `app.json` and `plugins/`, never by editing those folders.

Branches and releases: work on a branch → pull request → merge into `main` → release from `main` (see
*Releasing an update*). Don't leave released work on a side branch.

Known gaps (good next steps):

- Android release APKs are signed with the public React Native debug key unless the `ANDROID_KEYSTORE_*`
  secrets are set; use a private key before sharing widely (switching keys needs one reinstall).
- iPhone builds are only for AltStore/SideStore; TestFlight/App Store needs an Apple Developer account
  and an EAS (or Xcode) signing setup.
- Direct Instagram story stickers on iPhone aren't implemented (the sticker is saved to the gallery and
  Instagram opens instead).

## Scripts

- `npm test`: unit tests (geo maths, live tracking, coach, records, wellness, sharing, week recap, strings, friends helpers)
- `npm run typecheck`
- `npm run lint`: ESLint via `expo lint`
- `npm run test:friends`: friends + Firestore rules against the Firebase emulators
- `npm run test:tracker`: the recording engine end to end (stubbed native modules, injected GPS fixes)
- `npm run sim:gps [android|ios|nodop] [seeds]`: distance accuracy simulator; `npm run sim:autopause`
- `npm run check:i18n`: fails on English-only UI strings
- `node scripts/vendor-leaflet.mjs`: refresh the inlined Leaflet after bumping the devDependency

## Roadmap ideas

Kudos and comments, ghost pace (race your best on a route), training load / rest-day advice, back-to-start navigation, GPX import and CSV export, a fitness score with a race predictor, segments, heart-rate sensors over BLE, barometer-based elevation.
