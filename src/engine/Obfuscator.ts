/**
 * Programmers BattleGround — Obfuscator
 *
 * Creates read-only view copies of internal game entities for bots.
 * Bots must not have direct access to mutable engine state, so every
 * tick the engine obfuscates each entity before passing it to
 * thinkAboutIt().
 *
 * Matches the obfuscation logic in battleground.js lines 577-618.
 */

import type {
  CreatureView,
  BulletView,
  GameObjectView,
  InternalCreature,
  InternalBullet,
  InternalObstacle,
} from '../types';

export class Obfuscator {
  /** Bullets moving at or above this speed are flagged as dangerous */
  private dangerousBulletSpeed = 5;

  /**
   * Create a CreatureView from an internal creature.
   * Returns null if the creature is null/undefined.
   */
  obfuscateCreature(c: InternalCreature): CreatureView | null {
    if (c == null) return null;
    return {
      id: c.body.id,
      kills: c.brain.kills,
      deaths: c.brain.deaths,
      iq: c.brain.iq,
      author: c.brain.author,
      name: c.brain.name,
      lives: c.lives,
      bullets: c.bullets,
      energy: c.energy,
      level: c.level,
      position: c.body.position,
      velocity: c.body.velocity,
      angle: c.body.angle,
      speed: c.body.speed,
      angularVelocity: c.body.angularVelocity,
      poisoned: c.poisonCounter > 0,
      spelling: c.counter > 0,
      message: c.message,
    };
  }

  /**
   * Create a BulletView from an internal bullet.
   * Returns null if the bullet is null/undefined.
   */
  obfuscateBullet(b: InternalBullet): BulletView | null {
    if (b == null) return null;
    return {
      id: b.body.id,
      position: b.body.position,
      velocity: b.body.velocity,
      speed: b.body.speed,
      dangerous: b.body.speed >= this.dangerousBulletSpeed,
    };
  }

  /**
   * Create a GameObjectView from an internal obstacle/dynamite/star.
   * Returns null if the obstacle is null/undefined.
   */
  obfuscateObstacle(o: InternalObstacle): GameObjectView | null {
    if (o == null) return null;
    return {
      id: o.body.id,
      position: o.body.position,
      velocity: o.body.velocity,
      speed: o.body.speed,
      bounds: o.body.bounds,
      type: o.type,
      shape: o.shape,
      condition: o.condition,
    };
  }
}
