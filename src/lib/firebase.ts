// A small Firebase client over its REST APIs: anonymous sign-in and Firestore documents.
// No Firebase SDK: it keeps the app small and needs no native module. What each user may read or write
// is enforced on the server by the rules in /firestore.rules, not by this code.
// Pure TypeScript (no React Native imports), so it can be tested against the Firebase emulators.

export type FirebaseConfig = {
  apiKey: string;
  projectId: string;
  /** Overrides for the emulators; the defaults are the real Google endpoints. */
  authUrl?: string;
  tokenUrl?: string;
  firestoreUrl?: string;
};
/** Where the sign-in (uid + refresh token) is kept between launches, e.g. the secure keystore. */
export type CredStore = { get(): Promise<string | null>; set(value: string | null): Promise<void> };

type Value = {
  nullValue?: null; booleanValue?: boolean; integerValue?: string; doubleValue?: number; stringValue?: string;
  timestampValue?: string; mapValue?: { fields?: Record<string, Value> }; arrayValue?: { values?: Value[] };
};
export type Doc = Record<string, unknown>;
export type Write = { set: string; data: Doc } | { remove: string };

/** Plain-language hints for setup mistakes in the Firebase console (see README → Friends & leaderboard). */
function friendlyMessage(raw: string, status: number): string {
  if (/OPERATION_NOT_ALLOWED|ADMIN_ONLY_OPERATION/.test(raw)) return 'Anonymous sign-in is off in Firebase (Authentication → Sign-in method → Anonymous).';
  if (/API_KEY_INVALID|API key not valid/i.test(raw)) return 'The Firebase API key in app.json is not valid.';
  if (/database.*does not exist/i.test(raw)) return 'Firestore is not created yet in this Firebase project.';
  if (status === 403 && /PERMISSION_DENIED|permission/i.test(raw)) return 'Not allowed. (If this keeps happening, check that firestore.rules is published.)';
  return raw || `Server error ${status}`;
}

export class FirebaseError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------- Firestore value encoding ----------
function encode(v: unknown): Value {
  if (v == null) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v as Doc) } };
  throw new Error(`Can't store a ${typeof v} in Firestore`);
}
function decode(v: Value): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue!);
  if ('mapValue' in v) return decodeFields(v.mapValue!.fields);
  if ('arrayValue' in v) return (v.arrayValue!.values ?? []).map(decode);
  return null;
}
export const encodeFields = (o: Doc): Record<string, Value> =>
  Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined).map(([k, x]) => [k, encode(x)]));
export const decodeFields = (f?: Record<string, Value>): Doc =>
  Object.fromEntries(Object.entries(f ?? {}).map(([k, x]) => [k, decode(x)]));

type RawDoc = { name: string; fields?: Record<string, Value> };
const docId = (d: RawDoc) => d.name.slice(d.name.lastIndexOf('/') + 1);

export function createFirebase(cfg: FirebaseConfig, store: CredStore) {
  const authUrl = cfg.authUrl ?? 'https://identitytoolkit.googleapis.com';
  const tokenUrl = cfg.tokenUrl ?? 'https://securetoken.googleapis.com';
  const root = `projects/${cfg.projectId}/databases/(default)/documents`;
  const base = `${cfg.firestoreUrl ?? 'https://firestore.googleapis.com'}/v1/${root}`;

  let creds: { uid: string; refreshToken: string } | null | undefined; // undefined: not read yet
  let idToken: { token: string; exp: number } | null = null;

  const loadCreds = async () => {
    if (creds === undefined) {
      const raw = await store.get();
      creds = raw ? JSON.parse(raw) : null;
    }
    return creds ?? null;
  };
  const saveCreds = async (c: { uid: string; refreshToken: string } | null) => {
    creds = c;
    await store.set(c ? JSON.stringify(c) : null);
  };

  async function call(url: string, init: RequestInit) {
    let res: Response;
    try { res = await fetch(url, init); }
    catch { throw new FirebaseError('No internet connection. Try again when you are online.', 0, 'OFFLINE'); }
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const err = (Array.isArray(body) ? body[0] : body)?.error ?? {};
      throw new FirebaseError(friendlyMessage(String(err.message ?? ''), res.status), res.status, err.status);
    }
    return body;
  }

  /** Sign in anonymously once; later launches reuse the stored account. Returns the user id. */
  async function signIn(): Promise<string> {
    const c = await loadCreds();
    if (c) return c.uid;
    const r = await call(`${authUrl}/v1/accounts:signUp?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
    });
    idToken = { token: r.idToken, exp: Date.now() + Number(r.expiresIn) * 1000 };
    await saveCreds({ uid: r.localId, refreshToken: r.refreshToken });
    return r.localId;
  }

  async function token(): Promise<string> {
    if (idToken && idToken.exp - Date.now() > 60_000) return idToken.token;
    const c = await loadCreds();
    if (!c) throw new FirebaseError('Not signed in', 401, 'UNAUTHENTICATED');
    const r = await call(`${tokenUrl}/v1/token?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(c.refreshToken)}`,
    });
    idToken = { token: r.id_token, exp: Date.now() + Number(r.expires_in) * 1000 };
    if (r.refresh_token && r.refresh_token !== c.refreshToken) await saveCreds({ uid: c.uid, refreshToken: r.refresh_token });
    return idToken.token;
  }

  const fs = async (path: string, init: RequestInit = {}) =>
    call(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' } });
  const fullName = (path: string) => `${root}/${path}`;

  return {
    uid: async () => (await loadCreds())?.uid ?? null,
    signIn,
    async signOut() { idToken = null; await saveCreds(null); },

    /** The document's fields, or null if it doesn't exist. */
    async get(path: string): Promise<Doc | null> {
      try { return decodeFields(((await fs(`/${path}`)) as RawDoc).fields); }
      catch (e) { if (e instanceof FirebaseError && e.status === 404) return null; throw e; }
    },
    /** Create a document with this id; fails with status 409 if it already exists. */
    async create(collection: string, id: string, data: Doc) {
      await fs(`/${collection}?documentId=${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ fields: encodeFields(data) }) });
    },
    /** Create or replace a document. */
    async set(path: string, data: Doc) {
      await fs(`/${path}`, { method: 'PATCH', body: JSON.stringify({ fields: encodeFields(data) }) });
    },
    async remove(path: string) { await fs(`/${path}`, { method: 'DELETE' }); },

    /** Every document in a collection (all pages). */
    async list(collection: string): Promise<{ id: string; data: Doc }[]> {
      const out: { id: string; data: Doc }[] = [];
      let page = '';
      do {
        const r = await fs(`/${collection}?pageSize=300${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
        for (const d of (r.documents ?? []) as RawDoc[]) out.push({ id: docId(d), data: decodeFields(d.fields) });
        page = r.nextPageToken ?? '';
      } while (page);
      return out;
    },
    /** Documents of a top-level collection whose `field` equals `value`. */
    async where(collection: string, field: string, value: string | number): Promise<{ id: string; data: Doc }[]> {
      const rows = await fs(':runQuery', {
        method: 'POST',
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: encode(value) } } } }),
      });
      return (rows as { document?: RawDoc }[]).filter((r) => r.document).map((r) => ({ id: docId(r.document!), data: decodeFields(r.document!.fields) }));
    },
    /** Several writes that all succeed or all fail. */
    async commit(writes: Write[]) {
      await fs(':commit', {
        method: 'POST',
        body: JSON.stringify({ writes: writes.map((w) => ('set' in w ? { update: { name: fullName(w.set), fields: encodeFields(w.data) } } : { delete: fullName(w.remove) })) }),
      });
    },
  };
}
export type FirebaseClient = ReturnType<typeof createFirebase>;
