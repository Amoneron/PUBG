/**
 * Programmers BattleGround — Spell Registry
 *
 * Maps each creature Kind to its SpellHandler implementation.
 * The Engine uses this registry to look up and execute spells when a bot
 * returns ActionType.spell from thinkAboutIt().
 *
 * Kinds without a spell (splitpus) simply have no entry in the map,
 * so getSpell() returns undefined and the engine treats the action as a no-op.
 */

import { Kind } from '../types/enums';
import type { SpellHandler } from './spells/SpellHandler';
import { InvisibleSpell } from './spells/InvisibleSpell';
import { InvulnerableSpell } from './spells/InvulnerableSpell';
import { MagnetSpell } from './spells/MagnetSpell';
import { PoisonerSpell } from './spells/PoisonerSpell';
import { GuttaperchaSpell } from './spells/GuttaperchaSpell';
import { VampireSpell } from './spells/VampireSpell';
import { TelekinesisSpell } from './spells/TelekinesisSpell';

export class SpellRegistry {
  private spells: Map<Kind, SpellHandler> = new Map();

  constructor() {
    this.spells.set(Kind.moose, new InvisibleSpell());
    this.spells.set(Kind.bull, new InvulnerableSpell());
    this.spells.set(Kind.rhino, new MagnetSpell());
    this.spells.set(Kind.runchip, new PoisonerSpell());
    this.spells.set(Kind.miner, new GuttaperchaSpell());
    this.spells.set(Kind.sprayer, new VampireSpell());
    this.spells.set(Kind.bear, new TelekinesisSpell());
    // Kind.splitpus has no spell — intentionally omitted
  }

  /** Look up the spell handler for a given creature kind, or undefined if none */
  getSpell(kind: Kind): SpellHandler | undefined {
    return this.spells.get(kind);
  }
}
