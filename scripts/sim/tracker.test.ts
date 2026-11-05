// End-to-end tests of the recording engine (src/lib/tracker.ts) under Node with stubbed native modules:
// fixes are injected, the clock is faked. Run with `npm run test:tracker`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import AS, { __store } from './stubs/async-storage.mjs';
import { __files } from './stubs/fs.mjs';
import { __w } from './stubs/location.mjs';
import { __said, __setAppState } from './stubs/misc.mjs';

let clock = 1_800_000_000_000;
Date.now = () => clock;
await AS.setItem('stride:settings', JSON.stringify({ autoPause: true, voiceCues: true }));
const tracker = await import('../../src/lib/tracker.ts');
const storage = await import('../../src/lib/storage.ts');
const backup = await import('../../src/lib/backup.ts');
const { sessionMovingSec } = await import('../../src/lib/types.ts');
await new Promise((r) => setTimeout(r, 20));

let lat = 28.6, lng = 77.2;
const fix = (acc = 5, moveM = 4) => {
  lat += moveM / 111_320;
  return { coords: { latitude: lat, longitude: lng, altitude: null, accuracy: acc, speed: moveM, heading: 0 }, timestamp: clock };
};
const run = async (sec: number, acc = 5, moveM = 4) => { for (let i = 0; i < sec; i++) { clock += 1000; await tracker.ingest([fix(acc, moveM) as never]); } };
/** Wait (real time) for something the tracker does asynchronously, e.g. after an app-state change. */
const waitFor = async (ok: () => boolean, what: string) => {
  for (let i = 0; i < 100 && !ok(); i++) await new Promise((r) => setTimeout(r, 5));
  assert.ok(ok(), `timed out waiting for: ${what}`);
};

test('manual pause then resume: no instant auto-pause, pause not counted twice', async () => {
  await tracker.start('run');
  await run(600);
  const before = tracker.getSession()!.distanceM!;
  assert.ok(before > 1500, `distance ${before}`);
  await tracker.pause();
  clock += 600_000;
  await tracker.resume();
  await run(1, 60, 0); // first fix after resume is poor and rejected
  const s = tracker.getSession()!;
  assert.equal(s.status, 'recording');
  assert.ok(Math.abs(sessionMovingSec(s, clock) - 601) < 3, `moving ${sessionMovingSec(s, clock)}`);
  await run(13, 5, 0); // really standing still → auto-pause, measured from the resume
  assert.equal(tracker.getSession()!.status, 'paused');
  assert.ok(sessionMovingSec(tracker.getSession()!, clock) >= 598, `moving ${sessionMovingSec(tracker.getSession()!, clock)}`);
  await tracker.discard();
});

test('a failed save keeps the recording; the retry saves one activity', async () => {
  await tracker.start('run');
  await run(60);
  await tracker.pause();
  const id = tracker.getSession()!.activityId;
  (globalThis as { __fsFail?: boolean }).__fsFail = true;
  await assert.rejects(tracker.finish());
  assert.ok(tracker.getSession(), 'session kept');
  (globalThis as { __fsFail?: boolean }).__fsFail = false;
  const a = await tracker.finish();
  assert.equal(a!.id, id);
  assert.equal(tracker.getSession(), null);
  const ids: string[] = JSON.parse(__store.get('stride:activities'));
  assert.equal(ids.filter((x) => x === id).length, 1);
});

test('double tap on Start starts the location task once, and discard stops it', async () => {
  const before = { s: __w.taskStarts, p: __w.taskStops, c: __w.created };
  await Promise.all([tracker.start('run'), tracker.start('run')]);
  assert.equal(__w.taskStarts - before.s, 1);
  assert.equal(__w.created - before.c, 0, 'no fallback watcher');
  await tracker.discard();
  assert.equal(__w.taskStops - before.p, 1);
  assert.equal(__w.task, null);
});

test('"While using" access is enough: a foreground-service task in the app language, "Allow all the time" never asked', async () => {
  await AS.setItem('stride:settings', JSON.stringify({ autoPause: true, voiceCues: true, language: 'hi' }));
  try {
    assert.equal(await tracker.ensurePermissions(), 'granted');
    await tracker.start('run');
    assert.equal(tracker.trackingMode(), 'task');
    const o = __w.task!.opts;
    assert.equal(o.foregroundService.notificationTitle, 'TBDI FitTrack रिकॉर्ड कर रहा है');
    assert.equal(o.foregroundService.notificationBody, 'आपकी एक्टिविटी ट्रैक हो रही है।');
    assert.equal(o.showsBackgroundLocationIndicator, true, 'iPhone: blue indicator with "While Using"');
    assert.equal(__w.bgAsked ?? 0, 0, 'background permission is never requested');
    await tracker.discard();
  } finally {
    await AS.setItem('stride:settings', JSON.stringify({ autoPause: true, voiceCues: true }));
    await tracker.refreshSettings();
  }
});

test('if the location task cannot start, a watcher records; the task takes over once the app is back on screen', async () => {
  __w.taskFail = new Error('ForegroundServicePermissionsException');
  const c0 = __w.created, r0 = __w.removed;
  await tracker.start('run');
  assert.equal(tracker.trackingMode(), 'watcher');
  assert.equal(__w.created - c0, 1);
  __w.taskFail = null;
  __setAppState('background');
  __setAppState('active');
  await waitFor(() => tracker.trackingMode() === 'task', 'task after returning to the app');
  assert.equal(__w.removed - r0, 1, 'the watcher is removed once the task runs');
  await tracker.discard();
  assert.equal(__w.task, null);
});

test('GPS is never restarted in the background; a recording restored there gets its task once on screen', async () => {
  await tracker.start('run');
  await run(30);
  const s0 = __w.taskStarts, p0 = __w.taskStops;
  __setAppState('background');
  clock += 60_000; // a minute without fixes
  await tracker.watchdog();
  assert.equal(__w.taskStarts - s0, 0, 'no restart from the background (Android refuses the foreground service there)');
  assert.equal(__w.taskStops - p0, 0, 'the running foreground service is left alone');
  __setAppState('active');
  await tracker.watchdog();
  assert.equal(__w.taskStarts - s0, 1, 'restarted once back on screen');
  // the app is killed and relaunched without a screen: the task can't start there, the watcher stands in
  await tracker.pause();
  __w.task = null;
  __setAppState('background');
  const fresh = await import('../../src/lib/tracker.ts?restart=bg');
  await fresh.restore();
  assert.equal(fresh.trackingMode(), 'watcher');
  assert.equal(__w.task, null, 'no foreground service started from the background');
  __setAppState('active');
  await waitFor(() => fresh.trackingMode() === 'task', 'task once the restored app is on screen');
  await fresh.discard();
  await tracker.discard();
  assert.equal(__w.task, null);
});

test('a task start still in flight when the recording is discarded leaves no GPS running', async () => {
  __w.taskFail = new Error('not yet');
  await tracker.start('run'); // on the watcher
  __w.taskFail = null;
  __setAppState('background');
  __setAppState('active'); // the move to the task starts (in flight for a few ms)...
  await tracker.discard(); // ...while the recording is thrown away
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(__w.task, null);
  assert.equal(tracker.trackingMode(), null);
});

test('time-based workout step finishes during a standing (auto-paused) rest', async () => {
  __said.length = 0;
  await tracker.start('run', 'beginner'); // 5 min warm-up first
  await run(100);
  await run(220, 5, 0); // stand still: auto-pauses, fixes keep arriving
  assert.equal(tracker.getSession()!.status, 'paused');
  assert.equal(tracker.getSession()!.workout!.index, 1, 'warm-up done while standing');
  assert.ok(__said.some((t) => /Interval 1 of 8/.test(t)), __said.join(' | '));
  await tracker.discard();
});

test('session survives an app restart (file storage)', async () => {
  await tracker.start('ride');
  await run(120, 5, 8);
  await tracker.pause();
  const pts = tracker.getSession()!.segments.flat().length;
  const fresh = await import('../../src/lib/tracker.ts?restart=1');
  await fresh.restore();
  assert.equal(fresh.getSession()!.segments.flat().length, pts);
  await fresh.discard();
  await tracker.discard(); // the first instance still holds it in memory
});

test('a corrupt saved session does not block recording', async () => {
  __files.set('/doc/tbdi-data/session.json', '{"broken');
  const fresh = await import('../../src/lib/tracker.ts?restart=2');
  await fresh.restore();
  assert.equal(fresh.getSession(), null);
  await fresh.start('walk');
  assert.ok(fresh.getSession());
  await fresh.discard();
});

test('a fresh accurate fix right before Start does become the first point', async () => {
  await tracker.ingest([fix(5, 0) as never]);
  await tracker.start('run');
  assert.equal(tracker.getSession()!.segments[0].length, 1);
  await tracker.discard();
});

const act = (id: string, t: number, name = id) => ({ id, name, sport: 'run', startedAt: t, movingSec: 60, elapsedSec: 60, distanceM: 1000, elevGainM: 0,
  segments: [[{ lat: 1, lng: 1, alt: null, acc: 5, t }, { lat: 1.001, lng: 1, alt: null, acc: 5, t: t + 60000 }]] });

test('restore adds only new activities, never overwrites local edits, keeps a concurrent save', async () => {
  await storage.saveActivity(act('a', 1000, 'Marathon PB') as never);
  const doc = JSON.stringify({ format: 'stride-backup', version: 1, activities: [act('a', 1000, 'old name'), ...Array.from({ length: 25 }, (_, i) => act(`r${i}`, 5000 + i))] });
  const [added] = await Promise.all([backup.applyBackup(doc, { includeSettings: false }), storage.saveActivity(act('new', 9999) as never)]);
  assert.equal(added, 25);
  const ids: string[] = JSON.parse(__store.get('stride:activities'));
  assert.ok(ids.includes('new'));
  assert.equal((await storage.getActivity('a'))!.name, 'Marathon PB');
  assert.equal((await storage.listActivities()).filter((x) => /^r\d+$/.test(x.id)).length, 25);
});

test('restore fills profile fields still at defaults, keeps the onboarding name', async () => {
  await AS.setItem('stride:profile', JSON.stringify({ name: 'Ravi', weeklyGoalKm: 20, weightKg: 70, monthlyGoalKm: 80, team: '' }));
  await backup.applyBackup(JSON.stringify({ format: 'stride-backup', version: 1, activities: [],
    profile: { name: 'Old', weeklyGoalKm: 35, weightKg: 62.5, monthlyGoalKm: 150, team: 'Plant 2' } }), { includeSettings: false });
  assert.deepEqual(await storage.getProfile(), { name: 'Ravi', weeklyGoalKm: 35, weightKg: 62.5, monthlyGoalKm: 150, team: 'Plant 2' });
});

test('backups report an unreadable activity; it can still be deleted', async () => {
  __files.set('/doc/tbdi-data/activity-r3.json', '{oops');
  const b = await backup.buildBackup();
  assert.deepEqual(b.unreadable, ['r3']);
  await storage.deleteActivity('r3');
  assert.ok(!JSON.parse(__store.get('stride:activities')).includes('r3'));
});

test('an old cached fix delivered just before Start is not used as the first point', async () => {
  // GPS hands over a 3-hour-old cached position; the recording starts a moment later
  await tracker.ingest([{ coords: { latitude: 10, longitude: 10, altitude: null, accuracy: 5, speed: 0, heading: 0 }, timestamp: clock - 3 * 3600_000 } as never]);
  await tracker.start('run');
  assert.equal(tracker.getSession()!.segments[0].length, 0);
  await tracker.discard();
});

test('live notification: posted while recording, paused title, cleared on finish', async () => {
  const { __notes, __dismissed } = await import('./stubs/notifications.mjs');
  const n0 = __notes.length;
  await tracker.start('run');
  await run(30);
  assert.ok(__notes.length > n0, 'posted a live notification');
  const last = () => __notes[__notes.length - 1];
  assert.equal(last().identifier, 'live-stats');
  assert.match(last().content.title, /^Recording · Run/);
  assert.match(last().content.body, /km · 0:\d\d · /);
  assert.equal(last().content.sticky, true);
  await tracker.pause();
  assert.match(last().content.title, /^Paused/);
  await tracker.resume();
  assert.match(last().content.title, /^Recording/);
  const d0 = (await import('./stubs/notifications.mjs')).__dismissed;
  await tracker.finish();
  assert.equal((await import('./stubs/notifications.mjs')).__dismissed, d0 + 1, 'dismissed on finish');
  void __dismissed;
});

test('saved activity: splits, chord total and best efforts agree with the headline distance', async () => {
  const geo = await import('../../src/lib/geo.ts');
  await tracker.start('run');
  await run(900, 5, 3.2); // ~2.9 km at 3.2 m/s
  await tracker.pause();
  clock += 120_000;
  await tracker.resume();
  await run(400, 5, 3.2);
  const a = (await tracker.finish())!;
  const sp = geo.splits(a.segments);
  const splitTotal = sp.reduce((s, x) => s + x.distanceM, 0);
  assert.ok(Math.abs(splitTotal - a.distanceM) <= 5, `splits ${splitTotal} vs headline ${a.distanceM}`);
  assert.ok(Math.abs(geo.totalDistance(a.segments) - a.distanceM) <= 5, `chords ${geo.totalDistance(a.segments)} vs ${a.distanceM}`);
  assert.ok(a.segments.every((seg) => seg.every((p) => typeof p.d === 'number')), 'every point carries the recorded distance');
  const km = geo.bestEffort(a.segments, 1000)!;
  assert.ok(km > 290 && km < 340, `fastest km ${km} s at 3.2 m/s`);
});

test('auto-pause still fires indoors where every fix is a Wi-Fi fix (acc > 50 m)', async () => {
  await tracker.start('run');
  await run(120, 5, 3);
  assert.equal(tracker.getSession()!.status, 'recording');
  await run(40, 80, 0); // indoors: inaccurate fixes only
  const s = tracker.getSession()!;
  assert.equal(s.status, 'paused', 'auto-paused on unusable fixes');
  assert.equal(s.autoPaused, true);
  const moving = sessionMovingSec(s, clock);
  assert.ok(moving <= 125, `moving time ${moving} s must not count the indoor minutes`);
  await tracker.discard();
});

test('running through a 60 s underpass (only 70 m fixes) is not a pause: moving time and best km stay true', async () => {
  const geo = await import('../../src/lib/geo.ts');
  await tracker.start('run');
  await run(400, 5, 3);
  await run(60, 70, 3); // blind stretch, still running
  await run(400, 5, 3);
  const s = tracker.getSession()!;
  const elapsed = (clock - s.startedAt) / 1000;
  assert.ok(sessionMovingSec(s, clock) >= elapsed - 2, `moving ${sessionMovingSec(s, clock)} of ${elapsed} s`);
  const a = (await tracker.finish())!;
  const km = geo.bestEffort(a.segments, 1000)!;
  assert.ok(km >= 320, `best km ${km} s at a true 333 s (no zero-time jump across the blind stretch)`);
});
