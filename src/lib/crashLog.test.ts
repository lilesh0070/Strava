import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addCrash, crashEntry, crashReport, emptyCrashLog, errorKey, errorText, MAX_ENTRIES, parseCrashLog, unseenFatal, userError, type CrashEntry } from './crashLog.ts';
import { translate, type Key } from './strings.ts';

const meta = (at: number) => ({ at, v: '1.3.11', b: '14' });

test('an entry keeps the message and the top of the stack, not the whole trace', () => {
  const e = new Error('boom');
  e.stack = ['Error: boom', ...Array.from({ length: 40 }, (_, i) => `    at fn${i} (index.android.bundle:1:${i})`)].join('\n');
  const c = crashEntry(e, 'fatal', meta(1000));
  assert.equal(c.msg, 'boom');
  assert.equal(c.kind, 'fatal');
  assert.equal(c.v, '1.3.11');
  assert.ok(!c.stack.includes('Error: boom'), 'the message line is not repeated');
  assert.ok(c.stack.startsWith('at fn0'));
  assert.ok(c.stack.split('\n').length <= 14);
  assert.ok(c.stack.length <= 1500);
  // error subclasses keep their name; non-Error values still give a message
  assert.equal(crashEntry(new TypeError('x is undefined'), 'error', meta(1)).msg, 'TypeError: x is undefined');
  assert.equal(crashEntry('plain string', 'promise', meta(1)).msg, 'plain string');
  assert.equal(crashEntry({ code: 7 }, 'promise', meta(1)).msg, '{"code":7}');
  assert.equal(crashEntry(undefined, 'promise', meta(1)).msg, 'undefined');
  assert.equal(crashEntry(new Error('y'.repeat(2000)), 'error', meta(1)).msg.length, 500);
});

test('the log keeps the newest entries and counts repeats instead of filling up', () => {
  let log = emptyCrashLog();
  for (let i = 0; i < MAX_ENTRIES + 5; i++) log = addCrash(log, crashEntry(new Error(`e${i}`), 'error', meta(i)));
  assert.equal(log.entries.length, MAX_ENTRIES);
  assert.equal(log.entries[0].msg, 'e5');
  assert.equal(log.entries[MAX_ENTRIES - 1].msg, `e${MAX_ENTRIES + 4}`);

  const same = () => { const e = new Error('again'); e.stack = 'Error: again\n at a'; return e; };
  log = addCrash(log, crashEntry(same(), 'promise', meta(100)));
  log = addCrash(log, crashEntry(same(), 'promise', meta(200)));
  log = addCrash(log, crashEntry(same(), 'promise', meta(300)));
  const last = log.entries[log.entries.length - 1];
  assert.equal(last.n, 3);
  assert.equal(last.at, 300);
  assert.equal(log.entries.filter((e) => e.msg === 'again').length, 1);
});

test('a stored log survives a round trip, and damaged files read as empty', () => {
  const log = addCrash({ seenAt: 50, entries: [] }, crashEntry(new Error('saved'), 'fatal', meta(100)));
  assert.deepEqual(parseCrashLog(JSON.stringify(log)), log);
  for (const bad of [null, '', '{"broken', 'null', '42', '[]']) assert.deepEqual(parseCrashLog(bad), emptyCrashLog(), String(bad));
  const mixed = parseCrashLog(JSON.stringify({ seenAt: 'x', entries: [null, { at: 1, kind: 'nope' }, { at: 2, kind: 'render', msg: 3 }] }));
  assert.equal(mixed.seenAt, 0);
  assert.deepEqual(mixed.entries, [{ at: 2, kind: 'render', v: '', b: '', msg: '', stack: '' }]);
});

test('only a crash that closed the app, and only once, is mentioned at the next launch', () => {
  const entry = (at: number, kind: CrashEntry['kind']): CrashEntry => ({ at, kind, v: '1', b: '1', msg: kind, stack: '' });
  assert.equal(unseenFatal({ seenAt: 0, entries: [] }), null);
  assert.equal(unseenFatal({ seenAt: 0, entries: [entry(1, 'render'), entry(2, 'promise')] }), null);
  assert.equal(unseenFatal({ seenAt: 0, entries: [entry(1, 'fatal'), entry(2, 'promise')] })?.at, 1);
  assert.equal(unseenFatal({ seenAt: 5, entries: [entry(1, 'fatal'), entry(6, 'error')] }), null);
  assert.equal(unseenFatal({ seenAt: 5, entries: [entry(4, 'fatal'), entry(6, 'fatal')] })?.at, 6);
});

test('the report lists the newest error first under the app and phone line', () => {
  const a = crashEntry(new Error('first'), 'render', meta(Date.UTC(2026, 10, 5, 8, 0, 0)));
  const b = { ...crashEntry(new Error('second'), 'fatal', meta(Date.UTC(2026, 10, 5, 9, 30, 0))), n: 2 };
  const text = crashReport([a, b], 'TBDI FitTrack 1.3.11 (build 14) · android 34');
  assert.ok(text.startsWith('TBDI FitTrack 1.3.11 (build 14) · android 34\n\n2026-11-05 09:30:00 UTC · fatal ×2 · v1.3.11 (14)\nsecond'));
  assert.ok(text.indexOf('second') < text.indexOf('first'));
  assert.match(crashReport([], 'x'), /no errors recorded/);
});

test('common failures become a short translated message instead of the raw text', () => {
  const cases: [unknown, Key | null][] = [
    [new Error("Call to function 'FileSystemFile.write' has been rejected.\n→ Caused by: java.io.IOException: No space left on device"), 'crash.errDisk'],
    [new TypeError('Network request failed'), 'crash.errOffline'],
    ['No internet connection. Connect to Wi-Fi or mobile data and try again.', 'crash.errOffline'],
    [new Error('GitHub responded 429'), 'crash.errBusy'],
    [new Error('That file is not valid JSON.'), 'crash.errBadFile'],
    [new SyntaxError('JSON Parse error: Unexpected end of input'), 'crash.errBadFile'],
    [new Error('That file is not a TBDI FitTrack backup.'), 'crash.errNotBackup'],
    [new Error('java.lang.SecurityException: Permission Denial: opening provider'), 'crash.errPermission'],
    [new Error('undefined is not a function'), null],
  ];
  for (const [e, key] of cases) assert.equal(errorKey(e), key, errorText(e));

  const hi = (k: Key) => translate('hi', k);
  assert.equal(userError(hi, new Error('ENOSPC: no space left')), translate('hi', 'crash.errDisk'));
  assert.equal(userError(hi, new Error('undefined is not a function')), translate('hi', 'crash.errGeneric'));
  assert.equal(userError(hi, 'The download was incomplete. Please try again.', 'raw'), 'The download was incomplete. Please try again.');
  // every message the mapper can return exists in both languages
  for (const k of ['crash.errDisk', 'crash.errOffline', 'crash.errBusy', 'crash.errBadFile', 'crash.errNotBackup', 'crash.errPermission', 'crash.errGeneric'] as Key[]) {
    assert.notEqual(translate('hi', k), translate('en', k), k);
  }
});
