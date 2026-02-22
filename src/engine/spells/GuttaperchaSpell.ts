/**
 * Programmers BattleGround — Guttapercha / Rubber Bullets Spell (Miner)
 *
 * Enchants the creature's bullets so they bounce off obstacles instead of
 * being destroyed on impact. The effect lasts for a fixed duration.
 * A red aura is displayed while active.
 *
 * Original: battleground.js lines 1474-1480
 */

import type { SpellHandler, SpellContext } from './SpellHandler';
import type { GameConfig } from '../../config';
import type { InternalCreature } from '../../types';

export class GuttaperchaSpell implements SpellHandler {
  canCast(creature: InternalCreature, config: GameConfig): boolean {
    return creature.energy >= config.guttaperchaEnergyCost;
  }

  cast(creature: InternalCreature, _target: any, _angle: number | undefined, ctx: SpellContext): void {
    creature.energy -= ctx.config.guttaperchaEnergyCost;
    creature.guttapercha = true;
    creature.counter = ctx.config.guttaperchaDuration;
    ctx.turnAuraOn(creature, 'red', 100000);
  }
}
