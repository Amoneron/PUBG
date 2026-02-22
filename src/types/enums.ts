/**
 * Programmers BattleGround — Game Enums
 *
 * All numeric enums match the original values from battleground.js (lines 29-36, 78)
 * and config.js. These values are used in the bot API and must remain stable.
 */

/** Actions a bot can return from thinkAboutIt() */
export enum ActionType {
  none = 0,
  move = 1,
  rotate = 2,
  turn = 3,
  shoot = 4,
  jump = 5,
  eat = 6,
  spell = 7,
}

/** Creature species — each has a unique spell ability */
export enum Kind {
  /** Spell: magnet (attracts nearby bullets) */
  rhino = 0,
  /** Spell: telekinesis (pushes objects/creatures) */
  bear = 1,
  /** Spell: invisibility */
  moose = 2,
  /** Spell: invulnerability */
  bull = 3,
  /** Spell: poisoned bullets */
  runchip = 4,
  /** Spell: rubber bullets (bounce off obstacles) */
  miner = 5,
  /** Spell: vampire (drains health) or freeze */
  sprayer = 6,
  /** No special spell */
  splitpus = 7,
}

/** Types of game events delivered to bots each tick */
export enum EventType {
  wound = 0,
  murder = 1,
  death = 2,
  upgrade = 3,
  birth = 4,
  spell = 5,
}

/** Types of world objects (obstacles, dynamites, stars) */
export enum ObjectType {
  obstacle = 0,
  dynamite = 1,
  star = 2,
}

/** Star sub-types that appear when obstacles are destroyed */
export enum StarShape {
  levelup = 0,
  healing = 1,
  poisoned = 2,
  frozen = 3,
  death = 4,
}

/** Bullet shell types — determined by creature kind and spell state */
export enum Shell {
  steel = 0,
  poisoned = 1,
  rubber = 2,
  ice = 3,
}
