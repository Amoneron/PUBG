/**
 * Programmers BattleGround — Invisibility Spell (Moose)
 *
 * Makes the creature invisible for a fixed number of ticks.
 * While invisible the creature's body render opacity drops to 0.1
 * and enemies cannot see it in their input data.
 *
 * Original: battleground.js lines 1438-1444
 */

import type { SpellHandler, SpellContext } from './SpellHandler';
import type { GameConfig } from '../../config';
import type { InternalCreature } from '../../types';

export class InvisibleSpell implements SpellHandler {
  canCast(creature: InternalCreature, config: GameConfig): boolean {
    return creature.energy >= config.invisibleEnergyCost;
  }

  cast(creature: InternalCreature, _target: any, _angle: number | undefined, ctx: SpellContext): void {
    creature.energy -= ctx.config.invisibleEnergyCost;
    creature.invisible = true;
    creature.counter = ctx.config.invisibleDuration;
    creature.body.render.opacity = 0.1;
  }
}
