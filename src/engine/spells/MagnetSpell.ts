/**
 * Programmers BattleGround — Magnet Spell (Rhino)
 *
 * Activates a magnetic field that attracts nearby bullets towards the
 * creature for a short duration. A red aura is displayed while active.
 *
 * Original: battleground.js lines 1456-1462
 */

import type { SpellHandler, SpellContext } from './SpellHandler';
import type { GameConfig } from '../../config';
import type { InternalCreature } from '../../types';

export class MagnetSpell implements SpellHandler {
  canCast(creature: InternalCreature, config: GameConfig): boolean {
    return creature.energy >= config.magnetEnergyCost;
  }

  cast(creature: InternalCreature, _target: any, _angle: number | undefined, ctx: SpellContext): void {
    creature.energy -= ctx.config.magnetEnergyCost;
    creature.magnet = true;
    creature.counter = ctx.config.magnetDuration;
    ctx.turnAuraOn(creature, 'red', 100000);
  }
}
