/**
 * Programmers BattleGround — Common Types
 *
 * Basic geometric types used throughout the project.
 */

/** A 2D point / vector */
export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned bounding box */
export interface Bounds {
  min: Point;
  max: Point;
}

/** Arena dimensions (default: 1024 x 768) */
export interface Arena {
  width: number;
  height: number;
}
