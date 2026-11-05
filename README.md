# TBDI FitTrack

*Move • Monitor • Stay Healthy*

An original GPS activity tracker for Android and iOS, built with React Native and Expo. You can record runs, rides, walks and hikes, see the route on a map, and keep track of your progress.

The UI uses a neumorphic ("soft UI") design in light and dark. Every surface is shaped by a soft highlight and shadow, icons sit in inset wells, and the tab bar floats at the bottom.


## Download

**[⬇ Download the latest APK](https://github.com/lilesh0070/Strava/releases/latest)** for Android. Open the link, tap `tbdi-fittrack-v….apk`, allow "install unknown apps", then tap Install.

Once installed, new versions arrive through **Settings → Check for updates** inside the app.

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

- **Live recording.** Shows time, distance, and pace or speed while you move. You can pause and resume. Recording keeps going with the screen off (Android foreground service / iOS background location).
- **Crash-safe sessions.** The current recording is saved to storage, so if the app is killed it picks up where it left off.
- **GPS cleanup.** Drops low-accuracy fixes, stale cached fixes, standing-still jitter and multipath jumps.
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

- **Settings (cog, top-right).** App updates, theme (Auto/Light/Dark), language, voice, auto-pause, start countdown, GPS accuracy, workday break reminders, and backup/restore.
- **In-app updates.** Any phone with internet finds a new GitHub release on its own:
  - It checks when the app opens and again when you come back to it (at most every 3 hours), or any time with **Settings → Check for updates**. A banner says when a new version is out, and **Update** downloads it with a progress bar and opens the Android installer. Your data is kept.
  - It reads a small `update.json` that every release ships, from GitHub's download CDN. That avoids the GitHub API's 60-requests-per-hour-per-IP limit, which a whole office on one Wi-Fi would hit. Older releases fall back to the API.
  - The APK's size is checked before installing, so a broken download never reaches the installer. An earlier complete download is reused. If downloading fails there is an "Open download page" button.
  - **Test builds:** releases marked *pre-release* are only offered to phones with **Settings → Test builds** on.
  - **OTA:** JS changes published with `eas update` download in the background, and a "Restart" button applies them.
- **Precise live tracking.**
  - Full GPS (best-for-navigation) every second with no distance filter, so the live position never goes stale, even when you stand still.
  - A constant-velocity Kalman filter fed with the GPS chip's Doppler speed and course: no zig-zag, no lag behind you, no corner cutting.
  - Standing still adds no distance; a single multipath jump is rejected; Android's cached "last location" can't start a route in the wrong place.
  - Pace now and max speed come from the filtered Doppler speed, so they react within a few seconds without spikes.
  - The ±m accuracy chip re-checks every second and switches to "Finding GPS…" as soon as fixes stop.
  - Detects approximate-only permission or location turned off, and offers the fix (Android: in-app dialogs).
  - A watchdog restarts GPS if fixes stop arriving during a recording.
  - A GPS-quality gate before Start warns if the signal is weak.
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
  - The live map receives only new points (about 76 bytes a second instead of the whole route, ~70 KB after an hour), and pauses while another tab is showing.
  - Pre-start GPS runs only while the Record tab is on screen; it stops in the background, on other tabs and once a recording takes over.
  - In the background, fixes are still taken every second but handed to the app in batches (every 5 s, or 15 s in battery saver), so the phone wakes far less often.
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
  - **Copy:** puts the image on the clipboard, so it can be pasted from the keyboard's clipboard. **Save:** to the gallery. **More:** any app.
  - Choose what to show: route, distance, time, average pace and speed, steps, climb, calories, title, logo. White or dark text.
  - Exports are 1080 px wide. The classic summary card is still there.
  - **Direct Instagram stickers:** Instagram only accepts them from apps with a Facebook App ID. Create a free app at developers.facebook.com (no review needed), put its App ID in `app.json` → `expo.extra.facebookAppId`, and release a new version.
- **Fast with a big history.** Lists use a light copy of each activity (simplified route + pre-computed best efforts). Full GPS points load only on the detail screen. Cards are memoised and the list is virtualised.
- **हिन्दी.** The main screens and voice cues are available in Hindi (Settings → Language).
- **Onboarding** on first launch, skeleton loaders, tactile press feedback, and **Undo** after deleting an activity.
- **TBDI FitTrack app icon** (adaptive, with a themed Android 13+ variant) and splash screen (light and dark).
- **Feed search and sport filter**, a 3-2-1 start countdown, haptics at every km, and a battery-saver GPS mode.
- **Friends & weekly leaderboard.** Every phone gets a friend ID (Settings → Friends). Enter a friend's ID to send a request; once they accept, you both see who covered the most km this week. Friends only see your name and this week's km, never routes or locations.
- **Backup / restore.** Export everything to one JSON file and import it on another phone. Imports only add what is missing: they never delete anything and never overwrite activities, gear or a profile already on the phone.

All data is stored on the device with AsyncStorage.

## Releasing an update (all on GitHub)

Everything runs on GitHub. No Expo account and no computer are needed, and it works from the GitHub mobile app.

1. Open **GitHub → Actions → Release APK → Run workflow**.
2. Type the new version (e.g. `1.2.0`) and, optionally, release notes (shown in the app's update screen). Tick **prerelease** for a test build that only phones with *Test builds* on are offered.
3. The workflow then does the rest:
   - runs the tests;
   - bumps `app.json`, then commits and tags;
   - generates the Android project and builds the APK with Gradle;
   - publishes a **GitHub Release** with `tbdi-fittrack-v1.2.0.apk` attached.
4. Every phone with internet then sees the update: automatically (banner) or with **Settings → Check for updates**.

To send a tested pre-release to everyone: open it on GitHub → **Edit** → untick *Set as a pre-release*, tick *Set as the latest release* → **Update release**.

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
  (tabs)/health.tsx      Health tab: wellness score, water, check-in, insights, weekly share
  break.tsx              Guided desk stretch, box breathing, eye break
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
src/lib/health.ts        Wellness score, water goal, streaks, insights, wellness badges (unit-tested)
src/lib/breaks.ts        Stretch routine and break-reminder schedule (unit-tested)
src/lib/wellnessStore.ts Daily wellness log storage
plugins/withReleaseSigning.js  Release signing from CI secrets
.github/workflows/release.yml  GitHub-only APK build + release
src/lib/theme.tsx        Neumorphic light/dark theme
src/components/Neu.tsx   NeuCard, NeuButton, NeuSwitch, IconWell, NeuTile…
```

## Scripts

- `npm test`: unit tests for the geo maths, live tracking, coach, records and wellness helpers
- `npm run typecheck`
- `npm run lint`: ESLint via `expo lint`

## Roadmap ideas

Kudos and comments, segments, GPX import, heart-rate sensors over BLE.
