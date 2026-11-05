// The crash log's data and texts: what one entry holds, how the short list is kept, the report a user
// copies or shares, and the translated message shown instead of a raw technical error. No React
// Native imports, so it is unit-tested (crashLog.test.ts); crashHandler.ts stores the log in a file
// and installs the global error handler.
import type { Key } from './strings';

/**
 * fatal: an uncaught error that closed the app. error: an uncaught non-fatal error. promise: an
 * unhandled promise rejection (release builds only). render: a screen crashed and showed the crash
 * screen. caught: an error a screen handled and showed as a short message.
 */
export type CrashKind = 'fatal' | 'error' | 'promise' | 'render' | 'caught';
export type CrashEntry = {
  at: number;
  kind: CrashKind;
  /** App version and build number at the time. */
  v: string;
  b: string;
  msg: string;
  /** The first lines of the stack trace. */
  stack: string;
  /** How many times in a row this same error happened (absent = once). */
  n?: number;
};
export type CrashLog = {
  /** Fatal crashes up to this time were already reported to the user at launch. */
  seenAt: number;
  entries: CrashEntry[]; // oldest first
};

export const MAX_ENTRIES = 8;
const MAX_MSG = 500;
const MAX_STACK = 1500;
const STACK_LINES = 14;
const KINDS: CrashKind[] = ['fatal', 'error', 'promise', 'render', 'caught'];

export const emptyCrashLog = (): CrashLog => ({ seenAt: 0, entries: [] });

/** The message of anything that was thrown (an Error, a string, a rejected value). */
export function errorText(e: unknown): string {
  if (e == null) return String(e);
  if (typeof e === 'string') return e;
  const m = (e as { message?: unknown }).message;
  if (typeof m === 'string' && m) return m;
  try { return JSON.stringify(e) ?? String(e); } catch { return String(e); }
}

function stackHead(e: unknown, msg: string): string {
  const raw = (e as { stack?: unknown } | null)?.stack;
  if (typeof raw !== 'string' || !raw) return '';
  let lines = raw.split('\n');
  // Hermes and V8 start the stack with "Error: <message>", which the entry already holds
  if (lines[0]?.includes(msg)) lines = lines.slice(1);
  return lines.map((l) => l.trim()).filter(Boolean).slice(0, STACK_LINES).join('\n').slice(0, MAX_STACK);
}

export function crashEntry(e: unknown, kind: CrashKind, meta: { at: number; v: string; b: string }): CrashEntry {
  const msg = errorText(e);
  const name = (e as { name?: unknown } | null)?.name;
  const title = typeof name === 'string' && name && name !== 'Error' && !msg.startsWith(name) ? `${name}: ${msg}` : msg;
  return { at: meta.at, kind, v: meta.v, b: meta.b, msg: title.slice(0, MAX_MSG), stack: stackHead(e, msg) };
}

/** Add an entry, keeping only the newest `max`. The same error again right after counts up instead of filling the list. */
export function addCrash(log: CrashLog, entry: CrashEntry, max = MAX_ENTRIES): CrashLog {
  const last = log.entries[log.entries.length - 1];
  if (last && last.kind === entry.kind && last.msg === entry.msg && last.stack === entry.stack) {
    return { ...log, entries: [...log.entries.slice(0, -1), { ...entry, n: (last.n ?? 1) + 1 }] };
  }
  return { ...log, entries: [...log.entries, entry].slice(-max) };
}

/** Read a stored log; anything damaged or unknown is dropped instead of failing. */
export function parseCrashLog(text: string | null | undefined): CrashLog {
  if (!text) return emptyCrashLog();
  let data: unknown;
  try { data = JSON.parse(text); } catch { return emptyCrashLog(); }
  if (!data || typeof data !== 'object') return emptyCrashLog();
  const d = data as { seenAt?: unknown; entries?: unknown };
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const entries = (Array.isArray(d.entries) ? d.entries : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .filter((x) => typeof x.at === 'number' && Number.isFinite(x.at) && KINDS.includes(x.kind as CrashKind))
    .map((x): CrashEntry => ({
      at: x.at as number, kind: x.kind as CrashKind, v: str(x.v), b: str(x.b), msg: str(x.msg), stack: str(x.stack),
      ...(typeof x.n === 'number' && x.n > 1 ? { n: x.n } : {}),
    }))
    .slice(-MAX_ENTRIES);
  return { seenAt: typeof d.seenAt === 'number' && Number.isFinite(d.seenAt) ? d.seenAt : 0, entries };
}

/** The newest crash that closed the app and hasn't been mentioned to the user yet. */
export function unseenFatal(log: CrashLog): CrashEntry | null {
  for (let i = log.entries.length - 1; i >= 0; i--) {
    const e = log.entries[i];
    if (e.at <= log.seenAt) return null;
    if (e.kind === 'fatal') return e;
  }
  return null;
}

const iso = (t: number) => new Date(t).toISOString().replace('T', ' ').slice(0, 19);

/** Plain-text report (newest first) for the clipboard or the share sheet; `header` is the app and phone line. */
export function crashReport(entries: CrashEntry[], header: string): string {
  const blocks = [...entries].reverse().map((e) => [
    `${iso(e.at)} UTC · ${e.kind}${e.n ? ` ×${e.n}` : ''} · v${e.v || '?'} (${e.b || '?'})`,
    e.msg,
    e.stack,
  ].filter(Boolean).join('\n'));
  return [header, ...(blocks.length ? blocks : ['(no errors recorded)'])].join('\n\n');
}

// ---------- short, translated messages instead of raw errors ----------
type ErrKey = Extract<Key, `crash.err${string}`>;
const PATTERNS: [RegExp, ErrKey][] = [
  [/no space left|ENOSPC|disk (is )?full|not enough (free )?(space|storage)|insufficient storage|SQLITE_FULL/i, 'crash.errDisk'],
  [/network request failed|failed to fetch|unable to resolve host|timed? ?out|offline|ENOTFOUND|UnknownHost|No internet connection|network is unreachable|ECONNREFUSED|ECONNRESET|Software caused connection abort/i, 'crash.errOffline'],
  [/\b(403|429)\b|rate limit|GitHub is busy/i, 'crash.errBusy'],
  [/not a TBDI FitTrack backup/i, 'crash.errNotBackup'],
  [/not valid JSON|JSON Parse error|Unexpected (token|end of (JSON )?input|character)|Unterminated string/i, 'crash.errBadFile'],
  [/permission|EACCES|EPERM|SecurityException|not authori[sz]ed|access (is )?denied/i, 'crash.errPermission'],
];

/** Dictionary key for a common cause (no space, offline, busy, bad file, permission), or null. */
export function errorKey(e: unknown): ErrKey | null {
  const msg = errorText(e);
  return PATTERNS.find(([re]) => re.test(msg))?.[1] ?? null;
}

/**
 * What to tell the user about a failure, in the app language. A cause that isn't recognised shows
 * a generic sentence (`fallback: 'raw'` shows the original text instead, for messages the app wrote
 * itself); the raw text belongs in the crash log.
 */
export function userError(t: (k: Key) => string, e: unknown, fallback: 'generic' | 'raw' = 'generic'): string {
  const k = errorKey(e);
  if (k) return t(k);
  return fallback === 'raw' ? errorText(e) : t('crash.errGeneric');
}
