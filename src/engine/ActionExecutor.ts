/**
 * Programmers BattleGround — ActionExecutor
 *
 * Executes actions returned by bots from thinkAboutIt().
 * Ported from battleground.js lines 1367-1523 (move, shoot, jump, torque,
 * turnToAngle, eatBullet, spell).
 */

import Matter from 'matter-js';
import type { GameConfig } from '../config';
import type { InternalCreature, InternalBullet, InternalObstacle } from '../types';
import { Shell, Kind, EventType } from '../types/enums';
import { Spawner } from './Spawner';
import { SpellRegistry } from './SpellRegistry';
import type { SpellContext } from './spells/SpellHandler';
import { EventBus } from './EventBus';
import { Obfuscator } from './Obfuscator';
import { isNumber } from '../utils/helpers';
import { differenceBetweenAngles, distanceBetween } from '../utils/geometry';

const CREATURE_RAD = 30;
const BULLET_RAD = 5;
const MOVE_FORCE = 0.04;
const JUMP_FORCE = 0.1;
const TORQUE_FORCE = 0.5;

export class ActionExecutor {
  private config: GameConfig;
  private spawner: Spawner;
  private spellRegistry: SpellRegistry;
  private eventBus: EventBus;
  private obfuscator: Obfuscator;

  /** Callback wired by Engine after construction */
  public turnAuraOn: (creature: InternalCreature, color: string, duration: number) => void = () => {};
  /** Callback wired by Engine after construction */
  public updateCreatureEmbodiment: (creature: InternalCreature) => void = () => {};

  constructor(
    config: GameConfig,
    spawner: Spawner,
    spellRegistry: SpellRegistry,
    eventBus: EventBus,
    obfuscator: Obfuscator,
  ) {
    this.config = config;
    this.spawner = spawner;
    this.spellRegistry = spellRegistry;
    this.eventBus = eventBus;
    this.obfuscator = obfuscator;
  }

  /**
   * Move creature in the given direction.
   * Force is applied at an offset point on the creature's facing edge,
   * which causes slight rotation when moving sideways — matching original.
   */
  move(creature: InternalCreature, angle: number): void {
    if (!isNumber(angle)) return;
    if (creature.energy < this.config.moveEnergyCost) return;
    creature.energy -= this.config.moveEnergyCost;
    const body = creature.body;
    const point = {
      x: body.position.x + Math.cos(body.angle) * CREATURE_RAD,
      y: body.position.y + Math.sin(body.angle) * CREATURE_RAD,
    };
    const vector = {
      x: Math.cos(angle) * MOVE_FORCE,
      y: Math.sin(angle) * MOVE_FORCE,
    };
    Matter.Body.applyForce(body, point, vector);
  }

  /**
   * Fire a bullet in the direction the creature is facing.
   * Shell type depends on active spell buffs (subzero > rubber > poisoned > steel).
   */
  shoot(creature: InternalCreature): void {
    if (creature.bullets < 1) return;
    if (creature.energy < this.config.shotEnergyCost) return;
    creature.bullets--;
    creature.energy -= this.config.shotEnergyCost;
    const body = creature.body;
    const point = {
      x: body.position.x + Math.cos(body.angle) * (CREATURE_RAD + BULLET_RAD * 2.0),
      y: body.position.y + Math.sin(body.angle) * (CREATURE_RAD + BULLET_RAD * 2.0),
    };
    const shell = creature.subzero ? Shell.ice
      : creature.guttapercha ? Shell.rubber
      : creature.poisoner ? Shell.poisoned
      : Shell.steel;
    this.spawner.shot(point, body.angle, creature, false, shell);
  }

  /**
   * Jump in a direction (high-energy burst of movement).
   */
  jump(creature: InternalCreature, angle: number): void {
    if (!isNumber(angle)) return;
    if (creature.energy < this.config.jumpEnergyCost) return;
    creature.energy -= this.config.jumpEnergyCost;
    const vector = {
      x: Math.cos(angle) * JUMP_FORCE,
      y: Math.sin(angle) * JUMP_FORCE,
    };
    Matter.Body.applyForce(creature.body, creature.body.position, vector);
  }

  /**
   * Apply angular torque (spin in place).
   */
  torque(creature: InternalCreature, clockwise: boolean): void {
    creature.body.torque = TORQUE_FORCE * (clockwise ? 1.0 : -1.0);
  }

  /**
   * Gradually turn towards a target angle.
   * Torque is proportional to the angular difference.
   */
  turnToAngle(creature: InternalCreature, angle: number): void {
    if (!isNumber(angle)) return;
    const diff = differenceBetweenAngles(creature.body.angle, angle);
    const maxf = 2.0;
    creature.body.torque = (diff / Math.PI * maxf);
  }

  /**
   * Consume one bullet to heal.
   * Also clears poison if active.
   */
  eatBullet(creature: InternalCreature): void {
    if (creature.bullets < 1) return;
    if (creature.energy < this.config.eatBulletEnergyCost) return;
    creature.bullets--;
    creature.energy -= this.config.eatBulletEnergyCost;
    creature.lives += this.config.livesPerEatenBullet;
    const maxLives = this.config.creatureMaxLives[creature.level];
    if (creature.lives > maxLives) creature.lives = maxLives;
    if (creature.poisonCounter > 0) {
      creature.poisonCounter = 0;
      // Turn off the poison aura
      const render = (creature.body as any).render;
      if (render && render.aura) {
        render.aura.counter = 50;
      }
    }
    this.updateCreatureEmbodiment(creature);
  }

  /**
   * Cast the creature's species-specific spell ability.
   * Requires level >= 1. Emits a spell event regardless of whether the
   * spell handler accepts the cast (matching original behaviour).
   */
  spell(
    creature: InternalCreature,
    target: InternalCreature | InternalObstacle | null,
    angle: number | undefined,
    creatures: InternalCreature[],
    obstacles: InternalObstacle[],
  ): void {
    if (creature.level < 1) return;

    // Emit spell event (always, even if the spell fails energy check)
    this.eventBus.pushBotEvent({
      type: EventType.spell,
      payload: [this.obfuscator.obfuscateCreature(creature)!],
    });

    const handler = this.spellRegistry.getSpell(creature.brain.kind as Kind);
    if (!handler) return;
    if (!handler.canCast(creature, this.config)) return;

    const ctx: SpellContext = {
      config: this.config,
      creatures,
      obstacles,
      turnAuraOn: this.turnAuraOn,
      updateCreatureEmbodiment: this.updateCreatureEmbodiment,
      distanceBetween,
      isNumber,
      applyForce: Matter.Body.applyForce,
    };

    handler.cast(creature, target, angle, ctx);
  }
}
