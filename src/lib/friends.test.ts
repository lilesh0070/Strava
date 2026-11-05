import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeFields, encodeFields } from './firebase.ts';
import { currentWeekKm, normalizeCode, randomCode, rankBoard } from './friends.ts';

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
