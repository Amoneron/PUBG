/**
 * Programmers BattleGround — Telekinesis Spell (Bear)
 *
 * Pushes the target (creature or obstacle) in a given direction by applying
 * a physics force proportional to the target's mass. Requires both a target
 * and a numeric angle parameter — the spell silently fails without them.
 *
 * Original: battleground.js lines 1503-1511
 */

import type { SpellHandler, SpellContext } from './SpellHandler';
import type { GameConfig } from '../../config';
import type { InternalCreature } from '../../types';

export class TelekinesisSpell implements SpellHandler {
  canCast(creature: InternalCreature, config: GameConfig): boolean {
    return creature.energy >= config.telekinesisEnergyCost;
  }

  cast(creature: InternalCreature, target: any, angle: number | undefined, ctx: SpellContext): void {
    if (!target || !target.body || !ctx.isNumber(angle)) return;

    creature.energy -= ctx.config.telekinesisEnergyCost;

    const force = (target.body.mass / 2.8) * ctx.config.telekinesisForce;
    const vector = {
      x: Math.cos(angle!) * force,
      y: Math.sin(angle!) * force,
    };

    ctx.applyForce(target.body, target.body.position, vector);
    ctx.turnAuraOn(creature, 'red', 120);
  }
}
