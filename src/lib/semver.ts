/** Compare dotted versions like "1.2.0" / "v1.10". Returns >0 if a is newer than b. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.trim().replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
  const pa = parse(a), pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
