/** "45" → 45 min, "1:05:30" → h:m:s, "32:10" → m:s */
export function parseDuration(s: string): number | null {
  const parts = s.trim().split(':').map((x) => x.trim());
  if (!parts.length || parts.some((p) => !/^\d+$/.test(p))) return null;
  const n = parts.map(Number);
  if (n.length === 1) return n[0] * 60;
  if (n.length === 2) return n[1] < 60 ? n[0] * 60 + n[1] : null;
  if (n.length === 3) return n[1] < 60 && n[2] < 60 ? n[0] * 3600 + n[1] * 60 + n[2] : null;
  return null;
}
