// Pure geometry / stats helpers. No React Native imports so they can be unit-tested with plain Node.

export type Point = {
  lat: number;
  lng: number;
  alt: number | null;
  t: number; // epoch ms
  acc: number | null; // horizontal accuracy in metres
};

export type Split = { km: number; distanceM: number; durationSec: number };

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: Pick<Point, 'lat' | 'lng'>, b: Pick<Point, 'lat' | 'lng'>): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Decide whether a new GPS fix should be kept, given the previous kept fix. */
export function acceptPoint(prev: Point | undefined, next: Point, maxSpeedMs = 45): boolean {
  if (next.acc != null && next.acc > 35) return false;
  if (!prev) return true;
  if (next.t <= prev.t) return false;
  const d = haversine(prev, next);
  if (d < 3) return false; // jitter while standing still
  const speed = d / ((next.t - prev.t) / 1000);
  return speed <= maxSpeedMs;
}

export function segmentDistance(seg: Point[]): number {
  let d = 0;
  for (let i = 1; i < seg.length; i++) d += haversine(seg[i - 1], seg[i]);
  return d;
}

export function totalDistance(segments: Point[][]): number {
  return segments.reduce((s, seg) => s + segmentDistance(seg), 0);
}

/** Elevation gain with a hysteresis threshold to ignore GPS altitude noise. */
export function elevationGain(segments: Point[][], threshold = 4): number {
  let gain = 0;
  for (const seg of segments) {
    let ref: number | null = null;
    for (const p of seg) {
      if (p.alt == null) continue;
      if (ref == null) { ref = p.alt; continue; }
      const diff = p.alt - ref;
      if (diff >= threshold) { gain += diff; ref = p.alt; }
      else if (diff <= -threshold) ref = p.alt;
    }
  }
  return gain;
}

/** Cumulative distance (m) and moving time (s) per point, gaps between segments excluded. */
export function cumulative(segments: Point[][]): { d: number[]; s: number[]; alt: (number | null)[] } {
  const d: number[] = [], s: number[] = [], alt: (number | null)[] = [];
  let dist = 0, time = 0;
  for (const seg of segments) {
    for (let i = 0; i < seg.length; i++) {
      if (i > 0) {
        dist += haversine(seg[i - 1], seg[i]);
        time += (seg[i].t - seg[i - 1].t) / 1000;
      }
      d.push(dist); s.push(time); alt.push(seg[i].alt);
    }
  }
  return { d, s, alt };
}

function timeAtDistance(d: number[], s: number[], target: number): number {
  // linear interpolation of time at a given cumulative distance
  let lo = 0, hi = d.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (d[mid] < target) lo = mid + 1; else hi = mid;
  }
  if (lo === 0) return s[0];
  const d0 = d[lo - 1], d1 = d[lo];
  const f = d1 === d0 ? 0 : (target - d0) / (d1 - d0);
  return s[lo - 1] + f * (s[lo] - s[lo - 1]);
}

export function splits(segments: Point[][], unitM = 1000): Split[] {
  const { d, s } = cumulative(segments);
  if (d.length < 2) return [];
  const total = d[d.length - 1];
  const out: Split[] = [];
  let prevT = 0;
  for (let k = 1; k * unitM <= total; k++) {
    const t = timeAtDistance(d, s, k * unitM);
    out.push({ km: k, distanceM: unitM, durationSec: t - prevT });
    prevT = t;
  }
  const rest = total - out.length * unitM;
  if (rest > 50) out.push({ km: out.length + 1, distanceM: rest, durationSec: s[s.length - 1] - prevT });
  return out;
}

/** Fastest time (s) to cover `target` metres anywhere in the activity, or null. */
export function bestEffort(segments: Point[][], target: number): number | null {
  const { d, s } = cumulative(segments);
  if (!d.length || d[d.length - 1] < target) return null;
  let best = Infinity;
  let j = 0;
  for (let i = 0; i < d.length; i++) {
    while (j < d.length && d[j] - d[i] < target) j++;
    if (j >= d.length) break;
    // interpolate the end point for a fair comparison
    const end = timeAtDistance(d, s, d[i] + target);
    best = Math.min(best, end - s[i]);
  }
  return Number.isFinite(best) ? best : null;
}

// ---------- formatting ----------

export function fmtDuration(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtKm(m: number): string {
  return (m / 1000).toFixed(m < 10000 ? 2 : 1);
}

/** Pace as min:sec per km. */
export function fmtPace(distanceM: number, sec: number): string {
  if (distanceM < 10 || sec <= 0) return '–:––';
  const p = sec / (distanceM / 1000);
  if (p > 60 * 60) return '–:––';
  return fmtDuration(p);
}

export function fmtSpeed(distanceM: number, sec: number): string {
  if (sec <= 0) return '0.0';
  return ((distanceM / sec) * 3.6).toFixed(1);
}

/** Ramer–Douglas–Peucker simplification (tolerance in metres). Keeps the shape, drops most points. */
export function simplify(seg: Point[], toleranceM = 6): Point[] {
  if (seg.length < 3) return seg;
  const keep = new Uint8Array(seg.length);
  keep[0] = keep[seg.length - 1] = 1;
  const stack: [number, number][] = [[0, seg.length - 1]];
  // perpendicular distance using a local equirectangular projection (fine at route scale)
  const k = Math.cos((seg[0].lat * Math.PI) / 180) * 111320;
  const xy = (p: Point) => [p.lng * k, p.lat * 110540];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = xy(seg[a]), [bx, by] = xy(seg[b]);
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy(seg[i]);
      const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > toleranceM && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return seg.filter((_, i) => keep[i]);
}
