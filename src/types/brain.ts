/**
 * Programmers BattleGround — Brain Interface & Action
 *
 * The public API that every bot must implement.
 * thinkAboutIt() is called every tick by the engine.
 */

import type { ActionType, Kind } from './enums';
import type { CreatureView } from './creature';
import type { BulletView } from './bullet';
import type { GameObjectView } from './game-object';
import type { GameEvent } from './event';

/** The action returned by a bot's thinkAboutIt() */
export interface Action {
  /** Which action to perform */
  do: ActionType;
  /** Optional parameters for the action */
  params?: {
    /** Direction angle in radians (for move, turn, jump, spell) */
    angle?: number;
    /** Rotation direction (for rotate: true = clockwise) */
    clockwise?: boolean;
    /** Target for spell abilities (creature id, object, etc.) */
    target?: any;
    /** Display message (max 2 lines, 20 chars per line) */
    message?: string;
  };
}

/**
 * The interface every bot must implement.
 *
 * The engine calls thinkAboutIt() once per tick, passing the current
 * world state. The bot returns an Action describing what it wants to do.
 */
export interface Brain {
  /** Bot display name (max 10 characters) */
  name: string;
  /** Creature species — determines sprite and spell ability */
  kind: Kind;
  /** Author display name (max 10 characters) */
  author: string;
  /** Human-readable description of the bot's strategy */
  description: string;

  /**
   * Called every tick by the engine.
   *
   * @param self      - The bot's own creature state
   * @param enemies   - All other living creatures on the arena
   * @param bullets   - All bullets currently on the arena
   * @param objects   - All obstacles, dynamites, and stars on the arena
   * @param events    - Events that occurred this tick (wounds, kills, etc.)
   * @returns The action the bot wants to perform
   */
  thinkAboutIt(
    self: CreatureView,
    enemies: CreatureView[],
    bullets: BulletView[],
    objects: GameObjectView[],
    events: GameEvent[],
  ): Action;

  /** Allow additional properties for bot-specific internal state */
  [key: string]: any;
}
