// GPS accuracy simulator: the REAL tracker.ingest() over synthetic routes with realistic GPS noise (slow drift,
// jitter, 1 % multipath spikes), for three phone conventions. `npm run sim:gps [android|ios|nodop] [seeds]`.
// Baseline before the v1.3.9 distance stage: Android mean |error| 8.1 % (run/stand/run +58 %, 10 min standing +281 m).
// (Android Doppler, iOS Doppler, no Doppler), with stops, standing, outages, a track and corners.
// Prints % distance error (creep in metres for the standing case) and the stored track's chord sum.
import AS from './stubs/async-storage.mjs';
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const gauss = () => { const u = rnd() || 1e-9, v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const M = 111_320;
type True = { x: number; y: number; t: number; v: number; hdg: number; skip?: boolean };
function city(v: number, legs = 6, stopS = 30, legM = 500): True[] { const out: True[] = []; let x = 0, y = 0, t = 0, hdg = 90;
  for (let leg = 0; leg < legs; leg++) { const dx = hdg === 90 ? 1 : hdg === 270 ? -1 : 0, dy = hdg === 0 ? 1 : hdg === 180 ? -1 : 0;
    for (let s = 0; s < legM; s += v) { x += dx * v; y += dy * v; out.push({ x, y, t: t++ * 1000, v, hdg }); }
    if (leg % 2 === 1) for (let s = 0; s < stopS; s++) out.push({ x, y, t: t++ * 1000, v: 0, hdg }); hdg = (hdg + 90) % 360; } return out; }
function curvy(v: number, len = 3000): True[] { const out: True[] = []; let t = 0; for (let s = 0; s <= len; s += v) { const x = s, y = 40 * Math.sin(s / 150); const hdg = (90 - Math.atan2(40 / 150 * Math.cos(s / 150), 1) * 180 / Math.PI + 360) % 360; out.push({ x, y, t: t++ * 1000, v, hdg }); } return out; }
function track(v: number, laps = 5): True[] { const out: True[] = []; let s = 0, t = 0; const L = 84.39, r = 36.5, per = 2 * L + 2 * Math.PI * r;
  while (s < laps * per) { const u = s % per; let x, y, hdg; if (u < L) { x = u; y = 0; hdg = 90; } else if (u < L + Math.PI * r) { const a = (u - L) / r; x = L + r * Math.sin(a); y = r - r * Math.cos(a); hdg = (90 - a * 180 / Math.PI + 360) % 360; } else if (u < 2 * L + Math.PI * r) { x = L - (u - L - Math.PI * r); y = 2 * r; hdg = 270; } else { const a = (u - 2 * L - Math.PI * r) / r; x = -r * Math.sin(a); y = r + r * Math.cos(a); hdg = (270 - a * 180 / Math.PI + 360) % 360; } out.push({ x, y, t: t * 1000, v, hdg }); s += v; t++; } return out; }
function intervals(): True[] { const out: True[] = []; let x = 0, t = 0; for (let r = 0; r < 6; r++) { for (let s = 0; s < 400; s += 4.5) { x += 4.5; out.push({ x, y: 0, t: t++ * 1000, v: 4.5, hdg: 90 }); } for (let s = 0; s < 90; s++) { x += 1.2; out.push({ x, y: 0, t: t++ * 1000, v: 1.2, hdg: 90 }); } } return out; }
function straight(v: number, len: number, outageAt?: number, outageS = 60): True[] { const out: True[] = []; let t = 0; for (let x = 0; x <= len; x += v) { out.push({ x, y: 0, t: t * 1000, v, hdg: 90, skip: outageAt != null && x >= outageAt && x < outageAt + outageS * v }); t++; } return out; }
function runStandRun(v = 3, standS = 600): True[] { const out: True[] = []; let x = 0, t = 0; for (let s = 0; s < 300; s += v) { x += v; out.push({ x, y: 0, t: t++ * 1000, v, hdg: 90 }); } for (let s = 0; s < standS; s++) out.push({ x, y: 0, t: t++ * 1000, v: 0, hdg: 90 }); for (let s = 0; s < 300; s += v) { x += v; out.push({ x, y: 0, t: t++ * 1000, v, hdg: 90 }); } return out; }
function walkStand(): True[] { const out: True[] = []; let x = 0, t = 0; for (let s = 0; s < 100; s += 1.3) { x += 1.3; out.push({ x, y: 0, t: t++ * 1000, v: 1.3, hdg: 90 }); } for (let s = 0; s < 600; s++) out.push({ x, y: 0, t: t++ * 1000, v: 0, hdg: 90 }); return out; }

type Mode = 'android' | 'ios' | 'nodop';
let clock = 1_800_000_000_000;
Date.now = () => clock;
await AS.setItem('stride:settings', JSON.stringify({ autoPause: false, voiceCues: false, liveNotification: false }));
let n = 0;
async function run(path: True[], sport: string, acc: number, mode: Mode, seedv: number) {
  seed = seedv;
  const tracker = await import(`../../src/lib/tracker.ts?i=${n++}`);
  const geo = await import('../../src/lib/geo.ts');
  await new Promise((r) => setTimeout(r, 5));
  clock += 100_000;
  await tracker.start(sport as never);
  const lat0 = 28.6, kx = Math.cos(lat0 * Math.PI / 180) * M, t0 = clock;
  let nx = 0, ny = 0;
  for (const p of path) {
    nx = 0.9 * nx + 0.44 * acc * gauss() * 0.6; ny = 0.9 * ny + 0.44 * acc * gauss() * 0.6;
    let ex = p.x + nx + gauss() * acc * 0.3, ey = p.y + ny + gauss() * acc * 0.3; let a = acc * (0.8 + 0.4 * rnd());
    if (rnd() < 0.01) { ex += gauss() * 25; ey += gauss() * 25; a = acc * 2; }
    clock = t0 + p.t;
    if (p.skip) continue;
    let spd: number, hdg: number;
    if (mode === 'nodop') { spd = 0; hdg = 0; }
    else if (p.v > 0.05) { spd = Math.max(0, p.v + gauss() * 0.2); hdg = (p.hdg + gauss() * 3 + 360) % 360; }
    else if (mode === 'ios') { spd = 0; hdg = -1; }
    else { spd = Math.abs(gauss() * 0.25); hdg = rnd() * 360; } // Android standing: tiny speed, random bearing
    await tracker.ingest([{ coords: { latitude: lat0 + ey / M, longitude: 77.2 + ex / kx, altitude: null, accuracy: Math.round(a * 10) / 10, speed: spd, heading: hdg }, timestamp: clock } as never]);
  }
  const s = tracker.getSession()!;
  const d = s.distanceM ?? 0;
  const chord = geo.totalDistance(s.segments);
  const pts = s.segments.reduce((a, x) => a + x.length, 0);
  await tracker.discard();
  let truth = 0; for (let i = 1; i < path.length; i++) truth += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return { err: (d - truth) / truth * 100, creep: d - truth, chordDev: (chord - d) / Math.max(1, d) * 100, pts };
}
const f = (x: number) => ((x >= 0 ? '+' : '') + x.toFixed(2) + '%').padStart(8);
const m = (x: number) => (x.toFixed(0) + 'm').padStart(8);
const cases: [string, True[], string, number, boolean?][] = [
  ['run city 6×45s stops', city(3.0, 12, 45), 'run', 7], ['walk city 3×40s stops', city(1.3, 6, 40), 'walk', 8],
  ['run-stand10m-run', runStandRun(), 'run', 6], ['stand 10m (creep m)', walkStand(), 'walk', 7, true],
  ['run 60s outage', straight(3, 1500, 600), 'run', 6], ['run track 3.5', track(3.5), 'run', 6], ['run intervals', intervals(), 'run', 6],
  ['run curvy acc 5', curvy(3.3), 'run', 5], ['hike 0.7 curvy', curvy(0.7, 1500), 'hike', 10], ['hike 0.6 curvy acc 9', curvy(0.6, 900), 'hike', 9], ['hike 0.5 curvy acc 8', curvy(0.5, 600), 'hike', 8], ['walk curvy acc 7', curvy(1.4), 'walk', 7],
  ['ride corners acc 6', city(8, 4), 'ride', 6], ['ride curvy acc 5', curvy(9, 6000), 'ride', 5],
];
const modes: Mode[] = ['android', 'ios', 'nodop'];
const only = process.argv[2] as Mode | undefined;
const seeds = Number(process.argv[3] ?? 3);
console.log('REAL tracker.ts'.padEnd(24), modes.map((x) => x.padStart(8) + ' chord%'.padStart(8)).join(''));
const sum: Record<string, number> = {}; const cnt: Record<string, number> = {};
for (const [name, path, sport, acc, creep] of cases) {
  let line = name.padEnd(24);
  for (const mode of modes) {
    if (only && mode !== only) { line += ' '.repeat(16); continue; }
    let e = 0, c = 0, cd = 0; for (let i = 1; i <= seeds; i++) { const r = await run(path, sport, acc, mode, i * 7919); e += r.err; c += r.creep; cd += r.chordDev; }
    e /= seeds; c /= seeds; cd /= seeds;
    if (!creep) { sum[mode] = (sum[mode] ?? 0) + Math.abs(e); cnt[mode] = (cnt[mode] ?? 0) + 1; }
    line += (creep ? m(c) : f(e)) + f(cd);
  }
  console.log(line);
}
console.log('mean |error|'.padEnd(24), modes.map((x) => (sum[x] != null ? f(sum[x] / cnt[x]) : ' '.repeat(8)) + ' '.repeat(8)).join(''));
