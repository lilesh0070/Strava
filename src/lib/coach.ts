// Pure helpers for voice announcements, auto-pause decisions and GPX export (unit-tested).
import type { Point } from './geo';

function spokenDuration(sec: number): string {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  if (s || !parts.length) parts.push(`${s} ${s === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ');
}

export function kmCue(km: number, movingSec: number, usesPace: boolean): string {
  const head = `${km} ${km === 1 ? 'kilometre' : 'kilometres'}. Time ${spokenDuration(movingSec)}.`;
  if (usesPace) return `${head} Average pace ${spokenDuration(movingSec / km)} per kilometre.`;
  return `${head} Average speed ${((km * 3600) / movingSec).toFixed(1)} kilometres per hour.`;
}

/** Auto-pause after this long with no accepted movement. */
export const AUTO_PAUSE_AFTER_MS = 12_000;
/** Distance from the stop point needed to auto-resume. */
export const AUTO_RESUME_DIST_M = 12;

export function shouldAutoPause(lastMoveAt: number, now: number): boolean {
  return now - lastMoveAt >= AUTO_PAUSE_AFTER_MS;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toGpx(name: string, type: string, startedAt: number, segments: Point[][]): string {
  const segs = segments
    .filter((s) => s.length)
    .map((s) => {
      const pts = s
        .map((p) =>
          `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">` +
          (p.alt != null ? `<ele>${p.alt.toFixed(1)}</ele>` : '') +
          `<time>${new Date(p.t).toISOString()}</time></trkpt>`,
        )
        .join('\n');
      return `    <trkseg>\n${pts}\n    </trkseg>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Stride" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name><time>${new Date(startedAt).toISOString()}</time></metadata>
  <trk>
    <name>${esc(name)}</name>
    <type>${esc(type)}</type>
${segs}
  </trk>
</gpx>
`;
}

/** Number of consecutive weeks (ending this week or last week) with at least one activity. */
export function weekStreak(startTimes: number[], now = Date.now()): number {
  const monday = (t: number) => {
    const x = new Date(t); x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x.getTime();
  };
  const weeks = new Set(startTimes.map(monday));
  let w = monday(now);
  if (!weeks.has(w)) w = monday(w - 3 * 86400000); // current week not done yet: start from last week
  let n = 0;
  while (weeks.has(w)) { n++; w = monday(w - 3 * 86400000); }
  return n;
}
