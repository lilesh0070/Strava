// Friends and the weekly leaderboard. Each phone gets a friend ID (e.g. STR-7K3P9). Entering a
// friend's ID sends them a request; once they accept, both see each other's distance this week.
// Only the profile name and this week's km are shared: never routes, locations or notes.
// Pure logic over a FirebaseClient (no React Native imports), so it can be tested with the emulators.
import { FirebaseError, type FirebaseClient } from './firebase';

export type FriendRequest = { from: string; to: string; fromName: string; fromCode: string; toCode: string; createdAt: number };
export type BoardRow = { uid: string; name: string; weekKm: number; me: boolean; rank: number; updatedAt?: number };
export type MyStats = { name: string; weekKm: number; weekStart: number };
/** Small local store for this phone's friend ID and what was last shared. */
export type KV = { get(): Promise<string | null>; set(value: string): Promise<void> };

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I, so IDs are easy to read out
export function randomCode(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return `STR-${s}`;
}
/** "str 7k3p9", "STR-7K3P9" or "7k3p9" → "STR-7K3P9"; null if it isn't an ID. */
export function normalizeCode(input: string): string | null {
  const t = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = t.length === 8 && t.startsWith('STR') ? t.slice(3) : t;
  return /^[A-Z0-9]{5}$/.test(body) ? `STR-${body}` : null;
}

/** Friends' weeks start in their own time zone, so allow a day and a half either way. */
const WEEK_GRACE_MS = 36 * 3600_000;
/** A friend's km for the current week: 0 if what they last shared is from an earlier week. */
export function currentWeekKm(p: { weekKm?: unknown; weekStart?: unknown }, myWeekStart: number): number {
  const ws = Number(p.weekStart);
  return Number.isFinite(ws) && ws >= myWeekStart - WEEK_GRACE_MS ? Math.max(0, Number(p.weekKm) || 0) : 0;
}
/** Most km first; equal distances share a rank. */
export function rankBoard(rows: Omit<BoardRow, 'rank'>[]): BoardRow[] {
  const sorted = [...rows].sort((a, b) => b.weekKm - a.weekKm || a.name.localeCompare(b.name));
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || sorted[i - 1].weekKm !== r.weekKm) rank = i + 1;
    return { ...r, rank };
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function createFriends(d: { client: FirebaseClient; kv: KV; stats: () => Promise<MyStats>; now?: () => number }) {
  const now = d.now ?? Date.now;
  type Local = { code?: string; shared?: MyStats };
  let local: Local | null = null;
  const loadLocal = async (): Promise<Local> => (local ??= JSON.parse((await d.kv.get()) ?? '{}') as Local);
  const saveLocal = async (patch: Partial<Local>) => {
    local = { ...(await loadLocal()), ...patch };
    await d.kv.set(JSON.stringify(local));
  };
  const me = async () => {
    const uid = await d.client.uid();
    if (!uid) throw new Error('Turn on friends first.');
    return uid;
  };

  async function isEnabled() { return !!(await d.client.uid()) && !!(await loadLocal()).code; }
  async function myCode() { return (await loadLocal()).code ?? null; }

  /** Create this phone's account and friend ID (once) and share this week's km. Returns the ID. */
  async function enable(): Promise<string> {
    const uid = await d.client.signIn();
    let { code } = await loadLocal();
    if (!code) {
      const prof = await d.client.get(`profiles/${uid}`); // account kept but local data cleared
      if (typeof prof?.code === 'string') code = prof.code;
    }
    for (let i = 0; !code && i < 8; i++) {
      const c = randomCode();
      try { await d.client.create('codes', c, { uid }); code = c; }
      catch (e) { if (!(e instanceof FirebaseError && e.status === 409)) throw e; } // taken: try another
    }
    if (!code) throw new Error('Could not create a friend ID. Please try again.');
    await saveLocal({ code });
    await share(true);
    return code;
  }

  let sharing: Promise<void> | null = null;
  let again = false;
  /** Update what friends see (name + this week's km), only when it changed. */
  function share(force = false): Promise<void> {
    if (sharing) { again = true; return sharing; } // runs once more after the current upload
    sharing = (async () => {
      try {
        do {
          again = false;
          if (!(await isEnabled())) return;
          const s = await d.stats();
          const l = await loadLocal();
          const p = l.shared;
          if (force || !p || p.name !== s.name || p.weekStart !== s.weekStart || Math.abs(p.weekKm - s.weekKm) >= 0.005) {
            await d.client.set(`profiles/${await me()}`, {
              code: l.code!, name: s.name.slice(0, 40), weekKm: round2(Math.max(0, s.weekKm)), weekStart: s.weekStart, updatedAt: now(),
            });
            await saveLocal({ shared: { ...s } });
          }
          force = false;
        } while (again);
      } finally {
        sharing = null;
      }
    })();
    return sharing;
  }

  const toRequest = (x: { data: Record<string, unknown> }): FriendRequest => ({
    from: String(x.data.from), to: String(x.data.to), fromName: String(x.data.fromName ?? ''),
    fromCode: String(x.data.fromCode ?? ''), toCode: String(x.data.toCode ?? ''), createdAt: Number(x.data.createdAt) || 0,
  });
  async function incoming() { return (await d.client.where('requests', 'to', await me())).map(toRequest); }
  async function outgoing() { return (await d.client.where('requests', 'from', await me())).map(toRequest); }
  async function friendIds() { return (await d.client.list(`friends/${await me()}/list`)).map((f) => f.id); }

  async function accept(r: FriendRequest) {
    const uid = await me();
    const t = now();
    await d.client.commit([
      { set: `friends/${uid}/list/${r.from}`, data: { since: t } },
      { set: `friends/${r.from}/list/${uid}`, data: { since: t } },
      { remove: `requests/${r.from}_${uid}` },
    ]);
  }
  async function decline(r: FriendRequest) { await d.client.remove(`requests/${r.from}_${await me()}`); }
  async function cancel(r: FriendRequest) { await d.client.remove(`requests/${await me()}_${r.to}`); }
  async function removeFriend(uid: string) {
    const mine = await me();
    await d.client.commit([{ remove: `friends/${mine}/list/${uid}` }, { remove: `friends/${uid}/list/${mine}` }]);
  }

  /** Send a friend request to this ID. If they already asked us, it is accepted straight away. */
  async function sendRequest(input: string): Promise<'sent' | 'accepted'> {
    const code = normalizeCode(input);
    if (!code) throw new Error('A friend ID looks like STR-7K3P9.');
    const uid = await me();
    const l = await loadLocal();
    if (code === l.code) throw new Error('That is your own ID. Ask your friend for theirs.');
    const target = await d.client.get(`codes/${code}`);
    const to = typeof target?.uid === 'string' ? target.uid : null;
    if (!to) throw new Error('No one has this ID. Check it and try again.');
    if ((await friendIds()).includes(to)) throw new Error('You are already friends.');
    const theirs = (await incoming()).find((r) => r.from === to);
    if (theirs) { await accept(theirs); return 'accepted'; }
    if ((await outgoing()).some((r) => r.to === to)) throw new Error('Request already sent. Ask them to accept it.');
    const s = await d.stats();
    await d.client.create('requests', `${uid}_${to}`, { from: uid, to, fromName: s.name.slice(0, 40), fromCode: l.code!, toCode: code, createdAt: now() });
    return 'sent';
  }

  /** This week's leaderboard: you and every friend. */
  async function board(): Promise<BoardRow[]> {
    const uid = await me();
    const s = await d.stats();
    const ids = await friendIds();
    const profiles = await Promise.all(ids.map((id) => d.client.get(`profiles/${id}`).catch(() => null)));
    return rankBoard([
      { uid, name: s.name, weekKm: s.weekKm, me: true },
      ...ids.map((id, i) => {
        const p = profiles[i];
        return { uid: id, name: typeof p?.name === 'string' && p.name ? p.name : 'Friend', weekKm: p ? currentWeekKm(p, s.weekStart) : 0,
          me: false, updatedAt: Number(p?.updatedAt) || undefined };
      }),
    ]);
  }

  /** Stop sharing: remove every friendship, pending request and the shared profile, then sign out. */
  async function disable() {
    const uid = await me();
    const [ids, ins, outs] = await Promise.all([friendIds(), incoming(), outgoing()]);
    await d.client.commit([
      ...ids.flatMap((id) => [{ remove: `friends/${uid}/list/${id}` }, { remove: `friends/${id}/list/${uid}` }]),
      ...ins.map((r) => ({ remove: `requests/${r.from}_${uid}` })),
      ...outs.map((r) => ({ remove: `requests/${uid}_${r.to}` })),
      { remove: `profiles/${uid}` },
    ]);
    await d.client.signOut();
    local = {};
    await d.kv.set('{}');
  }

  return { isEnabled, myCode, enable, share, incoming, outgoing, accept, decline, cancel, removeFriend, sendRequest, board, disable };
}
export type Friends = ReturnType<typeof createFriends>;
