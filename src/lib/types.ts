import type { Point } from './geo';

export type Sport = 'run' | 'ride' | 'walk' | 'hike';

export const SPORTS: { key: Sport; label: string; icon: string; usesPace: boolean }[] = [
  { key: 'run', label: 'Run', icon: 'run', usesPace: true },
  { key: 'ride', label: 'Ride', icon: 'bike', usesPace: false },
  { key: 'walk', label: 'Walk', icon: 'walk', usesPace: true },
  { key: 'hike', label: 'Hike', icon: 'hiking', usesPace: true },
];

export const sportInfo = (s: Sport) => SPORTS.find((x) => x.key === s) ?? SPORTS[0];

export type Activity = {
  id: string;
  name: string;
  description?: string;
  sport: Sport;
  startedAt: number;
  movingSec: number;
  elapsedSec: number;
  distanceM: number;
  elevGainM: number;
  segments: Point[][];
};

export type Session = {
  sport: Sport;
  startedAt: number;
  status: 'recording' | 'paused';
  pausedMs: number;
  pauseStartedAt: number | null;
  segments: Point[][];
};

export function sessionMovingSec(s: Session, now = Date.now()): number {
  const paused = s.pausedMs + (s.pauseStartedAt ? now - s.pauseStartedAt : 0);
  return Math.max(0, (now - s.startedAt - paused) / 1000);
}

export function defaultName(sport: Sport, startedAt: number): string {
  const h = new Date(startedAt).getHours();
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  return `${part} ${sportInfo(sport).label}`;
}
