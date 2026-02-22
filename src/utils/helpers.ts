/**
 * Programmers BattleGround — General Helpers
 *
 * Small utility functions ported from battleground.js.
 * Also installed as globals so bots can call them without imports.
 */

/** Random integer in [min, max] (inclusive on both ends) */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (++max - min)) + min;
}

/** Random angle in [0, 2*PI) */
export function randomAngle(): number {
  return Math.random() * Math.PI * 2;
}

/** Fisher-Yates in-place shuffle, returns the same array */
export function shuffleArray<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Check whether a value is a finite number */
export function isNumber(n: unknown): boolean {
  return !isNaN(parseFloat(n as string)) && isFinite(n as number);
}

/** Generate a random HSL colour string (vivid, mid-lightness) */
export function rainbow(): string {
  const h = randomInt(0, 359);
  const s = randomInt(50, 99);
  const l = randomInt(45, 65);
  return `hsl(${h},${s}%,${l}%)`;
}
