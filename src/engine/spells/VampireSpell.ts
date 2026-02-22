/**
 * Programmers BattleGround — Vampire Spell (Sprayer)
 *
 * Drains half the target's health and one bullet (if available), transferring
 * them to the caster. The target must be within vampireDistance range.
 * Both creatures' sprites are updated to reflect the new health.
 *
 * Note: In the original battleground.js the sprayer kind appeared twice in the
 * spell switch (lines 1483 and 1514). The second entry (sub-zero / freeze)
 * was dead code because JavaScript switch falls through to the first match.
 * We only implement the Vampire spell here to match actual runtime behaviour.
 *
 * Original: battleground.js lines 1483-1500
 */

import type { SpellHandler, SpellContext } from './SpellHandler';
import type { GameConfig } from '../../config';
import type { InternalCreature } from '../../types';

export class VampireSpell implements SpellHandler {
  canCast(creature: InternalCreature, config: GameConfig): boolean {
    return creature.energy >= config.vampireEnergyCost;
  }

  cast(creature: InternalCreature, target: any, _angle: number | undefined, ctx: SpellContext): void {
    if (!target || !target.body) return;

    const dist = ctx.distanceBetween(creature.body, target.body);
    if (dist > ctx.config.vampireDistance) return;

    creature.energy -= ctx.config.vampireEnergyCost;

    const lives = Math.floor(target.lives / 2);
    const bullets = target.bullets > 0 ? 1 : 0;

    target.lives -= lives;
    target.bullets -= bullets;

    creature.lives += lives;
    const maxLives = ctx.config.creatureMaxLives[creature.level];
    if (creature.lives > maxLives) {
      creature.lives = maxLives;
    }

    creature.bullets += bullets;
    const maxBullets = ctx.config.creatureMaxBullets[creature.level];
    if (creature.bullets > maxBullets) {
      creature.bullets = maxBullets;
    }

    ctx.updateCreatureEmbodiment(target);
    ctx.updateCreatureEmbodiment(creature);
    ctx.turnAuraOn(creature, 'red', 120);
  }
}
