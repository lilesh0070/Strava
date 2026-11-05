// Structured interval workouts. Pure logic; the tracker drives it and speaks the cues.
import type { Key } from './strings';

export type StepKind = 'warmup' | 'work' | 'rest' | 'cooldown';
export type Step = { kind: StepKind; by: 'time' | 'distance'; value: number }; // seconds or metres
/**
 * `name` / `description` are English (the name is stored on saved activities as workoutName and the spoken cues stay
 * English); screens show `t(w.nameKey)` / `t(w.descKey)`, the `wo.<id>` / `wo.<id>.d` dictionary entries.
 */
export type Workout = { id: string; name: string; description: string; nameKey: Key; descKey: Key; steps: Step[] };

const preset = (id: string, name: string, description: string, steps: Step[]): Workout =>
  ({ id, name, description, nameKey: `wo.${id}` as Key, descKey: `wo.${id}.d` as Key, steps });

const wu: Step = { kind: 'warmup', by: 'time', value: 600 };
const cd: Step = { kind: 'cooldown', by: 'time', value: 300 };
const rep = (n: number, work: Step, rest: Step): Step[] =>
  Array.from({ length: n }, (_, i) => (i < n - 1 ? [work, rest] : [work])).flat();

export const PRESETS: Workout[] = [
  preset('beginner', 'Run / walk', '8 × (1 min run + 1.5 min walk)',
    [{ kind: 'warmup', by: 'time', value: 300 }, ...rep(8, { kind: 'work', by: 'time', value: 60 }, { kind: 'rest', by: 'time', value: 90 }), cd]),
  preset('400s', '6 × 400 m', 'Speed: 400 m hard, 90 s easy',
    [wu, ...rep(6, { kind: 'work', by: 'distance', value: 400 }, { kind: 'rest', by: 'time', value: 90 }), cd]),
  preset('kms', '5 × 1 km', 'Threshold: 1 km at 10K pace, 2 min easy',
    [wu, ...rep(5, { kind: 'work', by: 'distance', value: 1000 }, { kind: 'rest', by: 'time', value: 120 }), cd]),
  preset('pyramid', 'Pyramid', '1-2-3-2-1 min hard, equal easy',
    [wu, ...[60, 120, 180, 120, 60].flatMap((t, i, a) => {
      const work: Step = { kind: 'work', by: 'time', value: t };
      return i < a.length - 1 ? [work, { kind: 'rest', by: 'time', value: t } as Step] : [work];
    }), cd]),
  preset('tempo', 'Tempo 20', '20 min comfortably hard', [wu, { kind: 'work', by: 'time', value: 1200 }, cd]),
];

export const findWorkout = (id: string | null | undefined) => PRESETS.find((w) => w.id === id) ?? null;

export type WorkoutProgress = { workoutId: string; index: number; startDistM: number; startSec: number; done: boolean };

export function startProgress(workoutId: string, distM: number, sec: number): WorkoutProgress {
  return { workoutId, index: 0, startDistM: distM, startSec: sec, done: false };
}

/** How much of the current step is left (seconds or metres). */
export function remaining(w: Workout, p: WorkoutProgress, distM: number, sec: number): number {
  const step = w.steps[p.index];
  if (!step || p.done) return 0;
  return Math.max(0, step.value - (step.by === 'time' ? sec - p.startSec : distM - p.startDistM));
}

/** Move to the next step if the current one is complete. Returns the new progress and whether it changed. */
export function advance(w: Workout, p: WorkoutProgress, distM: number, sec: number): { p: WorkoutProgress; changed: boolean } {
  if (p.done || remaining(w, p, distM, sec) > 0) return { p, changed: false };
  const index = p.index + 1;
  if (index >= w.steps.length) return { p: { ...p, done: true }, changed: true };
  // the next step starts where this one really ended, not when its end was detected (fixes arrive every
  // 1-7 s): the overshoot is carried over, so late detections never add up across a workout
  const step = w.steps[p.index];
  const startSec = step.by === 'time' ? p.startSec + step.value : sec;
  const startDistM = step.by === 'distance' ? p.startDistM + step.value : distM;
  return { p: { ...p, index, startDistM, startSec }, changed: true };
}

const fmtAmount = (s: Step) =>
  s.by === 'distance'
    ? s.value >= 1000 ? `${s.value / 1000} kilometre${s.value === 1000 ? '' : 's'}` : `${s.value} metres`
    : s.value >= 60 && s.value % 60 === 0 ? `${s.value / 60} minute${s.value === 60 ? '' : 's'}`
      : s.value < 120 ? `${s.value} seconds` : `${Math.floor(s.value / 60)} minutes ${s.value % 60} seconds`;

export function stepCue(w: Workout, p: WorkoutProgress): string {
  if (p.done) return 'Workout complete. Great job! Keep moving to cool down or finish the activity.';
  const step = w.steps[p.index];
  const works = w.steps.filter((s) => s.kind === 'work').length;
  const workNo = w.steps.slice(0, p.index + 1).filter((s) => s.kind === 'work').length;
  switch (step.kind) {
    case 'warmup': return `Warm up easy for ${fmtAmount(step)}.`;
    case 'cooldown': return `Cool down easy for ${fmtAmount(step)}.`;
    case 'rest': return `Recover. ${fmtAmount(step)} easy.`;
    case 'work': return `Interval ${workNo} of ${works}. Go hard for ${fmtAmount(step)}.`;
  }
}

export const stepLabel = (s: Step) =>
  `${s.kind === 'work' ? 'Hard' : s.kind === 'rest' ? 'Easy' : s.kind === 'warmup' ? 'Warm-up' : 'Cool-down'}`;

/** Dictionary key of a step's label (Hard / Easy / Warm-up / Cool-down) for screens: `t(stepKey(s))`. */
export const stepKey = (s: Step): Key =>
  s.kind === 'work' ? 'wo.hard' : s.kind === 'rest' ? 'wo.easy' : s.kind === 'warmup' ? 'wo.warmup' : 'wo.cooldown';
