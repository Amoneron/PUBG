/**
 * Programmers BattleGround — Poisoner Spell (Runchip)
 *
 * Enchants the creature's bullets with poison for a fixed duration.
 * Any creature hit by a poisoned bullet takes damage over time.
 * A red aura is displayed while active.
 *
 * Original: battleground.js lines 1465-1471
 */

import type { SpellHandler, SpellContext } from './SpellHandler';
import type { GameConfig } from '../../config';
import type { InternalCreature } from '../../types';

export class PoisonerSpell implements SpellHandler {
  canCast(creature: InternalCreature, config: GameConfig): boolean {
    return creature.energy >= config.poisonerEnergyCost;
  }

  cast(creature: InternalCreature, _target: any, _angle: number | undefined, ctx: SpellContext): void {
    creature.energy -= ctx.config.poisonerEnergyCost;
    creature.poisoner = true;
    creature.counter = ctx.config.poisonerDuration;
    ctx.turnAuraOn(creature, 'red', 100000);
  }
}
