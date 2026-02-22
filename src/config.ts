/**
 * Programmers BattleGround — Typed Game Configuration
 *
 * Every field matches the original config.js values exactly.
 * The original had a semicolon-instead-of-comma bug that split the
 * declarations into separate `const` blocks; here everything lives in
 * a single typed object so the bug cannot recur.
 */

import type { Arena } from './types/common';

// ---------------------------------------------------------------------------
// GameConfig interface — every tunable knob in the game
// ---------------------------------------------------------------------------

export interface GameConfig {
  /** Filenames of brain scripts (legacy, kept for reference) */
  sources: string[];
  /** Randomise the brain loading order */
  shuffleBrains: boolean;

  // --- Arena ---
  arena: Arena;

  // --- Creature progression ---
  creatureMaxLives: [number, number, number];
  creatureMaxEnergy: [number, number, number];
  creatureMaxBullets: [number, number, number];
  killsToLevelUp: [number, number];

  // --- Population ---
  maxAliveCreatures: number;

  // --- Combat ---
  bulletDamage: number;
  livesPerEatenBullet: number;

  // --- Energy costs ---
  moveEnergyCost: number;
  shotEnergyCost: number;
  jumpEnergyCost: number;
  eatBulletEnergyCost: number;
  energyRefillPerTick: number;

  // --- World generation ---
  bulletsGeneratorFrequencyPerCreature: number;
  obstaclesDensity: number;
  dynamitesProbability: number;
  starsProbability: number;

  // --- Messages ---
  messageLineLimit: number;
  messageShowTime: number;

  // --- Spell: Invisibility (Moose) ---
  invisibleEnergyCost: number;
  invisibleDuration: number;

  // --- Spell: Invulnerability (Bull) ---
  invulnerableEnergyCost: number;
  invulnerableDuration: number;

  // --- Spell: Magnet (Rhino) ---
  magnetEnergyCost: number;
  magnetDuration: number;

  // --- Spell: Poisoner (Runchip) ---
  poisonerEnergyCost: number;
  poisonerDuration: number;
  poisonDuration: number;
  poisonHurt: number;

  // --- Spell: Guttapercha / Rubber bullets (Miner) ---
  guttaperchaEnergyCost: number;
  guttaperchaDuration: number;
  guttaperchaRestitution: number;
  guttaperchaAirFriction: number;

  // --- Spell: Vampire (Sprayer) ---
  vampireEnergyCost: number;
  vampireDistance: number;

  // --- Spell: Telekinesis (Bear) ---
  telekinesisEnergyCost: number;
  telekinesisForce: number;

  // --- Spell: Sub-zero / Freeze (Sprayer alt) ---
  subzeroEnergyCost: number;
  subzeroDuration: number;
  freezeDuration: number;
}

// ---------------------------------------------------------------------------
// Default configuration — values taken verbatim from config.js
// ---------------------------------------------------------------------------

export const defaultConfig: GameConfig = {
  sources: [
    'br_edmund.js',
    'br_bulletbull.js',
    'br_dexter.js',
    'br_enigma.js',
    'br_mindblast.js',
    'br_rathorn.js',
    'br_reptile.js',
    'br_pacifist.js',
    'br_derzkyi.js',
    'br_utilizator.js',
    'br_yssysin.js',
    'br_helltrain.js',
    'br_niloultet.js',
    'br_prosucc.js',
    'br_hodor.js',
  ],
  shuffleBrains: true,

  arena: { width: 1024, height: 768 },

  creatureMaxLives: [100.0, 150.0, 250.0],
  creatureMaxEnergy: [100.0, 150.0, 250.0],
  creatureMaxBullets: [3, 4, 5],
  killsToLevelUp: [2, 4],

  maxAliveCreatures: 4,

  bulletDamage: 10,
  livesPerEatenBullet: 40,

  moveEnergyCost: 1.0,
  shotEnergyCost: 10,
  jumpEnergyCost: 30,
  eatBulletEnergyCost: 60,
  energyRefillPerTick: 0.8,

  bulletsGeneratorFrequencyPerCreature: 5,
  obstaclesDensity: 100,
  dynamitesProbability: 0.15,
  starsProbability: 0.3,

  messageLineLimit: 20,
  messageShowTime: 3 * 1000,

  invisibleEnergyCost: 100,
  invisibleDuration: 80,

  invulnerableEnergyCost: 100,
  invulnerableDuration: 80,

  magnetEnergyCost: 100,
  magnetDuration: 5,

  poisonerEnergyCost: 100,
  poisonerDuration: 80,
  poisonDuration: 50,
  poisonHurt: 1,

  guttaperchaEnergyCost: 100,
  guttaperchaDuration: 80,
  guttaperchaRestitution: 0.95,
  guttaperchaAirFriction: 0.001,

  vampireEnergyCost: 100,
  vampireDistance: 120,

  telekinesisEnergyCost: 2.0,
  telekinesisForce: 0.05,

  subzeroEnergyCost: 100,
  subzeroDuration: 80,
  freezeDuration: 30,
};
