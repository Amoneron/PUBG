/**
 * Programmers BattleGround — Physics
 *
 * Wrapper around Matter.js. Creates the engine, world (gravity 0),
 * arena walls. Provides methods to add/remove bodies, step physics,
 * and listen for collisions.
 *
 * Arena wall setup matches battleground.js lines 730-742.
 */

import Matter from 'matter-js';
import type { Arena } from '../types';

export class Physics {
  public engine: Matter.Engine;
  public world: Matter.World;

  constructor(arena: Arena) {
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;

    // Zero gravity — top-down arena
    this.world.gravity.x = 0;
    this.world.gravity.y = 0;

    // Create arena boundary walls (from battleground.js lines 730-742)
    const blockW = 1000;
    const blockOff = blockW / 2;
    const blockMrg = 200;
    const w = arena.width;
    const h = arena.height;
    const wh = w / 2;
    const hh = h / 2;
    const opt: Matter.IChamferableBodyDefinition = { isStatic: true };

    const edgeTop = Matter.Bodies.rectangle(wh, -blockOff, w + blockMrg, blockW, opt);
    const edgeRight = Matter.Bodies.rectangle(w + blockOff, hh, blockW, h + blockMrg, opt);
    const edgeBottom = Matter.Bodies.rectangle(wh, h + blockOff, w + blockMrg, blockW, opt);
    const edgeLeft = Matter.Bodies.rectangle(-blockOff, hh, blockW, h + blockMrg, opt);

    Matter.Composite.add(this.world, [edgeTop, edgeRight, edgeBottom, edgeLeft]);
  }

  /**
   * Add a body to the physics world.
   */
  addBody(body: Matter.Body): void {
    Matter.Composite.add(this.world, body);
  }

  /**
   * Remove a body from the physics world.
   */
  removeBody(body: Matter.Body): void {
    Matter.Composite.remove(this.world, body);
  }

  /**
   * Advance the physics simulation by one step.
   * @param delta - Time step in ms (defaults to Matter.js default ~16.67ms)
   */
  update(delta?: number): void {
    Matter.Engine.update(this.engine, delta);
  }

  /**
   * Register a callback for collision start events.
   */
  onCollision(callback: (pairs: Matter.Pair[]) => void): void {
    Matter.Events.on(this.engine, 'collisionStart', (event: Matter.IEventCollision<Matter.Engine>) => {
      callback(event.pairs);
    });
  }

  /**
   * Register a callback that fires before each physics update.
   */
  onBeforeUpdate(callback: () => void): void {
    Matter.Events.on(this.engine, 'beforeUpdate', callback);
  }
}
