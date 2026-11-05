// What a live map needs to receive after a change: a full redraw, only the new points, or nothing.
// Pure, so the battery-saving diff is unit-tested.
import type { Point } from './geo';

export type MapState = { segs: Point[][] | null; lens: number[]; cur: string };
export type MapUpdate =
  | { kind: 'reset'; segs: number[][][] }
  | { kind: 'append'; segs: [number, number[][]][] }
  | { kind: 'none' };

const toLL = (p: Point) => [+p.lat.toFixed(6), +p.lng.toFixed(6)];

/** Compare what the page already has with the current route. Segments only ever grow in place while recording. */
export function routeUpdate(st: MapState, segments: Point[][], curKey: string, full = false): MapUpdate {
  const shrunk = segments.length < st.lens.length || st.lens.some((n, i) => (segments[i]?.length ?? 0) < n);
  if (full || segments !== st.segs || shrunk) return { kind: 'reset', segs: segments.map((s) => s.map(toLL)) };
  const chunks: [number, number[][]][] = [];
  segments.forEach((s, i) => { const from = st.lens[i] ?? 0; if (s.length > from) chunks.push([i, s.slice(from).map(toLL)]); });
  if (!chunks.length && curKey === st.cur) return { kind: 'none' };
  return { kind: 'append', segs: chunks };
}

export const mapState = (segments: Point[][], curKey: string): MapState => ({ segs: segments, lens: segments.map((s) => s.length), cur: curKey });
