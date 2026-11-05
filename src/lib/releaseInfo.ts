// Reading GitHub releases for the in-app updater. Pure so it is unit-tested.
//
// Every release ships an `update.json` manifest next to the APK. The app reads it from
// github.com/<repo>/releases/latest/download/update.json, which is served by GitHub's download CDN
// and is NOT subject to the REST API limit of 60 requests per hour per IP address. That limit is easy
// to hit when many employees share one office Wi-Fi, or a mobile carrier puts many users behind one IP.
// The API is only used as a fallback (releases made before the manifest existed) and for test builds.
import { compareVersions } from './semver';

export type ApkRelease = {
  version: string; notes: string; url: string; size: number; name: string; htmlUrl: string; prerelease?: boolean;
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** Parse an `update.json` manifest; null if it is not a usable one. */
export function fromManifest(m: unknown): ApkRelease | null {
  if (!m || typeof m !== 'object') return null;
  const x = m as Record<string, unknown>;
  const version = str(x.version).replace(/^v/i, ''), url = str(x.url);
  if (!/^\d+\.\d+/.test(version) || !/^https:\/\//.test(url) || !/\.apk$/i.test(url)) return null;
  return { version, url, notes: str(x.notes), size: num(x.size), name: str(x.apk) || url.split('/').pop()!, htmlUrl: str(x.page) || url };
}

type ApiAsset = { name?: string; browser_download_url?: string; size?: number };
type ApiRelease = { tag_name?: string; body?: string; html_url?: string; draft?: boolean; prerelease?: boolean; assets?: ApiAsset[] };

/** Parse one release from the GitHub REST API; null if it has no APK. */
export function fromApiRelease(rel: unknown): ApkRelease | null {
  if (!rel || typeof rel !== 'object') return null;
  const r = rel as ApiRelease;
  if (r.draft) return null;
  const asset = (r.assets ?? []).find((a) => str(a.name).toLowerCase().endsWith('.apk') && str(a.browser_download_url));
  const version = str(r.tag_name).replace(/^v/i, '');
  if (!asset || !/^\d+\.\d+/.test(version)) return null;
  return {
    version, notes: str(r.body), url: str(asset.browser_download_url), size: num(asset.size), name: str(asset.name),
    htmlUrl: str(r.html_url), prerelease: !!r.prerelease,
  };
}

/** The newest release in a list (test builds included). */
export function newestRelease(list: unknown): ApkRelease | null {
  if (!Array.isArray(list)) return null;
  return list.map(fromApiRelease).filter((r): r is ApkRelease => !!r)
    .reduce<ApkRelease | null>((best, r) => (!best || compareVersions(r.version, best.version) > 0 ? r : best), null);
}

/** Offer the release only if it is newer than what is installed. */
export const pickUpdate = (rel: ApkRelease | null, installed: string) =>
  rel && compareVersions(rel.version, installed) > 0 ? rel : null;

/** Human message for a failed check or download. */
export function friendlyError(e: unknown): string {
  const msg = String((e as Error)?.message ?? e);
  if (/network request failed|failed to fetch|unable to resolve host|timeout|timed out|offline|ENOTFOUND|UnknownHost/i.test(msg)) {
    return 'No internet connection. Connect to Wi-Fi or mobile data and try again.';
  }
  if (/\b(403|429)\b/.test(msg)) return 'GitHub is busy right now. Please try again in a few minutes.';
  return msg;
}
