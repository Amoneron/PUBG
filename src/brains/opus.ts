import type { Brain, Action } from '../types';

const g = globalThis as any;

// ---------------------------------------------------------------------------
// Module-level state (persists across ticks, resets on page reload)
// ---------------------------------------------------------------------------
let tickCount = 0;
let pursuedBulletId: number | null = null;
let pursuedBulletTick = 0;
let bulletIgnoreList: number[] = [];
const BULLET_IGNORE_TIMEOUT = 150; // ~15 seconds at 10 ticks/sec

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const W = () => g.ground.width as number;
const H = () => g.ground.height as number;
const maxLives = (lvl: number): number => g.creatureMaxLives[lvl];
const maxEnergy = (lvl: number): number => g.creatureMaxEnergy[lvl];
const maxBullets = (lvl: number): number => g.creatureMaxBullets[lvl];

/** Check if a dangerous bullet is heading toward a point */
function bulletHeadingToward(bullet: any, pos: any, threshold: number): boolean {
  if (!bullet.dangerous) return false;
  const bulletAngle = Math.atan2(bullet.velocity.y, bullet.velocity.x);
  const toTarget = Math.atan2(pos.y - bullet.position.y, pos.x - bullet.position.x);
  const diff = Math.abs(g.differenceBetweenAngles(bulletAngle, toTarget));
  return diff < threshold;
}

/** Check if an enemy is aiming at a position */
function isAimingAt(enemy: any, pos: any, tolerance: number): boolean {
  const angleToPos = Math.atan2(pos.y - enemy.position.y, pos.x - enemy.position.x);
  const diff = Math.abs(g.differenceBetweenAngles(enemy.angle, angleToPos));
  return diff < tolerance;
}

/** Distance from a position to the nearest wall */
function distToWall(pos: any): number {
  return Math.min(pos.x, pos.y, W() - pos.x, H() - pos.y);
}

/** IQ reward for killing a target (0 = not worth it) */
function iqReward(selfIq: number, enemyIq: number): number {
  const diff = enemyIq - selfIq;
  if (diff > 10) return diff / 3;       // big reward for killing stronger
  if (diff >= -10) return 1;             // normal reward
  return 0;                              // no reward for killing much weaker
}

/** Choose dodge direction that goes away from walls */
function bestDodgeAngle(self: any, bulletAngle: number): number {
  const perp1 = bulletAngle + Math.PI / 2;
  const perp2 = bulletAngle - Math.PI / 2;
  // Pick direction that moves us further from nearest wall
  const pos1 = { x: self.position.x + Math.cos(perp1) * 50, y: self.position.y + Math.sin(perp1) * 50 };
  const pos2 = { x: self.position.x + Math.cos(perp2) * 50, y: self.position.y + Math.sin(perp2) * 50 };
  return distToWall(pos1) > distToWall(pos2) ? perp1 : perp2;
}

// ---------------------------------------------------------------------------
// CC Opus v2 — Runchip (Poison Bullets) — Aggressive Poison Striker
// ---------------------------------------------------------------------------

const opus: Brain = {

  name: 'CC Opus',
  kind: g.kinds.runchip,
  author: 'Claude',
  description: 'Venomous predator. Poisons targets for 60 HP total damage per bullet. IQ-optimized target selection.',

  thinkAboutIt(self, enemies, bullets, objects, events): Action {
    tickCount++;

    const myMaxLives = maxLives(self.level);
    const myMaxBullets = maxBullets(self.level);

    // =======================================================================
    // PHASE 0: DODGE — evade dangerous bullets
    // =======================================================================
    const dangerRadius = 200;
    let nearestDanger: any = null;
    let nearestDangerDist = Infinity;

    for (const bullet of bullets) {
      if (!bullet.dangerous) continue;
      const dist = g.distanceBetween(self, bullet);
      if (dist < dangerRadius && bulletHeadingToward(bullet, self.position, Math.PI / 10)) {
        if (dist < nearestDangerDist) {
          nearestDangerDist = dist;
          nearestDanger = bullet;
        }
      }
    }

    if (nearestDanger) {
      const bulletAngle = Math.atan2(nearestDanger.velocity.y, nearestDanger.velocity.x);
      const dodgeAngle = bestDodgeAngle(self, bulletAngle);

      if (nearestDangerDist < 100 && self.energy >= g.jumpEnergyCost) {
        return { do: g.actions.jump, params: { angle: dodgeAngle } };
      }
      return { do: g.actions.move, params: { angle: dodgeAngle } };
    }

    // =======================================================================
    // PHASE 1: CRITICAL HEAL — eat bullet when HP critically low
    // =======================================================================
    const hpPercent = self.lives / myMaxLives;

    if (hpPercent < 0.3 && self.bullets > 0 && self.energy >= g.eatBulletEnergyCost) {
      return { do: g.actions.eat, params: { message: 'Recalibrating...' } };
    }

    // Poisoned AND HP < 50%: eat to cure poison + heal
    if (self.poisoned && hpPercent < 0.5 && self.bullets > 0 && self.energy >= g.eatBulletEnergyCost) {
      return { do: g.actions.eat, params: { message: 'Antidote' } };
    }

    // =======================================================================
    // PHASE 2: ACTIVATE POISON — cast spell when conditions are right
    // =======================================================================
    if (
      self.level >= 1 &&
      !self.spelling &&
      self.energy >= 110 &&
      enemies.length > 0
    ) {
      // Only activate if we have ammo or a safe bullet nearby
      const hasSafeBulletNearby = bullets.some(
        (b: any) => !b.dangerous && g.distanceBetween(self, b) < 200
      );
      if (self.bullets > 0 || hasSafeBulletNearby) {
        return { do: g.actions.spell, params: { message: 'Venom loaded' } };
      }
    }

    // =======================================================================
    // PHASE 3: GUARANTEED KILL — engage targets we can finish off
    // =======================================================================
    if (self.bullets > 0 && self.energy >= g.shotEnergyCost && enemies.length > 0) {
      // Find killable targets (our bullets * damage >= their HP)
      const killable: any[] = [];
      for (const enemy of enemies) {
        if (self.bullets * g.bulletDamage >= enemy.lives) {
          const reward = iqReward(self.iq, enemy.iq);
          if (reward > 0) {
            killable.push({ enemy, reward, dist: g.distanceBetween(self, enemy) });
          }
        }
      }

      // Sort: highest IQ reward first, then closest
      killable.sort((a: any, b: any) => {
        if (b.reward !== a.reward) return b.reward - a.reward;
        return a.dist - b.dist;
      });

      for (const k of killable) {
        const enemy = k.enemy;
        const dist = k.dist;
        const angle = g.angleBetween(self, enemy);
        const aimDiff = Math.abs(g.differenceBetweenAngles(self.angle, angle));
        const tolerance = Math.PI / 25;

        if (!g.rayBetween(self, enemy)) {
          return { do: g.actions.move, params: { angle, message: 'Flanking...' } };
        }

        if (dist < 350 && aimDiff < tolerance) {
          return { do: g.actions.shoot, params: { message: 'Checkmate' } };
        }

        if (dist < 350) {
          return { do: g.actions.turn, params: { angle, message: 'Locking...' } };
        }

        return { do: g.actions.move, params: { angle, message: 'Closing in...' } };
      }
    }

    // =======================================================================
    // PHASE 4: EVASION — dodge armed enemies aiming at us
    // =======================================================================
    for (const enemy of enemies) {
      if (
        enemy.bullets > 0 &&
        g.distanceBetween(self, enemy) < 300 &&
        g.rayBetween(self, enemy) &&
        isAimingAt(enemy, self.position, Math.PI / 12)
      ) {
        const escapeAngle = g.angleBetween(enemy, self) + Math.PI / 4;
        return { do: g.actions.move, params: { angle: escapeAngle } };
      }
    }

    // =======================================================================
    // PHASE 5: MODERATE HEAL — eat if room for healing
    // =======================================================================
    if (
      self.lives < myMaxLives - g.livesPerEatenBullet &&
      self.bullets > 0 &&
      self.energy >= g.eatBulletEnergyCost
    ) {
      return { do: g.actions.eat, params: { message: 'Regenerating...' } };
    }

    // =======================================================================
    // PHASE 6: COLLECT AMMO — pick up safe bullets
    // =======================================================================
    if (self.bullets < myMaxBullets) {
      let bestBullet: any = null;
      let bestScore = Infinity;

      for (const bullet of bullets) {
        if (bullet.dangerous) continue;
        if (bulletIgnoreList.indexOf(bullet.id) >= 0) continue;
        if (!g.rayBetween(self, bullet)) continue;

        const distToMe = g.distanceBetween(self, bullet);

        // Prefer bullets far from enemies
        let minEnemyDist = Infinity;
        for (const enemy of enemies) {
          const d = g.distanceBetween(enemy, bullet);
          if (d < minEnemyDist) minEnemyDist = d;
        }

        const score = distToMe - minEnemyDist * 0.3;
        if (score < bestScore) {
          bestScore = score;
          bestBullet = bullet;
        }
      }

      if (bestBullet) {
        // Track pursuit timeout
        if (pursuedBulletId !== bestBullet.id) {
          pursuedBulletId = bestBullet.id;
          pursuedBulletTick = tickCount;
        } else if (tickCount - pursuedBulletTick > BULLET_IGNORE_TIMEOUT) {
          bulletIgnoreList.push(bestBullet.id);
          pursuedBulletId = null;
          pursuedBulletTick = 0;
        }

        const angle = g.angleBetween(self, bestBullet);
        return { do: g.actions.move, params: { angle, message: 'Arming...' } };
      }
    }

    // =======================================================================
    // PHASE 7: OPPORTUNISTIC ATTACK — poison strike even without kill guarantee
    // =======================================================================
    if (
      self.spelling &&
      self.bullets > 0 &&
      self.energy >= g.shotEnergyCost &&
      enemies.length > 0
    ) {
      // Target: highest IQ enemy with positive reward and LOS
      let bestTarget: any = null;
      let bestReward = 0;

      for (const enemy of enemies) {
        const reward = iqReward(self.iq, enemy.iq);
        if (reward <= 0) continue;
        if (!g.rayBetween(self, enemy)) continue;
        if (g.distanceBetween(self, enemy) > 400) continue;

        if (reward > bestReward) {
          bestReward = reward;
          bestTarget = enemy;
        }
      }

      if (bestTarget) {
        const angle = g.angleBetween(self, bestTarget);
        const dist = g.distanceBetween(self, bestTarget);
        const aimDiff = Math.abs(g.differenceBetweenAngles(self.angle, angle));
        const tolerance = Math.PI / 25;

        if (dist < 350 && aimDiff < tolerance) {
          return { do: g.actions.shoot, params: { message: 'Venom strike' } };
        }
        if (dist < 350) {
          return { do: g.actions.turn, params: { angle, message: 'Targeting...' } };
        }
        return { do: g.actions.move, params: { angle, message: 'Stalking...' } };
      }
    }

    // =======================================================================
    // PHASE 8: COLLECT STARS — level up faster
    // =======================================================================
    if (self.level < 2) {
      for (const obj of objects) {
        if ((obj as any).type === 2) { // star
          if (g.rayBetween(self, obj)) {
            const angle = g.angleBetween(self, obj);
            return { do: g.actions.move, params: { angle, message: 'Evolving...' } };
          }
        }
      }
    }

    // =======================================================================
    // PHASE 9: POSITIONING — stay away from walls, move toward bullet clusters
    // =======================================================================
    const wallDist = distToWall(self.position);
    if (wallDist < 80) {
      const center = { x: W() / 2, y: H() / 2 };
      const angle = g.angleBetweenPoints(self.position, center);
      return { do: g.actions.move, params: { angle } };
    }

    // Move toward cluster of safe bullets if idle
    const safeBullets = bullets.filter((b: any) => !b.dangerous);
    if (safeBullets.length > 0) {
      // Find centroid of safe bullets
      let cx = 0, cy = 0;
      for (const b of safeBullets) {
        cx += b.position.x;
        cy += b.position.y;
      }
      cx /= safeBullets.length;
      cy /= safeBullets.length;
      const angle = g.angleBetweenPoints(self.position, { x: cx, y: cy });
      return { do: g.actions.move, params: { angle } };
    }

    // =======================================================================
    // PHASE 10: IDLE
    // =======================================================================
    return { do: g.actions.none, params: { message: 'Calculating...' } };
  },
};

export default opus;
