/**
 * Programmers BattleGround — Global Variable Installer
 *
 * Bots in the original codebase rely on a set of global variables and
 * helper functions being available at runtime.  This module recreates
 * that environment by writing to `globalThis`.
 *
 * Usage:
 *   import { installGlobals, installRayBetween } from './globals';
 *   installGlobals(config, config.arena);
 *   // … after Matter.Engine is created:
 *   installRayBetween(matterEngine);
 */

import Matter from 'matter-js';

import type { GameConfig } from './config';
import type { Arena } from './types/common';

import {
  distanceBetween,
  distanceBetweenPoints,
  angleBetween,
  angleBetweenPoints,
  normalizeAngle,
  differenceBetweenAngles,
} from './utils/geometry';

import { randomInt, randomAngle } from './utils/helpers';

// ---------------------------------------------------------------------------
// Frozen enum-like objects (match original battleground.js constants)
// ---------------------------------------------------------------------------

const actions = Object.freeze({
  none: 0,
  move: 1,
  rotate: 2,
  turn: 3,
  shoot: 4,
  jump: 5,
  eat: 6,
  spell: 7,
} as const);

const kinds = Object.freeze({
  rhino: 0,
  bear: 1,
  moose: 2,
  bull: 3,
  runchip: 4,
  miner: 5,
  sprayer: 6,
  splitpus: 7,
} as const);

const eventTypes = Object.freeze({
  wound: 0,
  murder: 1,
  death: 2,
  upgrade: 3,
  birth: 4,
  spell: 5,
} as const);

const objectTypes = Object.freeze({
  obstacle: 0,
  dynamite: 1,
  star: 2,
} as const);

const starShapes = Object.freeze({
  levelup: 0,
  healing: 1,
  poisoned: 2,
  frozen: 3,
  death: 4,
} as const);

const shells = Object.freeze({
  steel: 0,
  poisoned: 1,
  rubber: 2,
  ice: 3,
} as const);

// ---------------------------------------------------------------------------
// installGlobals — call once at startup
// ---------------------------------------------------------------------------

/**
 * Write every global that bots expect onto `globalThis`.
 *
 * @param config  The active GameConfig (usually defaultConfig).
 * @param arena   Arena dimensions (width / height).
 */
export function installGlobals(config: GameConfig, arena: Arena): void {
  const g = globalThis as Record<string, unknown>;

  // --- Frozen enum objects ---
  g.actions = actions;
  g.kinds = kinds;
  g.eventTypes = eventTypes;
  g.objectTypes = objectTypes;
  g.starShapes = starShapes;
  g.shells = shells;

  // --- Arena ---
  g.ground = Object.freeze({ width: arena.width, height: arena.height });

  // --- Creature progression ---
  g.creatureMaxLives = config.creatureMaxLives;
  g.creatureMaxBullets = config.creatureMaxBullets;
  g.creatureMaxEnergy = config.creatureMaxEnergy;
  g.killsToLevelUp = config.killsToLevelUp;

  // --- Population ---
  g.maxAliveCreatures = config.maxAliveCreatures;

  // --- Combat ---
  g.bulletDamage = config.bulletDamage;
  g.livesPerEatenBullet = config.livesPerEatenBullet;

  // --- Energy costs ---
  g.moveEnergyCost = config.moveEnergyCost;
  g.shotEnergyCost = config.shotEnergyCost;
  g.jumpEnergyCost = config.jumpEnergyCost;
  g.eatBulletEnergyCost = config.eatBulletEnergyCost;
  g.energyRefillPerTick = config.energyRefillPerTick;

  // --- Messages ---
  g.messageLineLimit = config.messageLineLimit;
  g.messageShowTime = config.messageShowTime;

  // --- Spell: Invisibility (Moose) ---
  g.invisibleEnergyCost = config.invisibleEnergyCost;
  g.invisibleDuration = config.invisibleDuration;

  // --- Spell: Invulnerability (Bull) ---
  g.invulnerableEnergyCost = config.invulnerableEnergyCost;
  g.invulnerableDuration = config.invulnerableDuration;

  // --- Spell: Magnet (Rhino) ---
  g.magnetEnergyCost = config.magnetEnergyCost;
  g.magnetDuration = config.magnetDuration;

  // --- Spell: Poisoner (Runchip) ---
  g.poisonerEnergyCost = config.poisonerEnergyCost;
  g.poisonerDuration = config.poisonerDuration;
  g.poisonDuration = config.poisonDuration;
  g.poisonHurt = config.poisonHurt;

  // --- Spell: Guttapercha / Rubber bullets (Miner) ---
  g.guttaperchaEnergyCost = config.guttaperchaEnergyCost;
  g.guttaperchaDuration = config.guttaperchaDuration;
  g.guttaperchaRestitution = config.guttaperchaRestitution;
  g.guttaperchaAirFriction = config.guttaperchaAirFriction;

  // --- Spell: Vampire (Sprayer) ---
  g.vampireEnergyCost = config.vampireEnergyCost;
  g.vampireDistance = config.vampireDistance;

  // --- Spell: Telekinesis (Bear) ---
  g.telekinesisEnergyCost = config.telekinesisEnergyCost;
  g.telekinesisForce = config.telekinesisForce;

  // --- Spell: Sub-zero / Freeze (Sprayer alt) ---
  g.subzeroEnergyCost = config.subzeroEnergyCost;
  g.subzeroDuration = config.subzeroDuration;
  g.freezeDuration = config.freezeDuration;

  // --- Geometry helpers ---
  g.distanceBetween = distanceBetween;
  g.distanceBetweenPoints = distanceBetweenPoints;
  g.angleBetween = angleBetween;
  g.angleBetweenPoints = angleBetweenPoints;
  g.normalizeAngle = normalizeAngle;
  g.differenceBetweenAngles = differenceBetweenAngles;

  // --- General helpers ---
  g.randomInt = randomInt;
  g.randomAngle = randomAngle;
}

// ---------------------------------------------------------------------------
// installRayBetween — call after the Matter.Engine is created
// ---------------------------------------------------------------------------

/**
 * Install `rayBetween` and `rayBetweenPoints` onto `globalThis`.
 *
 * These need a reference to the live Matter.Engine so they can query the
 * current physics world for obstacles between two points.
 *
 * @param matterEngine  The active Matter.Engine instance.
 */
export function installRayBetween(matterEngine: Matter.Engine): void {
  const rayBetweenPointsFn = (pt1: { x: number; y: number }, pt2: { x: number; y: number }): boolean => {
    const bodies = Matter.Composite.allBodies(matterEngine.world);
    const collisions = Matter.Query.ray(bodies, pt1, pt2);
    return collisions.length < 3;
  };

  const rayBetweenFn = (
    obj1: { position: { x: number; y: number } },
    obj2: { position: { x: number; y: number } },
  ): boolean => {
    return rayBetweenPointsFn(obj1.position, obj2.position);
  };

  (globalThis as Record<string, unknown>).rayBetween = rayBetweenFn;
  (globalThis as Record<string, unknown>).rayBetweenPoints = rayBetweenPointsFn;
}
