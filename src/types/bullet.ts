/**
 * Programmers BattleGround — BulletView
 *
 * The read-only snapshot of a bullet that bots receive in thinkAboutIt().
 * Matches the shape produced by obfuscateBullet() in battleground.js (lines 599-606).
 */

import type { Point } from './common';

/** What a bot sees when inspecting a bullet on the arena */
export interface BulletView {
  /** Matter.js body id */
  id: number;
  /** Position on the arena */
  position: Point;
  /** Current velocity vector */
  velocity: Point;
  /** Scalar speed */
  speed: number;
  /** True if speed >= dangerousBulletSpeed (5) — can deal damage */
  dangerous: boolean;
}
