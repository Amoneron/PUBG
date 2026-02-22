/**
 * Programmers BattleGround — CreatureView
 *
 * The read-only snapshot of a creature that bots receive in thinkAboutIt().
 * Matches the shape produced by obfuscateCreature() in battleground.js (lines 577-597).
 */

import type { Point } from './common';

/** What a bot sees when inspecting itself or an enemy */
export interface CreatureView {
  /** Matter.js body id — unique per creature instance */
  id: number;
  /** Total kills this session */
  kills: number;
  /** Total deaths this session */
  deaths: number;
  /** Intelligence quotient — persistent rating */
  iq: number;
  /** Bot author name */
  author: string;
  /** Bot display name */
  name: string;
  /** Current hit points */
  lives: number;
  /** Current bullet count */
  bullets: number;
  /** Current energy (regenerates each tick) */
  energy: number;
  /** Creature level (0-2), determines max HP/energy/bullets */
  level: number;
  /** Position on the arena */
  position: Point;
  /** Current velocity vector */
  velocity: Point;
  /** Facing angle in radians */
  angle: number;
  /** Scalar speed */
  speed: number;
  /** Current angular velocity */
  angularVelocity: number;
  /** True if creature is currently poisoned */
  poisoned: boolean;
  /** True if creature is currently casting a spell */
  spelling: boolean;
  /** Display message (up to 2 lines, 20 chars each) */
  message: string | null;
}
