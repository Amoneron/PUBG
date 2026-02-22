/**
 * Programmers BattleGround — Spell Handler Interface
 *
 * Defines the contract that every creature spell must satisfy, plus the
 * SpellContext bag of engine services each spell may need during casting.
 */

import type { GameConfig } from '../../config';
import type { InternalCreature, InternalObstacle } from '../../types';

/**
 * Engine services and state available to spell implementations at cast time.
 *
 * By injecting these through a context object (instead of importing engine
 * internals directly) we keep the spell classes decoupled and testable.
 */
export interface SpellContext {
  /** Current game configuration snapshot */
  config: GameConfig;
  /** All creatures currently alive on the arena */
  creatures: InternalCreature[];
  /** All obstacles currently on the arena */
  obstacles: InternalObstacle[];

  /** Activate a coloured aura effect around a creature */
  turnAuraOn: (creature: InternalCreature, color: string, duration: number) => void;
  /** Refresh a creature's sprite to reflect changed lives / level */
  updateCreatureEmbodiment: (creature: InternalCreature) => void;
  /** Euclidean distance between two Matter.js bodies (centre-to-centre) */
  distanceBetween: (obj1: any, obj2: any) => number;
  /** Type-guard: true when the value is a finite number */
  isNumber: (n: any) => boolean;
  /** Apply a force vector to a Matter.js body */
  applyForce: (body: any, position: any, force: any) => void;
}

/**
 * Every creature kind that has a spell ability provides a SpellHandler.
 *
 * `canCast` is checked before `cast` — if the creature lacks enough energy
 * (or any other precondition) the engine will skip the spell silently.
 */
export interface SpellHandler {
  /** Return true when the creature meets the preconditions for this spell */
  canCast(creature: InternalCreature, config: GameConfig): boolean;

  /**
   * Execute the spell effect.
   *
   * @param creature - The creature casting the spell.
   * @param target   - Optional target (creature / obstacle) chosen by the bot.
   * @param angle    - Optional angle parameter (used by telekinesis, etc.).
   * @param ctx      - Engine services needed during cast.
   */
  cast(creature: InternalCreature, target: any, angle: number | undefined, ctx: SpellContext): void;
}
