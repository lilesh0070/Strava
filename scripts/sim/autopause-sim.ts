// Auto-pause simulator (`npm run sim:autopause`): a city run with 6 traffic-light stops (45 s) and a 10-min stand, auto-pause ON.
// Counts pauses/resumes, paused time vs true stopped time, and the distance error.
import AS from './stubs/async-storage.mjs';
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const gauss = () => { const u = rnd() || 1e-9, v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const M = 111_320;
type True = { x: number; y: number; t: number; v: number; hdg: number };
function city(v: number, legs = 6, stopS = 30, legM = 500): True[] { const out: True[] = []; let x = 0, y = 0, t = 0, hdg = 90;
  for (let leg = 0; leg < legs; leg++) { const dx = hdg === 90 ? 1 : hdg === 270 ? -1 : 0, dy = hdg === 0 ? 1 : hdg === 180 ? -1 : 0;
    for (let s = 0; s < legM; s += v) { x += dx * v; y += dy * v; out.push({ x, y, t: t++ * 1000, v, hdg }); }
    if (leg % 2 === 1) for (let s = 0; s < stopS; s++) out.push({ x, y, t: t++ * 1000, v: 0, hdg }); hdg = (hdg + 90) % 360; } return out; }
function runStandRun(v = 3, standS = 600): True[] { const out: True[] = []; let x = 0, t = 0; for (let s = 0; s < 300; s += v) { x += v; out.push({ x, y: 0, t: t++ * 1000, v, hdg: 90 }); } for (let s = 0; s < standS; s++) out.push({ x, y: 0, t: t++ * 1000, v: 0, hdg: 90 }); for (let s = 0; s < 300; s += v) { x += v; out.push({ x, y: 0, t: t++ * 1000, v, hdg: 90 }); } return out; }
function hike(v = 0.6, len = 600): True[] { const out: True[] = []; let t = 0; for (let s = 0; s <= len; s += v) { out.push({ x: s, y: 30 * Math.sin(s / 100), t: t++ * 1000, v, hdg: 90 }); } return out; }
type Mode = 'android' | 'ios' | 'nodop';
let clock = 1_800_000_000_000;
Date.now = () => clock;
await AS.setItem('stride:settings', JSON.stringify({ autoPause: true, voiceCues: false, liveNotification: false }));
let n = 0;
async function run(path: True[], sport: string, acc: number, mode: Mode, seedv: number) {
  seed = seedv;
  const tracker = await import(`../../src/lib/tracker.ts?i=${n++}`);
  await new Promise((r) => setTimeout(r, 5));
  clock += 100_000;
  await tracker.start(sport as never);
  const lat0 = 28.6, kx = Math.cos(lat0 * Math.PI / 180) * M, t0 = clock;
  let nx = 0, ny = 0, pauses = 0, prev = 'recording', trueStop = 0;
  for (const p of path) {
    nx = 0.9 * nx + 0.44 * acc * gauss() * 0.6; ny = 0.9 * ny + 0.44 * acc * gauss() * 0.6;
    let ex = p.x + nx + gauss() * acc * 0.3, ey = p.y + ny + gauss() * acc * 0.3; let a = acc * (0.8 + 0.4 * rnd());
    if (rnd() < 0.01) { ex += gauss() * 25; ey += gauss() * 25; a = acc * 2; }
    clock = t0 + p.t;
    if (p.v === 0) trueStop++;
    let spd: number, hdg: number;
    if (mode === 'nodop') { spd = 0; hdg = 0; }
    else if (p.v > 0.05) { spd = Math.max(0, p.v + gauss() * 0.2); hdg = (p.hdg + gauss() * 3 + 360) % 360; }
    else if (mode === 'ios') { spd = 0; hdg = -1; }
    else { spd = Math.abs(gauss() * 0.25); hdg = rnd() * 360; }
    await tracker.ingest([{ coords: { latitude: lat0 + ey / M, longitude: 77.2 + ex / kx, altitude: null, accuracy: Math.round(a * 10) / 10, speed: spd, heading: hdg }, timestamp: clock } as never]);
    const st = tracker.getSession()!.status;
    if (st === 'paused' && prev === 'recording') pauses++;
    prev = st;
  }
  const s = tracker.getSession()!;
  const pausedMs = s.pausedMs + (s.pauseStartedAt ? clock - s.pauseStartedAt : 0);
  const d = s.distanceM ?? 0;
  await tracker.discard();
  let truth = 0; for (let i = 1; i < path.length; i++) truth += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return { err: (d - truth) / truth * 100, pauses, pausedS: pausedMs / 1000, trueStop };
}
const cases: [string, True[], string, number, number][] = [
  ['run city 6 stops 45s', city(3.0, 12, 45), 'run', 7, 6], ['run-stand10m-run', runStandRun(), 'run', 6, 1],
  ['hike 0.6 m/s curvy', hike(), 'hike', 9, 0], ['hike 0.5 m/s curvy', hike(0.5, 500), 'hike', 8, 0], ['ride 2 stops', city(8, 4), 'ride', 6, 2],
];
console.log('auto-pause ON'.padEnd(22), ['android', 'ios', 'nodop'].map((m) => m.padStart(9) + ' pauses  pausedS/true').join(' |'));
for (const [name, path, sport, acc, expectStops] of cases) {
  let line = name.padEnd(22);
  for (const mode of ['android', 'ios', 'nodop'] as Mode[]) {
    let e = 0, pz = 0, ps = 0, ts = 0; const S = 2;
    for (let i = 1; i <= S; i++) { const r = await run(path, sport, acc, mode, i * 7919); e += r.err; pz += r.pauses; ps += r.pausedS; ts = r.trueStop; }
    line += ` ${((e / S >= 0 ? '+' : '') + (e / S).toFixed(2) + '%').padStart(8)} ${(pz / S).toFixed(1).padStart(5)}/${expectStops}  ${(ps / S).toFixed(0).padStart(4)}/${ts} |`;
  }
  console.log(line);
}
