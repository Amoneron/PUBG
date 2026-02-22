/**
 * Programmers BattleGround — EntityRegistry
 *
 * Maps Matter.js body IDs to game entities so collision callbacks
 * can quickly look up what two bodies represent.
 */

import type { InternalCreature, InternalBullet, InternalObstacle } from '../types';

export type EntityType = 'creature' | 'bullet' | 'obstacle' | 'star';

export interface EntityEntry {
  type: EntityType;
  entity: InternalCreature | InternalBullet | InternalObstacle;
}

export class EntityRegistry {
  private map: Map<number, EntityEntry> = new Map();

  /**
   * Register a Matter.js body ID with its corresponding game entity.
   */
  register(bodyId: number, type: EntityType, entity: InternalCreature | InternalBullet | InternalObstacle): void {
    this.map.set(bodyId, { type, entity });
  }

  /**
   * Remove a body ID from the registry (when entity is destroyed/removed).
   */
  unregister(bodyId: number): void {
    this.map.delete(bodyId);
  }

  /**
   * Look up the game entity associated with a Matter.js body ID.
   */
  lookup(bodyId: number): EntityEntry | undefined {
    return this.map.get(bodyId);
  }

  /**
   * Remove all entries (used on full reset).
   */
  clear(): void {
    this.map.clear();
  }
}
