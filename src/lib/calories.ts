// Energy estimate from the Compendium of Physical Activities style MET values.
// Rough by nature (no heart rate), but consistent between activities.
import type { Sport } from './types';

export function metFor(sport: Sport, speedKmh: number): number {
  switch (sport) {
    case 'run':
      if (speedKmh < 6.4) return 6;
      if (speedKmh < 8) return 8.3;
      if (speedKmh < 9.7) return 9.8;
      if (speedKmh < 11.3) return 11;
      if (speedKmh < 12.9) return 11.8;
      if (speedKmh < 14.5) return 12.8;
      return 14.5;
    case 'ride':
      if (speedKmh < 16) return 4;
      if (speedKmh < 19) return 6.8;
      if (speedKmh < 22.5) return 8;
      if (speedKmh < 25.7) return 10;
      return 12;
    case 'walk':
      if (speedKmh < 4) return 2.8;
      if (speedKmh < 5.6) return 3.5;
      if (speedKmh < 6.4) return 4.3;
      if (speedKmh < 7.2) return 5;
      if (speedKmh < 8) return 7;
      return 8.3; // a brisk walk at running speed burns like a run
    case 'hike':
      if (speedKmh < 3) return 5.3;
      if (speedKmh < 5) return 6;
      return 7.3;
  }
}

/** kcal ≈ MET × weight(kg) × hours */
export function estimateCalories(sport: Sport, distanceM: number, movingSec: number, weightKg: number): number {
  if (movingSec <= 0 || weightKg <= 0) return 0;
  const speedKmh = (distanceM / movingSec) * 3.6;
  return Math.round(metFor(sport, speedKmh) * weightKg * (movingSec / 3600));
}
