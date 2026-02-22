/**
 * Programmers BattleGround — Invulnerability Spell (Bull)
 *
 * Grants the creature temporary invulnerability — incoming damage is ignored
 * for the spell's duration. A red aura is displayed while active.
 *
 * Original: battleground.js lines 1447-1453
 */

import type { SpellHandler, SpellContext } from './SpellHandler';
import type { GameConfig } from '../../config';
import type { InternalCreature } from '../../types';

export class InvulnerableSpell implements SpellHandler {
  canCast(creature: InternalCreature, config: GameConfig): boolean {
    return creature.energy >= config.invulnerableEnergyCost;
  }

  cast(creature: InternalCreature, _target: any, _angle: number | undefined, ctx: SpellContext): void {
    creature.energy -= ctx.config.invulnerableEnergyCost;
    creature.invulnerable = true;
    creature.counter = ctx.config.invulnerableDuration;
    ctx.turnAuraOn(creature, 'red', 100000);
  }
}
