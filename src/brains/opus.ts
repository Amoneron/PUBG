import type { Brain } from '../types';

const g = globalThis as any;

// ---------------------------------------------------------------------------
// Module-level state (persists across ticks, resets on new creature spawn)
// ---------------------------------------------------------------------------
let tickCount = 0;
let lastTkTargetId: number | null = null;
let lastTkTick = 0;
let lastKillName: string | null = null;
let lastKillTick = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Arena dimensions shortcut */
const W = () => g.ground.width as number;
const H = () => g.ground.height as number;

/** Max values for a given level */
const maxLives  = (lvl: number): number => g.creatureMaxLives[lvl];
const maxEnergy = (lvl: number): number => g.creatureMaxEnergy[lvl];
const maxBullets = (lvl: number): number => g.creatureMaxBullets[lvl];

/** Check if a dangerous bullet is heading toward a point (trajectory analysis) */
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

/** Threat score for prioritizing enemies */
function threatScore(self: any, enemy: any): number {
  const dist = g.distanceBetween(self, enemy);
  const aiming = isAimingAt(enemy, self.position, Math.PI / 6) ? 30 : 0;
  return (1 / Math.max(dist, 1)) * 400 + enemy.bullets * 15 + aiming + enemy.iq * 0.5;
}

// ---------------------------------------------------------------------------
// CC Opus — Bear (Telekinesis) — Multi-Phase Adaptive Controller
// ---------------------------------------------------------------------------

const opus: Brain = {

  name: 'CC Opus',
  kind: g.kinds.bear,
  author: 'Claude',
  description: 'Adaptive AI with trajectory analysis, threat scoring, and telekinetic mind control. Thinks several moves ahead.',

  thinkAboutIt(self, enemies, bullets, objects, events) {
    tickCount++;

    // Track kills for messages
    for (const ev of events) {
      if ((ev as any).type === 1 && (ev as any).payload?.[0]?.id === self.id) {
        lastKillName = (ev as any).payload[1]?.name ?? 'unknown';
        lastKillTick = tickCount;
      }
    }

    // Show kill message for a few ticks
    if (lastKillName && tickCount - lastKillTick < 40) {
      // continue with strategy, message will be attached
    }

    const msg = (text: string): string => {
      if (lastKillName && tickCount - lastKillTick < 40) {
        return 'Checkmate, ' + lastKillName;
      }
      return text;
    };

    // -----------------------------------------------------------------------
    // 1. DODGE — Detect dangerous bullets heading toward us
    // -----------------------------------------------------------------------
    const dangerRadius = 180;
    let nearestDanger: any = null;
    let nearestDangerDist = Infinity;

    for (const bullet of bullets) {
      if (!bullet.dangerous) continue;
      const dist = g.distanceBetween(self, bullet);
      if (dist < dangerRadius && bulletHeadingToward(bullet, self.position, Math.PI / 20)) {
        if (dist < nearestDangerDist) {
          nearestDangerDist = dist;
          nearestDanger = bullet;
        }
      }
    }

    if (nearestDanger) {
      const bulletAngle = Math.atan2(nearestDanger.velocity.y, nearestDanger.velocity.x);
      const dodgeAngle = bulletAngle + Math.PI / 2;

      // Jump if we have energy and bullet is close
      if (nearestDangerDist < 120 && self.energy >= g.jumpEnergyCost) {
        return { do: g.actions.jump, params: { angle: dodgeAngle, message: msg('Trajectory dodged') } };
      }
      // Otherwise move perpendicular
      return { do: g.actions.move, params: { angle: dodgeAngle, message: msg('Evading...') } };
    }

    // -----------------------------------------------------------------------
    // 2. HEAL (critical) — Eat bullet when HP < 40% of max
    // -----------------------------------------------------------------------
    if (self.lives < maxLives(self.level) * 0.4 && self.bullets > 0 && self.energy >= g.eatBulletEnergyCost) {
      return { do: g.actions.eat, params: { message: msg('Recalibrating...') } };
    }

    // -----------------------------------------------------------------------
    // 3. TELEKINESIS — Use bear's cheap spell (2 energy!) strategically
    // -----------------------------------------------------------------------
    if (self.level >= 1 && self.energy >= g.telekinesisEnergyCost && enemies.length > 0) {
      // Avoid spamming same target every tick
      const tkCooldown = tickCount - lastTkTick >= 3;

      // Sort enemies by threat
      const byThreat = [...enemies].sort((a, b) => threatScore(self, b) - threatScore(self, a));

      for (const enemy of byThreat) {
        if (!tkCooldown && enemy.id === lastTkTargetId) continue;
        if (!g.rayBetween(self, enemy)) continue;

        const dist = g.distanceBetween(self, enemy);
        const angleToEnemy = g.angleBetween(self, enemy);

        // 3a. Push armed threat AWAY if close and aiming at us
        if (dist < 200 && enemy.bullets > 0 && isAimingAt(enemy, self.position, Math.PI / 8)) {
          const pushAngle = g.angleBetween(self, enemy); // push away from us
          lastTkTargetId = enemy.id;
          lastTkTick = tickCount;
          return {
            do: g.actions.spell,
            params: { target: enemy, angle: pushAngle, message: msg('Mind over matter') },
          };
        }

        // 3b. Push enemy INTO wall if they're near an edge
        const eDist = distToWall(enemy.position);
        if (eDist < 150 && dist < 400) {
          // Push toward the nearest wall
          let pushAngle: number;
          const ex = enemy.position.x;
          const ey = enemy.position.y;
          if (ex < eDist + 1) pushAngle = Math.PI; // push left
          else if (ex > W() - eDist - 1) pushAngle = 0; // push right
          else if (ey < eDist + 1) pushAngle = -Math.PI / 2; // push up
          else pushAngle = Math.PI / 2; // push down

          lastTkTargetId = enemy.id;
          lastTkTick = tickCount;
          return {
            do: g.actions.spell,
            params: { target: enemy, angle: pushAngle, message: msg('Mind over matter') },
          };
        }

        // 3c. Pull killable target toward us if out of shooting range
        if (dist > 300 && self.bullets > 0 && self.bullets * g.bulletDamage >= enemy.lives) {
          const pullAngle = angleToEnemy + Math.PI; // toward us
          lastTkTargetId = enemy.id;
          lastTkTick = tickCount;
          return {
            do: g.actions.spell,
            params: { target: enemy, angle: pullAngle, message: msg('Come closer...') },
          };
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. ATTACK — Engage killable targets
    // -----------------------------------------------------------------------
    if (self.bullets > 0 && self.energy >= g.shotEnergyCost && enemies.length > 0) {
      // Find best killable target (bullets * damage >= enemy.lives)
      let bestTarget: any = null;
      let bestScore = -1;

      for (const enemy of enemies) {
        if (self.bullets * g.bulletDamage >= enemy.lives) {
          const score = threatScore(self, enemy);
          if (score > bestScore) {
            bestScore = score;
            bestTarget = enemy;
          }
        }
      }

      // If no killable target, pick highest threat anyway
      if (!bestTarget) {
        for (const enemy of enemies) {
          const score = threatScore(self, enemy);
          if (score > bestScore) {
            bestScore = score;
            bestTarget = enemy;
          }
        }
      }

      if (bestTarget) {
        const angle = g.angleBetween(self, bestTarget);
        const dist = g.distanceBetween(self, bestTarget);
        const aimDiff = Math.abs(g.differenceBetweenAngles(self.angle, angle));
        const tolerance = Math.PI / 35;

        // Check line of sight
        if (!g.rayBetween(self, bestTarget)) {
          return { do: g.actions.move, params: { angle: angle, message: msg('Repositioning...') } };
        }

        // Close enough and aimed — shoot
        if (dist < 350 && aimDiff < tolerance) {
          return { do: g.actions.shoot, params: { message: msg('Calculating...') } };
        }

        // Need to aim
        if (dist < 350) {
          return { do: g.actions.turn, params: { angle: angle, message: msg('Locking on...') } };
        }

        // Need to approach
        return { do: g.actions.move, params: { angle: angle, message: msg('Approaching...') } };
      }
    }

    // -----------------------------------------------------------------------
    // 5. COLLECT — Find best safe bullet
    // -----------------------------------------------------------------------
    if (self.bullets < maxBullets(self.level)) {
      let bestBullet: any = null;
      let bestBulletScore = Infinity;

      for (const bullet of bullets) {
        if (bullet.dangerous) continue;
        if (!g.rayBetween(self, bullet)) continue;

        const distToMe = g.distanceBetween(self, bullet);

        // Prefer bullets far from enemies
        let minEnemyDist = Infinity;
        for (const enemy of enemies) {
          const d = g.distanceBetween(enemy, bullet);
          if (d < minEnemyDist) minEnemyDist = d;
        }

        // Score: closer to us is better, closer to enemies is worse
        const score = distToMe - minEnemyDist * 0.5;
        if (score < bestBulletScore) {
          bestBulletScore = score;
          bestBullet = bullet;
        }
      }

      if (bestBullet) {
        const angle = g.angleBetween(self, bestBullet);
        return { do: g.actions.move, params: { angle: angle, message: msg('Acquiring ammo...') } };
      }
    }

    // -----------------------------------------------------------------------
    // 6. HEAL (moderate) — Eat if HP < max - 40 and have bullets
    // -----------------------------------------------------------------------
    if (self.lives < maxLives(self.level) - g.livesPerEatenBullet && self.bullets > 0 && self.energy >= g.eatBulletEnergyCost) {
      return { do: g.actions.eat, params: { message: msg('Recalibrating...') } };
    }

    // -----------------------------------------------------------------------
    // 7. POSITION — Move away from walls toward center if near edge
    // -----------------------------------------------------------------------
    const wallDist = distToWall(self.position);
    if (wallDist < 80) {
      const center = { x: W() / 2, y: H() / 2 };
      const angle = g.angleBetweenPoints(self.position, center);
      return { do: g.actions.move, params: { angle: angle, message: msg('Repositioning...') } };
    }

    // -----------------------------------------------------------------------
    // 8. EVADE — Dodge if armed enemy is aiming at us
    // -----------------------------------------------------------------------
    for (const enemy of enemies) {
      if (enemy.bullets > 0 && g.distanceBetween(self, enemy) < 350 && isAimingAt(enemy, self.position, Math.PI / 12)) {
        const escapeAngle = g.angleBetween(enemy, self) + Math.PI / 4;
        return { do: g.actions.move, params: { angle: escapeAngle, message: msg('Evasive maneuver') } };
      }
    }

    // -----------------------------------------------------------------------
    // 9. HUNT — Move toward weakest enemy if armed
    // -----------------------------------------------------------------------
    if (self.bullets > 0 && enemies.length > 0) {
      let weakest = enemies[0];
      for (const enemy of enemies) {
        if (enemy.lives < weakest.lives) {
          weakest = enemy;
        }
      }
      const angle = g.angleBetween(self, weakest);
      return { do: g.actions.move, params: { angle: angle, message: msg('Hunting...') } };
    }

    // -----------------------------------------------------------------------
    // 10. IDLE — Nothing to do, hold position
    // -----------------------------------------------------------------------
    const idleMessages = ['Analyzing...', 'Calculating...', 'Processing...', 'Observing...'];
    const idleMsg = idleMessages[tickCount % idleMessages.length];
    return { do: g.actions.none, params: { message: msg(idleMsg) } };
  },
};

export default opus;
