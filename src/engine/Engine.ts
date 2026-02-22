/**
 * Programmers BattleGround — Game Engine
 *
 * The main GameEngine class that ties all subsystems together and implements
 * the core game loop.  Ported from battleground.js lines 774-975 (main loop)
 * and 978-1080 (collision handling).
 *
 * The engine is designed to work both in-browser (with a Renderer attached)
 * and headless in Node.js (no DOM, no Canvas).
 */

import Matter from 'matter-js';
import type { GameConfig } from '../config';
import type {
  Brain,
  InternalBrain,
  InternalCreature,
  InternalBullet,
  InternalObstacle,
  CreatureView,
  BulletView,
  GameObjectView,
  GameEvent,
} from '../types';
import { ActionType, Kind, ObjectType, Shell, StarShape } from '../types/enums';
import { Physics } from './Physics';
import { EventBus } from './EventBus';
import { EntityRegistry } from './EntityRegistry';
import { Spawner } from './Spawner';
import { Obfuscator } from './Obfuscator';
import { BotSandbox } from './BotSandbox';
import { SpellRegistry } from './SpellRegistry';
import { IQSystem, type IQStorage, LocalStorageIQStorage } from './IQSystem';
import { CreatureManager } from './CreatureManager';
import { Combat } from './Combat';
import { ActionExecutor } from './ActionExecutor';
import { distanceBetween, angleBetween } from '../utils/geometry';
import { rainbow, randomAngle, shuffleArray } from '../utils/helpers';
import { installGlobals, installRayBetween } from '../globals';

// ---------------------------------------------------------------------------
// Constants matching battleground.js
// ---------------------------------------------------------------------------

const IS_CREATURE = 2;
const IS_BULLET = 3;
const IS_OBSTACLE = 4;
const IS_STAR = 5;
const DANGEROUS_BULLET_SPEED = 5;
const MAX_BULLETS_ON_GROUND = 20;
const SUMMON_INTERVAL = 10;
const NO_BULLETS_INTERVAL = 30;
const BULLET_FORCE = 15.5;

// ---------------------------------------------------------------------------
// GameSnapshot — returned by tick() for the renderer
// ---------------------------------------------------------------------------

export interface GameSnapshot {
  creatures: InternalCreature[];
  bullets: InternalBullet[];
  obstacles: InternalObstacle[];
  brains: InternalBrain[];
  arena: { width: number; height: number };
}

// ---------------------------------------------------------------------------
// Engine options
// ---------------------------------------------------------------------------

export interface EngineOptions {
  iqStorage?: IQStorage;
}

// ---------------------------------------------------------------------------
// GameEngine
// ---------------------------------------------------------------------------

export class GameEngine {
  // -- Subsystems --
  private physics: Physics;
  private eventBus: EventBus;
  private registry: EntityRegistry;
  private spawner: Spawner;
  private obfuscator: Obfuscator;
  private botSandbox: BotSandbox;
  private spellRegistry: SpellRegistry;
  private iqSystem: IQSystem;
  private creatureManager: CreatureManager;
  private combat: Combat;
  private actionExecutor: ActionExecutor;

  // -- Config --
  private config: GameConfig;

  // -- Loop counters (from battleground.js lines 66-89) --
  private bulletsGeneratorCounter = 0;
  private bulletsGeneratorFrequency = 0;
  private noBulletsCounter = 0;
  private summonCounter = 0;
  private specifiedAliveCreaturesCount: number;
  private maxObstaclesAmount: number;
  private exploded = false;

  // -- Leaderboard management --
  private fullLeaderboard = false;
  private leaderboardCounter = 0;
  private readonly fullLeaderboardInterval = 50;

  /** Optional external callback for leaderboard UI updates */
  public onLeaderboardUpdate:
    | ((brains: InternalBrain[], fullLeaderboard: boolean) => void)
    | null = null;

  /** Optional external callback when a creature dies (for renderer death animation) */
  public onCreatureDeath: ((creature: InternalCreature) => void) | null = null;

  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  constructor(config: GameConfig, brainDefs: Brain[], options?: EngineOptions) {
    this.config = config;

    // Install global variables for bots
    installGlobals(config, config.arena);

    // -- Create subsystems --
    this.physics = new Physics(config.arena);
    this.eventBus = new EventBus();
    this.registry = new EntityRegistry();
    this.obfuscator = new Obfuscator();
    this.botSandbox = new BotSandbox();
    this.spellRegistry = new SpellRegistry();

    const iqStorage = options?.iqStorage ?? new LocalStorageIQStorage();
    this.iqSystem = new IQSystem(iqStorage);

    this.spawner = new Spawner(this.physics, this.registry, config);
    this.creatureManager = new CreatureManager(
      this.physics, this.registry, this.eventBus, this.obfuscator, config,
    );
    this.combat = new Combat(config, this.eventBus, this.spawner, this.obfuscator);
    this.actionExecutor = new ActionExecutor(
      config, this.spawner, this.spellRegistry, this.eventBus, this.obfuscator,
    );

    // Install rayBetween now that the Matter.Engine exists
    installRayBetween(this.physics.engine);

    // -- Wire cross-module callbacks --
    this.wireCallbacks();

    // -- Assemble brains --
    this.assembleBrains(brainDefs);

    // -- Calculate arena population limits --
    this.specifiedAliveCreaturesCount = config.maxAliveCreatures;
    this.maxObstaclesAmount = Math.ceil(
      config.arena.width * config.arena.height / 1000 / config.obstaclesDensity,
    );
    this.setBulletGeneratorFrequency();

    // -- Populate the initial world --
    for (let i = 0; i < this.maxObstaclesAmount; i++) {
      this.spawner.newRandomObstacle();
    }
    for (let i = 0; i < 5; i++) {
      this.spawner.dropBullet();
    }

    // -- Register collision handler --
    this.physics.onCollision((pairs) => this.handleCollisions(pairs));

    // -- Spawn initial creatures --
    for (let i = 0; i < this.specifiedAliveCreaturesCount; i++) {
      this.creatureManager.nextCreature(this.specifiedAliveCreaturesCount);
    }
  }

  // -----------------------------------------------------------------------
  // Wire callbacks between modules
  // -----------------------------------------------------------------------

  private wireCallbacks(): void {
    const cm = this.creatureManager;

    // Combat -> CreatureManager callbacks
    this.combat.turnAuraOn = (c, color, dur) => cm.turnAuraOn(c, color, dur);
    this.combat.turnAuraOff = (c) => cm.turnAuraOff(c);
    this.combat.updateCreatureEmbodiment = (c) => cm.updateCreatureEmbodiment(c);
    this.combat.updateCreatureLevel = (c, force) => cm.updateCreatureLevel(c, force);
    this.combat.calculateIQ = (victim, killer) => {
      this.iqSystem.calculateIQForVictimAndKiller(victim, killer);
    };
    this.combat.updateLeaderboard = () => this.updateLeaderboard();
    this.combat.onCreatureDeath = (creature) => {
      cm.removeCreature(creature);
      if (this.onCreatureDeath) this.onCreatureDeath(creature);
    };
    // Combat needs access to the live creatures array
    this.combat.creatures = cm.creatures;

    // ActionExecutor -> CreatureManager callbacks
    this.actionExecutor.turnAuraOn = (c, color, dur) => cm.turnAuraOn(c, color, dur);
    this.actionExecutor.updateCreatureEmbodiment = (c) => cm.updateCreatureEmbodiment(c);

    // CreatureManager -> leaderboard callback
    cm.updateLeaderboard = () => this.updateLeaderboard();
  }

  // -----------------------------------------------------------------------
  // Brain assembly
  // -----------------------------------------------------------------------

  private assembleBrains(brainDefs: Brain[]): void {
    const defs = this.config.shuffleBrains ? shuffleArray([...brainDefs]) : [...brainDefs];

    for (const code of defs) {
      const author = code.author.length > 10 ? code.author.substring(0, 10) : code.author;
      const name = code.name.length > 10 ? code.name.substring(0, 10) : code.name;

      const brain: InternalBrain = {
        id: `br_${name.toLowerCase().replace(/\s+/g, '')}`,
        author,
        name,
        kind: code.kind,
        kills: 0,
        deaths: 0,
        iq: 10,
        alive: false,
        code,
        color: rainbow(),
      };

      brain.iq = this.iqSystem.loadIQ(brain.id);
      this.creatureManager.brains.push(brain);
    }
  }

  // -----------------------------------------------------------------------
  // Bullet generator frequency
  // -----------------------------------------------------------------------

  private setBulletGeneratorFrequency(): void {
    this.bulletsGeneratorFrequency =
      95 - this.specifiedAliveCreaturesCount * this.config.bulletsGeneratorFrequencyPerCreature;
    if (this.bulletsGeneratorFrequency < 20) this.bulletsGeneratorFrequency = 20;
  }

  // -----------------------------------------------------------------------
  // Leaderboard
  // -----------------------------------------------------------------------

  private updateLeaderboard(): void {
    if (this.onLeaderboardUpdate) {
      this.onLeaderboardUpdate(this.creatureManager.brains, this.fullLeaderboard);
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Return the Matter.js engine (needed for installRayBetween, Renderer) */
  getMatterEngine(): Matter.Engine {
    return this.physics.engine;
  }

  /** Return the brains array (for leaderboard rendering) */
  getBrains(): InternalBrain[] {
    return this.creatureManager.brains;
  }

  /** Return all live creatures (for renderer) */
  getCreatures(): InternalCreature[] {
    return this.creatureManager.creatures;
  }

  /** Return the spawner (for renderer access to bullets/obstacles) */
  getSpawner(): Spawner {
    return this.spawner;
  }

  /** Return the physics subsystem (for renderer) */
  getPhysics(): Physics {
    return this.physics;
  }

  /**
   * Adjust the number of simultaneously alive creatures.
   * Clamped to [3, 8]. Matches battleground.js lines 679-686.
   */
  changeMaxCreaturesBy(value: number): void {
    this.specifiedAliveCreaturesCount += value;
    if (this.specifiedAliveCreaturesCount < 3) this.specifiedAliveCreaturesCount = 3;
    if (this.specifiedAliveCreaturesCount > 8) this.specifiedAliveCreaturesCount = 8;
    this.setBulletGeneratorFrequency();
  }

  /** Return the current max-alive-creatures count */
  getMaxCreaturesCount(): number {
    return this.specifiedAliveCreaturesCount;
  }

  // -----------------------------------------------------------------------
  // Main game loop — one tick
  // -----------------------------------------------------------------------

  /**
   * Advance the game by one tick.
   *
   * This must be called externally (by the Renderer's requestAnimationFrame
   * loop, or by a setInterval in headless mode). The original code ran this
   * inside Matter.Events.on(engine, 'beforeUpdate'), but we split it out so
   * the engine can run headless without Matter.Runner.
   *
   * Returns a GameSnapshot for the renderer.
   */
  tick(delta?: number): GameSnapshot {
    const creatures = this.creatureManager.creatures;
    const bullets = this.spawner.bullets;
    const obstacles = this.spawner.obstacles;
    const cfg = this.config;

    // -- Step 0: Handle deferred forces from explosions --
    if (this.exploded) {
      this.exploded = false;
      const applyForce = (it: { body: Matter.Body; force: { x: number; y: number } | null }) => {
        if (it.force) {
          Matter.Body.applyForce(it.body, it.body.position, it.force);
          it.force = null;
        }
      };
      creatures.forEach(applyForce);
      obstacles.forEach(applyForce);
      bullets.forEach(applyForce);
    }

    // -- Step 1: Physics update --
    this.physics.update(delta);

    // -- Step 2: Leaderboard counter --
    if (this.leaderboardCounter > 0 && --this.leaderboardCounter < 1) {
      this.leaderboardCounter = 0;
      this.fullLeaderboard = false;
      this.updateLeaderboard();
    }

    // -- Step 3: Bullet generation --
    this.bulletsGeneratorCounter++;
    if (bullets.length > 0) this.noBulletsCounter = 0;
    if (++this.noBulletsCounter >= NO_BULLETS_INTERVAL) {
      this.noBulletsCounter = 0;
      this.bulletsGeneratorCounter = this.bulletsGeneratorFrequency + 1;
    }
    if (
      this.bulletsGeneratorCounter > this.bulletsGeneratorFrequency &&
      bullets.length < MAX_BULLETS_ON_GROUND
    ) {
      this.bulletsGeneratorCounter = 0;
      this.spawner.dropBullet();
    }

    // -- Step 4: Energy refill and spell/poison/freeze counter management --
    const enemies: CreatureView[] = [];
    const invisibles: number[] = [];
    const magnets: number[] = [];

    creatures.forEach((it, index) => {
      // Energy refill
      it.energy += cfg.energyRefillPerTick;
      if (it.energy > cfg.creatureMaxEnergy[it.level]) {
        it.energy = cfg.creatureMaxEnergy[it.level];
      }

      // Spell counter
      if (it.counter > 0) {
        if (--it.counter <= 0) {
          // BUG FIX: original had `it.counter == 0` (comparison, not assignment)
          it.counter = 0;
          if (it.invisible) {
            it.invisible = false;
            (it.body as any).render.opacity = 1;
          }
          if (it.invulnerable) it.invulnerable = false;
          if (it.magnet) it.magnet = false;
          if (it.poisoner) it.poisoner = false;
          if (it.guttapercha) it.guttapercha = false;
          if (it.subzero) it.subzero = false;
          this.creatureManager.turnAuraOff(it);
        }
      }

      // Poison counter
      if (it.poisonCounter > 0) {
        if (--it.poisonCounter <= 0) {
          it.poisonCounter = 0;
          this.creatureManager.turnAuraOff(it);
        }
      }

      // Freeze counter
      if (it.freezeCounter > 0) {
        if (--it.freezeCounter <= 0) {
          it.freezeCounter = 0;
          this.creatureManager.turnAuraOff(it);
        }
      }

      enemies.push(this.obfuscator.obfuscateCreature(it)!);
      if (it.invisible) invisibles.push(index);
      if (it.magnet) magnets.push(index);
    });

    // -- Step 5: Obfuscate bullets (and apply magnet forces) --
    const blts: BulletView[] = [];
    bullets.forEach((it) => {
      blts.push(this.obfuscator.obfuscateBullet(it)!);
      // Magnets attract bullets
      if (magnets.length > 0) {
        magnets.forEach((i) => {
          const c = creatures[i];
          const d = distanceBetween(c.body, it.body);
          const f = 0.001 * (d / 500);
          const a = angleBetween(it.body, c.body);
          const v = { x: Math.cos(a) * f, y: Math.sin(a) * f };
          Matter.Body.applyForce(it.body, it.body.position, v);
        });
      }
    });

    // -- Step 6: Obfuscate obstacles --
    const objs: GameObjectView[] = [];
    obstacles.forEach((it) => {
      objs.push(this.obfuscator.obfuscateObstacle(it)!);
    });

    // -- Step 7: Freeze arrays and collect events --
    Object.freeze(enemies);
    Object.freeze(objs);
    Object.freeze(blts);
    const evnts: GameEvent[] = this.eventBus.getBotEvents();
    Object.freeze(evnts);

    // -- Step 8: For each creature, call thinkAboutIt and execute action --
    creatures.forEach((it, index) => {
      // Poison damage
      if (it.poisonCounter > 0 && it.lives > 5) {
        it.lives -= cfg.poisonHurt;
        this.creatureManager.updateCreatureEmbodiment(it);
      }

      // Frozen creatures cannot act
      if (it.freezeCounter > 0) return;

      // Build the enemies list for this creature:
      // - Remove self
      // - Remove invisible creatures (but not if the creature itself is invisible)
      let enemiesForIt = enemies.slice(0);
      if (invisibles.length > 0) {
        let del = false;
        for (let i = invisibles.length - 1; i >= 0; i--) {
          if (invisibles[i] > index || del) {
            enemiesForIt.splice(invisibles[i], 1);
          } else if (invisibles[i] === index) {
            enemiesForIt.splice(index, 1);
            del = true;
          } else if (invisibles[i] < index) {
            enemiesForIt.splice(index, 1);
            enemiesForIt.splice(invisibles[i], 1);
            del = true;
          }
        }
        if (!del) enemiesForIt.splice(index, 1);
      } else {
        enemiesForIt.splice(index, 1);
      }
      Object.freeze(enemiesForIt);

      // Call the bot
      const action = this.botSandbox.callBot(
        it.brain.code, enemies[index], enemiesForIt, blts, objs, evnts,
      );

      // Execute the returned action
      switch (action.do) {
        case ActionType.move:
          this.actionExecutor.move(it, action.params?.angle ?? 0);
          break;
        case ActionType.rotate:
          this.actionExecutor.torque(it, action.params?.clockwise ?? true);
          break;
        case ActionType.turn:
          this.actionExecutor.turnToAngle(it, action.params?.angle ?? 0);
          break;
        case ActionType.shoot:
          this.actionExecutor.shoot(it);
          break;
        case ActionType.jump:
          this.actionExecutor.jump(it, action.params?.angle ?? 0);
          break;
        case ActionType.eat:
          this.actionExecutor.eatBullet(it);
          break;
        case ActionType.spell: {
          // Resolve target from bot-provided target.id
          let target: InternalCreature | InternalObstacle | null = null;
          let angle: number | undefined;
          if (action.params?.target?.id) {
            const tg = action.params.target.id;
            for (let i = 0; i < creatures.length; i++) {
              if (creatures[i].body.id === tg) {
                target = creatures[i];
                break;
              }
            }
            if (!target) {
              for (let i = 0; i < obstacles.length; i++) {
                if (obstacles[i].body.id === tg) {
                  target = obstacles[i];
                  break;
                }
              }
            }
          }
          if (action.params?.angle !== undefined) angle = action.params.angle;
          this.actionExecutor.spell(it, target, angle, creatures, obstacles);
          break;
        }
        default:
          break;
      }

      // Handle messages
      if (
        action.params?.message &&
        typeof action.params.message === 'string'
      ) {
        const msg = action.params.message.trim();
        if (msg.length > 0) {
          it.shouted = Date.now();
          it.message = msg.length > cfg.messageLineLimit * 2
            ? msg.substring(0, cfg.messageLineLimit * 2)
            : msg;
        }
      }
    });

    // -- Step 9: Summon new creature or obstacle --
    if (this.summonCounter++ > SUMMON_INTERVAL) {
      this.summonCounter = 0;
      if (creatures.length < this.specifiedAliveCreaturesCount) {
        this.creatureManager.nextCreature(this.specifiedAliveCreaturesCount);
      } else if (obstacles.length < this.maxObstaclesAmount) {
        this.spawner.newRandomObstacle();
      }
    }

    // -- Step 10: Clear tick events --
    this.eventBus.clearTick();

    // -- Return snapshot --
    return {
      creatures,
      bullets,
      obstacles,
      brains: this.creatureManager.brains,
      arena: cfg.arena,
    };
  }

  // -----------------------------------------------------------------------
  // Collision handling
  // -----------------------------------------------------------------------

  /**
   * Process collision pairs from Matter.js.
   * Ported from battleground.js lines 978-1080.
   */
  private handleCollisions(pairs: Matter.Pair[]): void {
    const creatures = this.creatureManager.creatures;
    const bullets = this.spawner.bullets;
    const obstacles = this.spawner.obstacles;
    const cfg = this.config;

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      let blt: Matter.Body | undefined;
      let body: Matter.Body | undefined;

      // -- Check for creature + bullet --
      if (
        pair.bodyA.collisionFilter.category === IS_CREATURE &&
        pair.bodyB.collisionFilter.category === IS_BULLET
      ) {
        blt = pair.bodyB;
        body = pair.bodyA;
      }
      if (
        pair.bodyB.collisionFilter.category === IS_CREATURE &&
        pair.bodyA.collisionFilter.category === IS_BULLET
      ) {
        blt = pair.bodyA;
        body = pair.bodyB;
      }

      if (blt && body && (body as any).label && (blt as any).label) {
        const creature: InternalCreature = (body as any).label;
        const bullet: InternalBullet = (blt as any).label;

        if (blt.speed >= DANGEROUS_BULLET_SPEED && !creature.invulnerable) {
          // Damaging hit
          this.combat.hurtCreature(creature, cfg.bulletDamage, bullet, null);
        } else {
          // Pick up bullet if room
          if (creature.bullets < cfg.creatureMaxBullets[creature.level]) {
            const idx = bullets.indexOf(bullet);
            if (idx >= 0) bullets.splice(idx, 1);
            (blt as any).label = null;
            this.registry.unregister(blt.id);
            this.physics.removeBody(blt);
            creature.bullets++;
          }
        }
      }
      // -- Check for obstacle + bullet --
      else {
        let blt2: Matter.Body | undefined;
        let obs: Matter.Body | undefined;

        if (
          pair.bodyA.collisionFilter.category === IS_OBSTACLE &&
          pair.bodyB.collisionFilter.category === IS_BULLET
        ) {
          blt2 = pair.bodyB;
          obs = pair.bodyA;
        }
        if (
          pair.bodyB.collisionFilter.category === IS_OBSTACLE &&
          pair.bodyA.collisionFilter.category === IS_BULLET
        ) {
          blt2 = pair.bodyA;
          obs = pair.bodyB;
        }

        if (blt2 && obs && (obs as any).label && blt2.speed >= DANGEROUS_BULLET_SPEED) {
          const attacker = (blt2 as any).label ? ((blt2 as any).label as InternalBullet).shooter : null;
          const destroyed = this.combat.damageObstacle(
            (obs as any).label as InternalObstacle,
            cfg.bulletDamage,
            attacker,
          );
          if (destroyed) {
            this.exploded = true;
          }
        }
        // -- Check for creature + star --
        else {
          let star: Matter.Body | undefined;
          let body2: Matter.Body | undefined;

          if (
            pair.bodyA.collisionFilter.category === IS_CREATURE &&
            pair.bodyB.collisionFilter.category === IS_STAR
          ) {
            star = pair.bodyB;
            body2 = pair.bodyA;
          }
          if (
            pair.bodyB.collisionFilter.category === IS_CREATURE &&
            pair.bodyA.collisionFilter.category === IS_STAR
          ) {
            star = pair.bodyA;
            body2 = pair.bodyB;
          }

          if (star && body2 && (body2 as any).label && (star as any).label) {
            const obj: InternalObstacle = (star as any).label;
            const shape = obj.shape;
            const c: InternalCreature = (body2 as any).label;

            // Remove the star
            const obsIdx = obstacles.indexOf(obj);
            if (obsIdx >= 0) obstacles.splice(obsIdx, 1);
            (star as any).label = null;
            this.registry.unregister(star.id);
            this.physics.removeBody(star);

            // Apply star effect
            switch (shape) {
              case StarShape.levelup:
                if (c.level < 2) c.level++;
                this.creatureManager.updateCreatureLevel(c, true);
                break;

              case StarShape.healing:
                c.lives = cfg.creatureMaxLives[c.level];
                c.energy = cfg.creatureMaxEnergy[c.level];
                this.creatureManager.updateCreatureEmbodiment(c);
                break;

              case StarShape.poisoned:
                this.combat.poisonCreature(c);
                break;

              case StarShape.frozen:
                this.combat.freezeCreature(c);
                break;

              case StarShape.death:
                // Spawn 4 dynamites
                for (let j = 0; j < 4; j++) {
                  this.spawner.newObstacle(ObjectType.dynamite);
                }
                // Make all bullets rubber and scatter them
                bullets.forEach((b) => {
                  b.body.restitution = cfg.guttaperchaRestitution;
                  b.body.frictionAir = cfg.guttaperchaAirFriction;
                  (b.body as any).render.fillStyle = '#FF581E';   // rubber fill
                  (b.body as any).render.strokeStyle = '#C93400'; // rubber stroke
                  b.shell = Shell.rubber;
                  b.shooter = null; // Do not count IQ
                  const angle = randomAngle();
                  Matter.Body.setVelocity(b.body, {
                    x: Math.cos(angle) * BULLET_FORCE,
                    y: Math.sin(angle) * BULLET_FORCE,
                  });
                });
                break;
            }
          }
        }
      }
    }
  }
}
