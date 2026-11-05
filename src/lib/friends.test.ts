import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeFields, encodeFields } from './firebase.ts';
import { currentWeekKm, myPeriodKm, normalizeCode, periodKm, randomCode, rankBoard } from './friends.ts';

test('friend IDs: format and normalising what people type', () => {
  for (let i = 0; i < 200; i++) assert.match(randomCode(), /^STR-[A-HJ-NP-Z2-9]{5}$/); // no 0/O/1/I
  assert.equal(normalizeCode('str-7k3p9'), 'STR-7K3P9');
  assert.equal(normalizeCode(' STR 7K3P9 '), 'STR-7K3P9');
  assert.equal(normalizeCode('7k3p9'), 'STR-7K3P9');
  assert.equal(normalizeCode('STRAB'), 'STR-STRAB'); // an ID whose letters start with STR
  assert.equal(normalizeCode('STR-7K3P'), null);
  assert.equal(normalizeCode(''), null);
});

test('leaderboard: most km first, ties share a rank', () => {
  const rows = rankBoard([
    { uid: 'a', name: 'Asha', weekKm: 12, me: true }, { uid: 'b', name: 'Bilal', weekKm: 30, me: false },
    { uid: 'c', name: 'Chen', weekKm: 12, me: false }, { uid: 'd', name: 'Dev', weekKm: 0, me: false },
  ]);
  assert.deepEqual(rows.map((r) => [r.name, r.rank]), [['Bilal', 1], ['Asha', 2], ['Chen', 2], ['Dev', 4]]);
});

test("a friend's km from an earlier week counts as 0", () => {
  const monday = new Date(2026, 10, 2).getTime();
  assert.equal(currentWeekKm({ weekKm: 18.5, weekStart: monday }, monday), 18.5);
  assert.equal(currentWeekKm({ weekKm: 18.5, weekStart: monday - 7 * 86400000 }, monday), 0);
  assert.equal(currentWeekKm({ weekKm: 9, weekStart: monday - 5 * 3600000 }, monday), 9); // friend a few hours behind
  assert.equal(currentWeekKm({ weekKm: 'x', weekStart: monday }, monday), 0);
  assert.equal(currentWeekKm({}, monday), 0);
});

test('Firestore field encoding round-trips', () => {
  const doc = { name: 'Asha', weekKm: 12.34, weekStart: 1793577600000, ok: true, none: null, tags: ['a', 'b'], m: { x: 1 } };
  const f = encodeFields(doc);
  assert.deepEqual(f.weekStart, { integerValue: '1793577600000' });
  assert.deepEqual(f.weekKm, { doubleValue: 12.34 });
  assert.deepEqual(decodeFields(f), doc);
});

test('period km: week, month (with grace) and all-time', () => {
  const monday = new Date(2026, 10, 2).getTime(), month1 = new Date(2026, 10, 1).getTime();
  const mine = { name: 'me', weekKm: 1, weekStart: monday, monthKm: 2, monthStart: month1, totalKm: 3 };
  const friend = { weekKm: 10, weekStart: monday, monthKm: 40, monthStart: month1, totalKm: 400 };
  assert.equal(periodKm(friend, 'week', mine), 10);
  assert.equal(periodKm(friend, 'month', mine), 40);
  assert.equal(periodKm(friend, 'all', mine), 400);
  assert.equal(periodKm({ ...friend, monthStart: month1 - 40 * 86400000 }, 'month', mine), 0); // last month's number
  assert.equal(periodKm({ weekKm: 10, weekStart: monday }, 'month', mine), 0); // older app without month data
  assert.equal(periodKm({ weekKm: 10, weekStart: monday }, 'all', mine), 0);
  assert.deepEqual(['week', 'month', 'all'].map((p) => myPeriodKm(mine, p as never)), [1, 2, 3]);
});

test('share: rules published before v1.3.9 reject month/all-time fields → weekly profile still written, retried later', async () => {
  const { createFriends } = await import('./friends.ts');
  const { FirebaseError } = await import('./firebase.ts');
  let clock = Date.UTC(2026, 10, 4, 12);
  let newRules = false;
  const writes: Record<string, unknown>[] = [];
  const client = {
    uid: async () => 'u1', signIn: async () => 'u1', get: async () => null, create: async () => undefined,
    set: async (_path: string, doc: Record<string, unknown>) => {
      if (!newRules && 'monthKm' in doc) throw new FirebaseError('PERMISSION_DENIED', 403);
      writes.push(doc);
    },
  } as unknown as Parameters<typeof createFriends>[0]['client'];
  let kvVal: string | null = null;
  let stats = { name: 'Asha', weekKm: 5, weekStart: 0, monthKm: 20, monthStart: 0, totalKm: 100 };
  const f = createFriends({ client, kv: { get: async () => kvVal, set: async (v: string | null) => { kvVal = v; } }, stats: async () => stats, now: () => clock });
  await f.enable();
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0]).sort(), ['code', 'name', 'updatedAt', 'weekKm', 'weekStart']);
  // a new run: weekly fields only, no wasted full write while the old rules are known to be up
  stats = { ...stats, weekKm: 8 };
  await f.share();
  assert.equal(writes.length, 2);
  assert.equal(writes[1].weekKm, 8);
  assert.ok(!('monthKm' in writes[1]));
  // nothing changed: nothing written
  await f.share();
  assert.equal(writes.length, 2);
  // rules published; after the retry window the full profile goes up on its own
  newRules = true;
  clock += 7 * 3600_000;
  await f.share();
  assert.equal(writes.length, 3);
  assert.equal(writes[2].monthKm, 20);
  assert.equal(writes[2].totalKm, 100);
});

test('enable: a friend ID restored without its sign-in (Android backup to a new phone) is replaced, not reused', async () => {
  const { createFriends } = await import('./friends.ts');
  const codes: Record<string, { uid: string }> = { 'STR-OLD22': { uid: 'old-phone' } };
  const writes: Record<string, unknown>[] = [];
  const client = {
    uid: async () => 'new-phone', signIn: async () => 'new-phone',
    get: async (path: string) => (path.startsWith('codes/') ? codes[path.slice(6)] ?? null : null),
    create: async (_col: string, id: string, data: { uid: string }) => { codes[id] = data; },
    set: async (_path: string, doc: Record<string, unknown>) => { writes.push(doc); },
  } as unknown as Parameters<typeof createFriends>[0]['client'];
  let kvVal: string | null = JSON.stringify({ code: 'STR-OLD22' }); // restored from the old phone's AsyncStorage
  const stats = { name: 'Asha', weekKm: 5, weekStart: 0, monthKm: 20, monthStart: 0, totalKm: 100 };
  const f = createFriends({ client, kv: { get: async () => kvVal, set: async (v: string | null) => { kvVal = v; } }, stats: async () => stats });
  const code = await f.enable();
  assert.notEqual(code, 'STR-OLD22');
  assert.equal(codes[code].uid, 'new-phone');
  assert.equal(JSON.parse(kvVal!).code, code);
  assert.equal(writes.at(-1)?.code, code);
  // its own ID is kept from then on
  assert.equal(await f.enable(), code);
  assert.equal(Object.keys(codes).length, 2);
});
