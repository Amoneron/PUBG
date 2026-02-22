/**
 * Programmers BattleGround — BotSandbox
 *
 * Safely calls a bot's thinkAboutIt() inside a try/catch.
 * If the bot throws an error or returns an invalid action,
 * the sandbox returns ActionType.none so the game continues.
 */

import { ActionType } from '../types/enums';
import type { Action, Brain, CreatureView, BulletView, GameObjectView, GameEvent } from '../types';

export class BotSandbox {
  /**
   * Invoke a bot's thinkAboutIt() method with full world state.
   *
   * @param brain   - The bot implementation
   * @param self    - The bot's own creature view
   * @param enemies - All other living creatures on the arena
   * @param bullets - All bullets currently on the arena
   * @param objects - All obstacles, dynamites, and stars on the arena
   * @param events  - Events that occurred this tick
   * @returns The action the bot wants to perform, or { do: none } on error
   */
  callBot(
    brain: Brain,
    self: CreatureView,
    enemies: CreatureView[],
    bullets: BulletView[],
    objects: GameObjectView[],
    events: GameEvent[],
  ): Action {
    try {
      const result = brain.thinkAboutIt(self, enemies, bullets, objects, events);
      if (result && typeof result.do === 'number') {
        return result;
      }
      return { do: ActionType.none };
    } catch (e) {
      console.error(`Bot "${brain.name}" error:`, e);
      return { do: ActionType.none };
    }
  }
}
