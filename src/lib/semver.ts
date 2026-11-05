/**
 * Compare versions like "1.2.0", "v1.10" or "1.3.0-rc.1". Returns >0 if a is newer than b.
 * Follows semver precedence: a pre-release (1.3.0-rc.1) is older than its release (1.3.0), and
 * pre-release parts compare numerically when numeric (rc.2 < rc.10). Build metadata (+abc) is ignored.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, pre] = v.trim().replace(/^v/i, '').split('+')[0].split(/-(.*)/s);
    return { nums: core.split('.').slice(0, 3).map((x) => parseInt(x, 10) || 0), pre: pre ? pre.split('.') : [] };
  };
  const pa = parse(a), pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0);
    if (d) return d;
  }
  if (!pa.pre.length || !pb.pre.length) return pb.pre.length - pa.pre.length; // release > pre-release
  for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i++) {
    const x = pa.pre[i], y = pb.pre[i];
    if (x == null) return -1; // fewer parts sorts first (rc < rc.1)
    if (y == null) return 1;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    if (nx && ny) { const d = Number(x) - Number(y); if (d) return d; continue; }
    if (nx !== ny) return nx ? -1 : 1; // numeric parts sort before text
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}
