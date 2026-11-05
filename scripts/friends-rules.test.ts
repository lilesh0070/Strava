// Friends feature + firestore.rules, tested against the Firebase Auth and Firestore emulators.
// Run with: npm run test:friends (needs Java; downloads the emulators the first time).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFirebase, FirebaseError } from '../src/lib/firebase.ts';
import { createFriends } from '../src/lib/friends.ts';

const cfg = {
  apiKey: 'fake-api-key', projectId: 'demo-stride',
  authUrl: 'http://127.0.0.1:9099/identitytoolkit.googleapis.com',
  tokenUrl: 'http://127.0.0.1:9099/securetoken.googleapis.com',
  firestoreUrl: 'http://127.0.0.1:8080',
};
const mem = () => { let v: string | null = null; return { get: async () => v, set: async (x: string | null) => { v = x; } }; };
const monday = new Date(2026, 10, 2).getTime();
function device(name: string, weekKm: number) {
  const client = createFirebase(cfg, mem());
  const stats = { name, weekKm, weekStart: monday, monthKm: weekKm * 2, monthStart: new Date(2026, 10, 1).getTime(), totalKm: weekKm * 10 };
  return { client, stats, f: createFriends({ client, kv: mem(), stats: async () => stats }) };
}
const denied = async (p: Promise<unknown>) => {
  await assert.rejects(p, (e: unknown) => e instanceof FirebaseError && e.status === 403, 'expected PERMISSION_DENIED');
};

const A = device('Asha', 12.5), B = device('Bilal', 30), C = device('Chen', 7);
let a = '', b = '', c = '', codeA = '', codeB = '', codeC = '';

test('each phone gets an account and a friend ID', async () => {
  [codeA, codeB, codeC] = [await A.f.enable(), await B.f.enable(), await C.f.enable()];
  [a, b, c] = [(await A.client.uid())!, (await B.client.uid())!, (await C.client.uid())!];
  for (const code of [codeA, codeB, codeC]) assert.match(code, /^STR-[A-Z0-9]{5}$/);
  assert.equal(new Set([codeA, codeB, codeC]).size, 3);
  assert.equal(await A.f.enable(), codeA, 'enable again keeps the same ID');
});

test('a phone restored from Android backup (friend ID kept, sign-in not) gets a new ID instead of failing', async () => {
  const kv = mem();
  await kv.set(JSON.stringify({ code: codeA })); // AsyncStorage came back, SecureStore did not
  const restored = createFriends({ client: createFirebase(cfg, mem()), kv, stats: async () => A.stats });
  const code = await restored.enable();
  assert.notEqual(code, codeA);
  assert.match(code, /^STR-[A-Z0-9]{5}$/);
  assert.equal(await restored.myCode(), code);
});

test('send a request by ID; only the two people can see it', async () => {
  assert.equal(await A.f.sendRequest(codeB.toLowerCase().replace('-', ' ')), 'sent');
  const inB = await B.f.incoming();
  assert.equal(inB.length, 1);
  assert.equal(inB[0].fromName, 'Asha');
  assert.equal((await A.f.outgoing())[0].to, b);
  await denied(C.client.get(`requests/${a}_${b}`));
  await denied(C.client.where('requests', 'to', b));
  await assert.rejects(A.f.sendRequest(codeB), /already sent/);
  await assert.rejects(A.f.sendRequest(codeA), /your own ID/);
  await assert.rejects(A.f.sendRequest('STR-ZZZZZ'), /No one has this ID/);
});

test('before accepting, nobody can see the other profile or make the friendship themselves', async () => {
  await denied(B.client.get(`profiles/${a}`));
  await denied(A.client.get(`profiles/${b}`));
  // the sender can't create the friendship on either side
  await denied(A.client.set(`friends/${a}/list/${b}`, { since: 1 }));
  await denied(A.client.set(`friends/${b}/list/${a}`, { since: 1 }));
  // a stranger can't either
  await denied(C.client.set(`friends/${c}/list/${a}`, { since: 1 }));
});

test('accepting shows both on each other\'s weekly leaderboard', async () => {
  await B.f.accept((await B.f.incoming())[0]);
  assert.equal((await B.f.incoming()).length, 0, 'request removed');
  const boardA = await A.f.board();
  assert.deepEqual(boardA.map((r) => [r.name, r.weekKm, r.rank, r.me]), [['Bilal', 30, 1, false], ['Asha', 12.5, 2, true]]);
  const boardB = await B.f.board();
  assert.deepEqual(boardB.map((r) => r.name), ['Bilal', 'Asha']);
  await assert.rejects(A.f.sendRequest(codeB), /already friends/);
});

test('shared numbers update; a stale week counts as 0', async () => {
  B.stats.weekKm = 41.237;
  await B.f.share();
  assert.equal((await A.f.board())[0].weekKm, 41.24);
  B.stats.weekStart = monday - 7 * 86400000; // B hasn't opened the app since last week
  await B.f.share();
  assert.equal((await A.f.board()).find((r) => r.name === 'Bilal')!.weekKm, 0);
  B.stats.weekStart = monday;
  await B.f.share();
});

test('the rules block forging, extra data and reading strangers', async () => {
  await denied(C.client.get(`profiles/${a}`));
  await denied(C.client.list(`friends/${a}/list`));
  await denied(C.client.list('codes'));
  await denied(A.client.set(`profiles/${b}`, { code: codeB, name: 'x', weekKm: 1, weekStart: monday, updatedAt: 1 }));
  await denied(A.client.set(`profiles/${a}`, { code: codeA, name: 'Asha', weekKm: 1, weekStart: monday, updatedAt: 1, route: { lat: 28.6, lng: 77.2 } }));
  await denied(A.client.set(`profiles/${a}`, { code: codeB, name: 'Asha', weekKm: 1, weekStart: monday, updatedAt: 1 }));
  await denied(A.client.create('requests', `${a}_${c}`, { from: a, to: c, fromName: 'x', fromCode: codeB, createdAt: 1 }));
  await denied(A.client.create('requests', `${b}_${c}`, { from: b, to: c, fromName: 'x', fromCode: codeB, createdAt: 1 }));
  await denied(A.client.create('codes', 'STR-AAAAA', { uid: b }));
  await A.f.share(true); // A's own valid update still works
});

test('if both send requests, the second one accepts', async () => {
  assert.equal(await C.f.sendRequest(codeA), 'sent');
  assert.equal(await A.f.sendRequest(codeC), 'accepted');
  assert.deepEqual((await C.f.board()).map((r) => r.name), ['Asha', 'Chen']);
});

test('decline and cancel', async () => {
  const D = device('Dev', 3);
  const codeD = await D.f.enable();
  await D.f.sendRequest(codeB);
  await B.f.decline((await B.f.incoming())[0]);
  assert.equal((await D.f.outgoing()).length, 0);
  await D.f.sendRequest(codeB);
  await D.f.cancel((await D.f.outgoing())[0]);
  assert.equal((await B.f.incoming()).length, 0);
  assert.ok(codeD);
});

test('removing a friend stops sharing both ways', async () => {
  await A.f.removeFriend(b);
  await denied(B.client.get(`profiles/${a}`));
  await denied(A.client.get(`profiles/${b}`));
  assert.ok(!(await B.f.board()).some((r) => r.name === 'Asha'));
});

test('turning friends off removes the profile, friendships and requests', async () => {
  await C.f.disable();
  assert.equal(await C.f.isEnabled(), false);
  assert.ok(!(await A.f.board()).some((r) => r.name === 'Chen'));
});

test('month and all-time leaderboards use the shared totals', async () => {
  const E = device('Esha', 5), F = device('Farhan', 9);
  const ce = await E.f.enable(); await F.f.enable();
  await F.f.sendRequest(ce);
  await E.f.accept((await E.f.incoming())[0]);
  assert.deepEqual((await E.f.board('month')).map((r) => [r.name, r.weekKm]), [['Farhan', 18], ['Esha', 10]]);
  assert.deepEqual((await E.f.board('all')).map((r) => [r.name, r.weekKm]), [['Farhan', 90], ['Esha', 50]]);
  // a stranger still can't write the new fields, and a profile with an unknown field is rejected
  await denied(E.client.set(`profiles/${await F.client.uid()}`, { code: 'x', name: 'x', weekKm: 1, weekStart: 1, monthKm: 1, monthStart: 1, totalKm: 1, updatedAt: 1 }));
  await denied(E.client.set(`profiles/${await E.client.uid()}`, { code: ce, name: 'Esha', weekKm: 1, weekStart: 1, updatedAt: 1, lat: 28.6 }));
});
