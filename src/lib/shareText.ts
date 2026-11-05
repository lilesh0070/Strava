// "Copy as text": an activity as one block of plain text, ready to paste into an Instagram story
// (Aa → paste), WhatsApp or a caption. Plain text can't carry colour, so the route is drawn with
// Braille dot characters (each one is a 2 × 4 grid of dots); colour the text orange in Instagram and
// it matches the app's route line. Pure (no React Native) so it is unit-tested.
import { fmtDuration, fmtKm, type Point } from './geo';
import { statValue, type ShareStatKey } from './shareStats';
import type { Activity, Sport } from './types';
import type { WeekRecap } from './weekRecap';

const BRAILLE_BLANK = 0x2800;
/** Bit for the dot at (x, y) inside one Braille cell (x 0..1, y 0..3). */
const DOT = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]];

/**
 * The route drawn with Braille characters, north up and true to its shape, at most `maxCols` characters
 * wide and `maxRows` lines tall. Null without a route.
 */
export function routeAsText(segments: Point[][], maxCols = 16, maxRows = 6): string | null {
  const segs = segments.filter((s) => s.length > 1);
  const pts = segs.flat();
  if (pts.length < 2) return null;
  let minLat = Infinity, maxLat = -Infinity;
  for (const p of pts) { if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat; }
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180); // equirectangular: true east-west scale
  let minX = Infinity, maxX = -Infinity;
  for (const p of pts) { const x = p.lng * kx; if (x < minX) minX = x; if (x > maxX) maxX = x; }
  const w = maxX - minX, h = maxLat - minLat;
  if (w <= 0 && h <= 0) return null;

  // dots are spaced about equally across and down in a Braille cell, so one scale keeps the shape
  const dotsW = maxCols * 2 - 1, dotsH = maxRows * 4 - 1;
  const scale = Math.min(w > 0 ? dotsW / w : Infinity, h > 0 ? dotsH / h : Infinity);
  const W = Math.round(w * scale) + 1, H = Math.round(h * scale) + 1;
  const cols = Math.ceil(W / 2), rows = Math.ceil(H / 4);
  const grid = new Uint8Array(cols * rows);
  const plot = (x: number, y: number) => { grid[(y >> 2) * cols + (x >> 1)] |= DOT[y & 3][x & 1]; };
  const toDot = (p: Point): [number, number] => [Math.round((p.lng * kx - minX) * scale), Math.round((maxLat - p.lat) * scale)];

  for (const seg of segs) {
    let [x0, y0] = toDot(seg[0]);
    plot(x0, y0);
    for (let i = 1; i < seg.length; i++) {
      const [x1, y1] = toDot(seg[i]);
      // Bresenham: every dot between the two points, so the line has no gaps
      let x = x0, y = y0;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        plot(x, y);
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
      x0 = x1; y0 = y1;
    }
  }
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) line += String.fromCharCode(BRAILLE_BLANK + grid[r * cols + c]);
    lines.push(line);
  }
  return lines.join('\n');
}

const SPORT_EMOJI: Record<Sport, string> = { run: '🏃', ride: '🚴', walk: '🚶', hike: '🥾' };
const STAT_EMOJI: Record<ShareStatKey, string> = {
  distance: '📏', time: '⏱️', pace: '⚡', speed: '🚀', steps: '👟', elevation: '⛰️', calories: '🔥',
};

export type ActivityTextOptions = {
  /** Which numbers to include, in this order (the same choice as on the sticker). */
  stats: ShareStatKey[];
  /** Translated label for each number. */
  labels: Record<ShareStatKey, string>;
  route?: boolean;
  weightKg?: number;
  /** Shown under the title, e.g. "Wed, 5 Nov". */
  dateText?: string;
  appName?: string;
};

/** The activity as one block of text: title, date, the chosen numbers, the route as dots and the app name. */
export function activityText(a: Activity, o: ActivityTextOptions): string {
  const parts: string[] = [`${SPORT_EMOJI[a.sport] ?? '🏃'} ${a.name}`];
  if (o.dateText) parts.push(o.dateText);
  const rows = o.stats.map((k) => {
    const { value, unit } = statValue(a, k, o.weightKg);
    return `${STAT_EMOJI[k]} ${o.labels[k]}: ${value}${unit ? ` ${unit}` : ''}`;
  });
  if (rows.length) parts.push('', ...rows);
  const route = o.route === false ? null : routeAsText(a.segments);
  if (route) parts.push('', route);
  parts.push('', `— ${o.appName ?? 'TBDI FitTrack'}`);
  return parts.join('\n');
}

// ---------- "my week" ----------
export type WeekTextOptions = {
  title: string;
  dateText: string;
  labels: { activities: string; best: string; steps: string; streak: string; vsLast: string; rank: string };
  rank?: number | null;
  appName?: string;
};

/** The week as one block of text for a group chat. */
export function weekText(r: WeekRecap, o: WeekTextOptions): string {
  const line2 = `📏 ${fmtKm(r.km * 1000)} km · ${r.count} ${o.labels.activities} · ⏱️ ${fmtDuration(r.sec)}`;
  const extras: string[] = [];
  if (r.bestPaceSec != null) extras.push(`⚡ ${o.labels.best} ${fmtDuration(r.bestPaceSec)} /km`);
  if (r.steps > 0) extras.push(`👣 ${r.steps.toLocaleString('en-IN')} ${o.labels.steps}`);
  const tail: string[] = [];
  if (r.changePct != null) tail.push(`${r.changePct >= 0 ? '▲' : '▼'} ${Math.abs(r.changePct)}% ${o.labels.vsLast}`);
  if (r.streak > 1) tail.push(`🔥 ${r.streak} ${o.labels.streak}`);
  if (o.rank != null) tail.push(`${o.rank === 1 ? '🥇' : o.rank === 2 ? '🥈' : o.rank === 3 ? '🥉' : '🏅'} #${o.rank} ${o.labels.rank}`);
  return [`🏃 ${o.title} · ${o.dateText}`, line2, ...(extras.length ? [extras.join(' · ')] : []), ...(tail.length ? [tail.join(' · ')] : []), `— ${o.appName ?? 'TBDI FitTrack'}`].join('\n');
}
