/**
 * Programmers BattleGround — Type System Barrel Export
 *
 * Re-exports all public types and enums from a single entry point.
 * Usage: import { Brain, CreatureView, ActionType, ... } from './types';
 */

// Enums (exported as values + types)
export { ActionType, Kind, EventType, ObjectType, StarShape, Shell } from './enums';

// Common geometric types
export type { Point, Bounds, Arena } from './common';

// Bot-facing view types (read-only snapshots passed to thinkAboutIt)
export type { CreatureView } from './creature';
export type { BulletView } from './bullet';
export type { GameObjectView } from './game-object';
export type { GameEvent } from './event';

// Bot API
export type { Action, Brain } from './brain';

// Engine-internal mutable types
export type {
  InternalBrain,
  Aura,
  InternalCreature,
  InternalBullet,
  InternalObstacle,
} from './internal';
