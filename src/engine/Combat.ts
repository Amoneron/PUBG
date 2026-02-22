import type { GameConfig } from '../config';
import type { InternalCreature, InternalBullet, InternalObstacle, CreatureView } from '../types';
import { EventType, ObjectType, Shell, StarShape } from '../types/enums';
import { EventBus } from './EventBus';
import { Spawner } from './Spawner';
import { Obfuscator } from './Obfuscator';
import { distanceBetweenPoints, angleBetweenPoints } from '../utils/geometry';
import { isNumber, randomAngle } from '../utils/helpers';

const BULLET_FORCE = 15.5;

export class Combat {
  private config: GameConfig;
  private eventBus: EventBus;
  private spawner: Spawner;
  private obfuscator: Obfuscator;
  public creatures: InternalCreature[] = [];
  public turnAuraOn: (creature: InternalCreature, color: string, duration: number) => void;
  public turnAuraOff: (creature: InternalCreature) => void;
  public updateCreatureEmbodiment: (creature: InternalCreature) => void;
  public updateCreatureLevel: (creature: InternalCreature, force: boolean) => void;
  public calculateIQ: (victim: any, killer: any) => void;
  public updateLeaderboard: () => void;
  public onCreatureDeath: ((creature: InternalCreature) => void) | null = null;

  constructor(
    config: GameConfig,
    eventBus: EventBus,
    spawner: Spawner,
    obfuscator: Obfuscator,
  ) {
    this.config = config;
    this.eventBus = eventBus;
    this.spawner = spawner;
    this.obfuscator = obfuscator;
    // These callbacks will be set by Engine after construction
    this.turnAuraOn = () => {};
    this.turnAuraOff = () => {};
    this.updateCreatureEmbodiment = () => {};
    this.updateCreatureLevel = () => {};
    this.calculateIQ = () => {};
    this.updateLeaderboard = () => {};
  }

  hurtCreature(creature: InternalCreature, damage: number, bullet: InternalBullet | null, attacker: InternalCreature | null): boolean {
    creature.lives -= damage;
    let shooter = bullet ? bullet.shooter : null;
    if (shooter && shooter.body === creature.body) shooter = null;
    if (attacker) shooter = attacker;

    if (creature.lives <= 0) {
      // Emit murder/death event
      const eventPayload: CreatureView[] = [this.obfuscator.obfuscateCreature(creature)!];
      let eventType: EventType;

      if (shooter && shooter.body !== creature.body) {
        shooter.kills++;
        shooter.brain.kills++;
        this.updateCreatureLevel(shooter, false);
        eventType = EventType.murder;
        eventPayload.push(this.obfuscator.obfuscateCreature(shooter)!);
      } else {
        eventType = EventType.death;
      }

      this.eventBus.pushBotEvent({ type: eventType, payload: eventPayload });

      const brain = creature.brain;
      const blts = creature.bullets;
      const pos = creature.body.position;
      brain.deaths++;
      brain.alive = false;

      if (this.onCreatureDeath) this.onCreatureDeath(creature);

      // Scatter bullets on death
      for (let i = 0; i < blts; i++) {
        this.spawner.shot(pos, randomAngle(), null, false, Shell.steel);
      }

      this.calculateIQ(brain, shooter ? shooter.brain : null);
      this.updateLeaderboard();
      return true;
    } else {
      // Emit wound event
      const eventPayload: CreatureView[] = [this.obfuscator.obfuscateCreature(creature)!];
      if (shooter) eventPayload.push(this.obfuscator.obfuscateCreature(shooter)!);
      this.eventBus.pushBotEvent({ type: EventType.wound, payload: eventPayload });

      if (bullet) {
        if (bullet.shell === Shell.poisoned) this.poisonCreature(creature);
        if (bullet.shell === Shell.ice) this.freezeCreature(creature);
      }

      this.updateCreatureEmbodiment(creature);
      return false;
    }
  }

  damageObstacle(obstacle: InternalObstacle, damage: number, attacker: InternalCreature | null): boolean {
    const oldSprite = this.spriteIndex(obstacle);
    obstacle.condition -= damage;

    if (obstacle.condition <= 0) {
      const type = obstacle.type;
      const shape = obstacle.shape;
      const pos = obstacle.body.position;
      const vel = obstacle.body.velocity;

      this.spawner.removeObstacle(obstacle);

      // Explosions (dynamite)
      if (type === ObjectType.dynamite) {
        const rad = shape === 0 ? 300 : 200;
        const dmg = shape === 0 ? 100 : 70;
        const frc = shape === 0 ? 0.1 : 0.08;

        const damageEntity = (obj: any) => {
          const dist = distanceBetweenPoints(obj.body.position, pos);
          if (dist < rad) {
            const eff = 1.0 - (dist / rad);
            const hurt = Math.round(dmg * eff);
            const pwr = obj.body.mass * frc * eff;
            let dead = false;
            const entityType = isNumber(obj.lives) ? 0 : isNumber(obj.shell) ? 1 : 2;
            switch (entityType) {
              case 0: // creature
                if (!obj.invulnerable) dead = this.hurtCreature(obj, hurt, null, attacker);
                break;
              case 2: // obstacle
                dead = this.damageObstacle(obj, obj.type === ObjectType.star ? 0 : hurt, null);
                break;
              default: // bullet
                break;
            }
            if (!dead) {
              const angle = angleBetweenPoints(pos, obj.body.position);
              obj.force = {
                x: Math.cos(angle) * pwr,
                y: Math.sin(angle) * pwr,
              };
            }
          }
        };

        // Copy arrays before iterating since damage can modify them
        [...this.creatures].forEach(damageEntity);
        [...this.spawner.obstacles].forEach(damageEntity);
        [...this.spawner.bullets].forEach(damageEntity);
      }
      // Star from broken obstacle
      else if (type === ObjectType.obstacle) {
        if (Math.random() < this.config.starsProbability) {
          this.spawner.newStar(pos, vel);
        }
      }
      return true;
    }

    // Update sprite if damage changed visual state
    const newSprite = this.spriteIndex(obstacle);
    if (newSprite !== oldSprite || damage === 0) {
      (obstacle.body as any).render.sprite.texture = `./img/obstacles/${obstacle.type}_${obstacle.shape}_${newSprite}.png`;
    }
    return false;
  }

  poisonCreature(creature: InternalCreature): void {
    creature.poisonCounter = this.config.poisonDuration;
    this.turnAuraOn(creature, 'green', 100000);
  }

  freezeCreature(creature: InternalCreature): void {
    creature.freezeCounter = this.config.freezeDuration;
    this.turnAuraOn(creature, 'blue', 100000);
  }

  private spriteIndex(obs: InternalObstacle): number {
    return Math.floor((obs.condition / obs.firmness) * obs.sprites);
  }
}
