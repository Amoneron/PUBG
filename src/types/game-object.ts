/**
 * Programmers BattleGround — GameObjectView
 *
 * The read-only snapshot of a world object (obstacle, dynamite, or star)
 * that bots receive in thinkAboutIt().
 * Matches the shape produced by obfuscateObstacle() in battleground.js (lines 608-618).
 */

import type { Point, Bounds } from './common';
import type { ObjectType } from './enums';

/** What a bot sees when inspecting a world object */
export interface GameObjectView {
  /** Matter.js body id */
  id: number;
  /** Position on the arena */
  position: Point;
  /** Current velocity vector */
  velocity: Point;
  /** Scalar speed */
  speed: number;
  /** Axis-aligned bounding box */
  bounds: Bounds;
  /** Object category: obstacle, dynamite, or star */
  type: ObjectType;
  /** Sub-type identifier (e.g. StarShape value for stars, sprite variant for obstacles) */
  shape: number;
  /** Remaining hit points (0 = destroyed) */
  condition: number;
}
