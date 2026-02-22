/**
 * Programmers BattleGround — Internal Types
 *
 * Mutable types used inside the engine. These are NOT exposed to bots.
 * They map directly to the prototype objects in battleground.js (lines 136-199).
 */

import type Matter from 'matter-js';
import type { Point } from './common';
import type { Kind, ObjectType, Shell } from './enums';
import type { Brain } from './brain';

/**
 * Internal brain record — tracks identity, stats, and the bot code reference.
 * Matches the Brain prototype in battleground.js (lines 136-147).
 */
export interface InternalBrain {
  /** Unique identifier (used as localStorage key for IQ persistence) */
  id: string;
  /** Author name */
  author: string;
  /** Bot display name */
  name: string;
  /** Creature species */
  kind: Kind;
  /** Session kill count */
  kills: number;
  /** Session death count */
  deaths: number;
  /** Intelligence quotient — persistent rating */
  iq: number;
  /** Whether this brain currently has an active creature on the arena */
  alive: boolean;
  /** Reference to the bot's Brain implementation */
  code: Brain;
  /** Display color for leaderboard */
  color: string;
}

/**
 * Visual aura effect rendered around a creature during spells.
 * Matches the Aura prototype in battleground.js (lines 194-199).
 */
export interface Aura {
  /** Path to the aura sprite texture */
  texture: string;
  /** Current rotation angle */
  angle: number;
  /** Rotation speed per tick */
  spin: number;
  /** Total duration in ticks */
  duration: number;
  /** Current tick counter */
  counter: number;
}

/**
 * Internal creature — the full mutable state the engine works with.
 * Matches the Creature prototype in battleground.js (lines 149-170).
 * Bots only see the obfuscated CreatureView.
 */
export interface InternalCreature {
  /** Current hit points */
  lives: number;
  /** Current energy (regenerates each tick) */
  energy: number;
  /** Reference to this creature's brain record */
  brain: InternalBrain;
  /** Matter.js physics body */
  body: Matter.Body;
  /** Current bullet count */
  bullets: number;
  /** Creature level (0-2) */
  level: number;
  /** Kills since last respawn (used for level-up progression) */
  kills: number;
  /** Direction the death sprite faces */
  cryToTheLeft: boolean;
  /** Current display message */
  message: string | null;
  /** Timestamp of the last message (for auto-hide) */
  shouted: number;
  /** Whether creature is currently invisible (moose spell) */
  invisible: boolean;
  /** Whether creature is currently invulnerable (bull spell) */
  invulnerable: boolean;
  /** Remaining poison ticks (> 0 means poisoned) */
  poisonCounter: number;
  /** Whether creature's bullets are currently poisoned (runchip spell) */
  poisoner: boolean;
  /** Whether creature's magnet is active (rhino spell) */
  magnet: boolean;
  /** Whether creature's bullets are rubber (miner spell) */
  guttapercha: boolean;
  /** Remaining freeze ticks (> 0 means frozen, cannot act) */
  freezeCounter: number;
  /** Whether creature can freeze others (sprayer spell) */
  subzero: boolean;
  /** General spell duration counter (> 0 means currently spelling) */
  counter: number;
  /** External force to apply this tick (telekinesis, etc.) */
  force: Point | null;
}

/**
 * Internal bullet — the full mutable state the engine works with.
 * Matches the Bullet prototype in battleground.js (lines 172-177).
 */
export interface InternalBullet {
  /** Matter.js physics body */
  body: Matter.Body;
  /** The creature that fired this bullet (null for world-spawned bullets) */
  shooter: InternalCreature | null;
  /** Bullet shell type (determines special effects on hit) */
  shell: Shell;
  /** External force to apply this tick (magnet, etc.) */
  force: Point | null;
}

/**
 * Internal obstacle — the full mutable state the engine works with.
 * Matches the Obstacle prototype in battleground.js (lines 179-187).
 */
export interface InternalObstacle {
  /** Matter.js physics body */
  body: Matter.Body;
  /** Sprite variant index */
  shape: number;
  /** Number of sprite variants available */
  sprites: number;
  /** Maximum hit points (initial condition) */
  firmness: number;
  /** Current hit points (0 = destroyed) */
  condition: number;
  /** Object category: obstacle, dynamite, or star */
  type: ObjectType;
  /** External force to apply this tick */
  force: Point | null;
}
