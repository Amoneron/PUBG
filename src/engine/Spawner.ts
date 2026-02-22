import Matter from 'matter-js';
import type { GameConfig } from '../config';
import type { InternalBullet, InternalObstacle, InternalCreature, Point } from '../types';
import { ObjectType, Shell, StarShape } from '../types/enums';
import { Physics } from './Physics';
import { EntityRegistry } from './EntityRegistry';
import { obstacleTemplates, dynamiteTemplates } from './ObstacleTemplates';
import { randomInt, randomAngle } from '../utils/helpers';

const CREATURE_RAD = 30;
const BULLET_RAD = 5;
const BULLET_FORCE = 15.5;
const IS_BULLET = 3;
const IS_OBSTACLE = 4;
const IS_STAR = 5;

const BULLET_COLORS = [
  { fill: '#FFF000', stroke: '#BEB320' },  // steel
  { fill: '#42FF00', stroke: '#299E00' },  // poisoned
  { fill: '#FF581E', stroke: '#C93400' },  // rubber
  { fill: '#00AEFF', stroke: '#0093A0' },  // ice
];

export class Spawner {
  private physics: Physics;
  private registry: EntityRegistry;
  private config: GameConfig;
  public obstacles: InternalObstacle[] = [];
  public bullets: InternalBullet[] = [];

  constructor(physics: Physics, registry: EntityRegistry, config: GameConfig) {
    this.physics = physics;
    this.registry = registry;
    this.config = config;
  }

  newRandomObstacle(): void {
    const obsType = Math.random() < this.config.dynamitesProbability ? ObjectType.dynamite : ObjectType.obstacle;
    this.newObstacle(obsType);
  }

  newObstacle(type: ObjectType): void {
    const templates = type === ObjectType.dynamite ? dynamiteTemplates : obstacleTemplates;
    const shape = randomInt(0, templates.length - 1);
    const tmpl = templates[shape];

    const w = tmpl.w || 0;
    const h = tmpl.h || 0;
    const r = tmpl.r || 0;
    const d = tmpl.density;
    const f = tmpl.firmness;
    const s = tmpl.sprites;
    const fa = tmpl.frictionAir || 0.09;

    this.createObstacle(type, shape, s, f, 0, 0, w, h, r, 1.0, fa, d, { x: 0, y: 0 }, 0);
  }

  newStar(pos: Point, vel: Point): void {
    let shape = randomInt(0, 4);
    // Death star has low probability
    if (Math.random() < 0.1) shape = StarShape.death;
    const tor = Math.random() * 2.0 - 1.0;
    this.createObstacle(ObjectType.star, shape, 1, 20, pos.x, pos.y, 0, 0, 11, 1.0, 0.09, 1.0, vel, tor);
  }

  createObstacle(
    type: ObjectType, shape: number, sprites: number, firmness: number,
    x: number, y: number, w: number, h: number, r: number,
    rs: number, fa: number, d: number, vel: Point, tor: number
  ): InternalObstacle {
    const margin = CREATURE_RAD * 2;
    const arena = this.config.arena;

    const obstacle: InternalObstacle = {
      body: null as any,
      shape,
      sprites,
      firmness,
      condition: firmness - 1,
      type,
      force: null,
    };

    d *= 0.001; // default density multiplier

    if (x === 0) {
      x = randomInt(margin, arena.width - margin);
      y = randomInt(margin, arena.height - margin);
    }

    const body = r === 0
      ? Matter.Bodies.rectangle(x, y, w, h)
      : Matter.Bodies.circle(x, y, r);
    body.restitution = rs;
    body.frictionAir = fa;
    (body as any).label = obstacle;
    body.collisionFilter.category = type === ObjectType.star ? IS_STAR : IS_OBSTACLE;
    Matter.Body.setDensity(body, d);
    Matter.Body.setAngle(body, randomAngle());

    obstacle.body = body;
    this.physics.addBody(body);
    this.obstacles.push(obstacle);
    this.registry.register(body.id, type === ObjectType.star ? 'star' : 'obstacle', obstacle);

    // Set initial sprite
    const spriteIndex = Math.floor((obstacle.condition / obstacle.firmness) * obstacle.sprites);
    (body as any).render = (body as any).render || {};
    (body as any).render.sprite = (body as any).render.sprite || {};
    (body as any).render.sprite.texture = `./img/obstacles/${obstacle.type}_${obstacle.shape}_${spriteIndex}.png`;

    if (vel.x !== 0 || vel.y !== 0) Matter.Body.setVelocity(body, vel);
    if (tor !== 0) Matter.Body.setAngularVelocity(body, tor);

    return obstacle;
  }

  dropBullet(): void {
    const margin = CREATURE_RAD * 2;
    const arena = this.config.arena;
    const x = randomInt(margin, arena.width - margin);
    const y = randomInt(margin, arena.height - margin);
    this.shot({ x, y }, 0, null, true, Shell.steel);
  }

  shot(pos: Point, angle: number, shooter: InternalCreature | null, dry: boolean, shell: Shell): InternalBullet {
    const blt: InternalBullet = {
      body: null as any,
      shooter,
      shell,
      force: null,
    };

    const restitution = shell === Shell.rubber ? this.config.guttaperchaRestitution : 0.2;
    const frictionAir = shell === Shell.rubber ? this.config.guttaperchaAirFriction : 0.015;

    const bullet = Matter.Bodies.circle(pos.x, pos.y, BULLET_RAD, {
      restitution,
      frictionAir,
      collisionFilter: { category: IS_BULLET },
      label: blt as any,
      render: {
        fillStyle: BULLET_COLORS[shell].fill,
        strokeStyle: BULLET_COLORS[shell].stroke,
      },
    });

    blt.body = bullet;
    this.bullets.push(blt);
    this.physics.addBody(bullet);
    this.registry.register(bullet.id, 'bullet', blt);

    if (!dry) {
      Matter.Body.setVelocity(bullet, {
        x: Math.cos(angle) * BULLET_FORCE,
        y: Math.sin(angle) * BULLET_FORCE,
      });
    }

    return blt;
  }

  removeBullet(bullet: InternalBullet): void {
    const idx = this.bullets.indexOf(bullet);
    if (idx >= 0) this.bullets.splice(idx, 1);
    this.registry.unregister(bullet.body.id);
    (bullet.body as any).label = null;
    this.physics.removeBody(bullet.body);
  }

  removeObstacle(obstacle: InternalObstacle): void {
    const idx = this.obstacles.indexOf(obstacle);
    if (idx >= 0) this.obstacles.splice(idx, 1);
    this.registry.unregister(obstacle.body.id);
    this.physics.removeBody(obstacle.body);
  }
}
