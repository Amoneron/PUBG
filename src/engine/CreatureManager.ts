/**
 * Programmers BattleGround — CreatureManager
 *
 * Manages creature lifecycle: creation (incarnation), death cleanup,
 * spawning queue, level progression, visual embodiment, and aura effects.
 *
 * Ported from battleground.js lines 332-396 (incarnation, nextCreature),
 * 554-575 (updateCreatureLevel, updateCreatureEmbodiment),
 * 688-711 (turnAuraOn, turnAuraOff).
 */

import Matter from 'matter-js';
import type { GameConfig } from '../config';
import type { InternalCreature, InternalBrain, Aura } from '../types';
import { EventType } from '../types/enums';
import { Physics } from './Physics';
import { EntityRegistry } from './EntityRegistry';
import { EventBus } from './EventBus';
import { Obfuscator } from './Obfuscator';
import { randomInt, randomAngle } from '../utils/helpers';

const CREATURE_RAD = 30;
const IS_CREATURE = 2;

export class CreatureManager {
  private physics: Physics;
  private registry: EntityRegistry;
  private eventBus: EventBus;
  private obfuscator: Obfuscator;
  private config: GameConfig;

  /** All registered brains (bot definitions) */
  public brains: InternalBrain[] = [];
  /** Currently alive creatures on the arena */
  public creatures: InternalCreature[] = [];
  /** Tracks the last brain index that was spawned, for round-robin */
  private lastActivatedBrainId = -1;

  /** Optional callback fired when the leaderboard should be refreshed */
  public updateLeaderboard: () => void = () => {};

  constructor(
    physics: Physics,
    registry: EntityRegistry,
    eventBus: EventBus,
    obfuscator: Obfuscator,
    config: GameConfig,
  ) {
    this.physics = physics;
    this.registry = registry;
    this.eventBus = eventBus;
    this.obfuscator = obfuscator;
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // Incarnation — spawn a new creature for a brain
  // -------------------------------------------------------------------------

  /**
   * Create a new creature body for the brain at the given index.
   * Matches battleground.js lines 332-365.
   */
  incarnateCreatureForBrain(brainId: number): void {
    if (brainId < 0 || brainId >= this.brains.length) return;

    const brain = this.brains[brainId];
    const arena = this.config.arena;
    const margin = CREATURE_RAD * 2;

    const creature: InternalCreature = {
      lives: this.config.creatureMaxLives[0],
      energy: this.config.creatureMaxEnergy[0],
      brain,
      body: null as any,
      bullets: 1,
      level: 0,
      kills: 0,
      cryToTheLeft: Math.random() < 0.5,
      message: null,
      shouted: 0,
      invisible: false,
      invulnerable: false,
      poisonCounter: 0,
      poisoner: false,
      magnet: false,
      guttapercha: false,
      freezeCounter: 0,
      subzero: false,
      counter: 0,
      force: null,
    };

    brain.alive = true;

    const body = Matter.Bodies.circle(
      randomInt(margin, arena.width - margin),
      randomInt(margin, arena.height - margin),
      CREATURE_RAD,
      {
        restitution: 1,
        frictionAir: 0.09,
        collisionFilter: { category: IS_CREATURE },
        label: creature as any,
      },
    );
    Matter.Body.setAngle(body, randomAngle());
    creature.body = body;

    // Initialize render properties for sprite rendering
    (body as any).render = (body as any).render || {};
    (body as any).render.sprite = (body as any).render.sprite || {};
    this.updateCreatureEmbodiment(creature);

    this.physics.addBody(body);
    this.creatures.push(creature);
    this.registry.register(body.id, 'creature', creature);

    this.updateLeaderboard();

    // Emit birth event
    this.eventBus.pushBotEvent({
      type: EventType.birth,
      payload: [this.obfuscator.obfuscateCreature(creature)!],
    });
  }

  // -------------------------------------------------------------------------
  // Death cleanup
  // -------------------------------------------------------------------------

  /**
   * Remove a creature from the arena (physics world, arrays, registry).
   * Called by Combat.hurtCreature when the creature dies.
   */
  removeCreature(creature: InternalCreature): void {
    (creature.body as any).label = null;
    this.registry.unregister(creature.body.id);
    this.physics.removeBody(creature.body);
    const idx = this.creatures.indexOf(creature);
    if (idx >= 0) this.creatures.splice(idx, 1);
  }

  // -------------------------------------------------------------------------
  // Spawning queue — round-robin through dead brains
  // -------------------------------------------------------------------------

  /**
   * Spawn the next creature if the arena has room.
   * Iterates brains in order, wrapping around after the last one.
   * Matches battleground.js lines 379-396.
   */
  nextCreature(specifiedAliveCount: number): void {
    if (this.creatures.length >= specifiedAliveCount) return;

    let nextId = this.nextDeadBrainFromId(this.lastActivatedBrainId + 1);
    if (nextId < 0) {
      this.lastActivatedBrainId = -1;
      nextId = this.nextDeadBrainFromId(0);
    }
    if (nextId < 0) return;

    this.lastActivatedBrainId = nextId;
    this.incarnateCreatureForBrain(nextId);
  }

  /**
   * Find the next dead brain starting from index `id`.
   * Returns -1 if none found.
   */
  private nextDeadBrainFromId(id: number): number {
    if (id >= this.brains.length) return -1;
    for (let i = id; i < this.brains.length; i++) {
      if (!this.brains[i].alive) return i;
    }
    return -1;
  }

  // -------------------------------------------------------------------------
  // Level progression
  // -------------------------------------------------------------------------

  /**
   * Check and update creature level based on kill count.
   * When `force` is true, re-apply the current level stats (used by star
   * pickup). Matches battleground.js lines 554-568.
   */
  updateCreatureLevel(creature: InternalCreature, force: boolean): void {
    const killsToLevelUp = this.config.killsToLevelUp;
    let level = creature.kills >= killsToLevelUp[1] ? 2
      : creature.kills >= killsToLevelUp[0] ? 1
      : 0;
    if (level > creature.level || force) {
      if (force) level = creature.level;
      creature.level = level;
      creature.lives = this.config.creatureMaxLives[level];
      creature.energy = this.config.creatureMaxEnergy[level];
      this.updateCreatureEmbodiment(creature);
      this.turnAuraOn(creature, 'yellow', 120);
      // Emit upgrade event
      this.eventBus.pushBotEvent({
        type: EventType.upgrade,
        payload: [this.obfuscator.obfuscateCreature(creature)!],
      });
    }
  }

  // -------------------------------------------------------------------------
  // Visual embodiment — sprite selection based on health
  // -------------------------------------------------------------------------

  /**
   * Set the creature's sprite texture based on kind, level, and health.
   * Health index: 0 = healthy, 1 = wounded, 2 = critical.
   * Matches battleground.js lines 571-575.
   */
  updateCreatureEmbodiment(creature: InternalCreature): void {
    const max = this.config.creatureMaxLives[creature.level];
    const health = Math.round(((max - creature.lives) / max) * 2.0);
    const clampedHealth = Math.min(Math.max(health, 0), 2);
    (creature.body as any).render.sprite.texture =
      `./img/creatures/${creature.brain.kind}_${creature.level}_${clampedHealth}.png`;
  }

  // -------------------------------------------------------------------------
  // Aura effects
  // -------------------------------------------------------------------------

  /**
   * Activate a coloured aura around a creature for the given duration.
   * If a previous aura is still animating, the new aura's timing is adjusted
   * so the transition is smooth. Matches battleground.js lines 688-707.
   */
  turnAuraOn(creature: InternalCreature, color: string, duration: number): void {
    const anim = 30;
    const render = (creature.body as any).render;
    const prevAura = render.aura as Aura | undefined;
    const prevc = prevAura ? prevAura.counter : 0;
    const prevd = prevAura ? prevAura.duration : 0;
    let delta = 0;

    if (prevc > 0) {
      if (prevd - prevc < anim) delta = prevd - prevc;
      else if (prevc < anim) delta = prevc;
      else delta = anim;
    }

    const aura: Aura = {
      texture: `./img/effects/aura_${color}.png`,
      angle: 0,
      spin: Math.random() * 0.06 - 0.03,
      duration: duration + delta,
      counter: duration,
    };
    // Ensure spin is at least +/-0.01
    aura.spin += aura.spin > 0 ? 0.01 : -0.01;
    render.aura = aura;
  }

  /**
   * Begin fading out the creature's aura (sets counter to 50 ticks
   * remaining, which triggers the fade-out animation in the renderer).
   * Matches battleground.js lines 709-711.
   */
  turnAuraOff(creature: InternalCreature): void {
    const render = (creature.body as any).render;
    if (render.aura) {
      render.aura.counter = 50;
    }
  }
}
