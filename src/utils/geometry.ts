/**
 * Programmers BattleGround — Geometry Utilities
 *
 * Pure-math helpers ported from battleground.js (lines 1534-1568).
 * These are also installed as globals so bots can call them without imports.
 */

import type { Point } from '../types/common';

/** Anything that has a `position` property */
export interface HasPosition {
  position: Point;
}

/** Euclidean distance between two objects that have a `.position` */
export function distanceBetween(obj1: HasPosition, obj2: HasPosition): number {
  return Math.hypot(
    obj2.position.x - obj1.position.x,
    obj2.position.y - obj1.position.y,
  );
}

/** Euclidean distance between two raw points */
export function distanceBetweenPoints(pt1: Point, pt2: Point): number {
  return Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y);
}

/** Angle (radians) from obj1 to obj2 */
export function angleBetween(obj1: HasPosition, obj2: HasPosition): number {
  return angleBetweenPoints(obj1.position, obj2.position);
}

/** Angle (radians) from pt1 to pt2 */
export function angleBetweenPoints(pt1: Point, pt2: Point): number {
  const dx = pt2.x - pt1.x;
  const dy = pt2.y - pt1.y;
  return Math.atan2(dy, dx);
}

/** Normalise an angle into the range [0, 2*PI) */
export function normalizeAngle(angle: number): number {
  const TWO_PI = Math.PI * 2.0;
  let ang = angle - TWO_PI * Math.floor(angle / TWO_PI);
  if (ang < 0) ang = TWO_PI + ang;
  return ang;
}

/**
 * Shortest signed difference between two angles.
 * Positive → counter-clockwise from ang1 to ang2.
 */
export function differenceBetweenAngles(ang1: number, ang2: number): number {
  let a1 = normalizeAngle(ang1);
  let a2 = normalizeAngle(ang2);
  const TWO_PI = Math.PI * 2.0;
  if (Math.abs(a1 - a2) > Math.PI) {
    if (a1 > a2) a2 += TWO_PI;
    else a1 += TWO_PI;
  }
  return a2 - a1;
}
