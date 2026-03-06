import type { Brain } from '../types';

const g = globalThis as any;

// ---------------------------------------------------------------------------
// Module-level state (persists across ticks, resets on new creature spawn)
// ---------------------------------------------------------------------------
let tick = 0;
let lastTargetId: number | null = null;
let lastSpellTick = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const W = (): number => g.ground.width as number;
const H = (): number => g.ground.height as number;

const maxLives = (lvl: number): number => g.creatureMaxLives[lvl];
const maxBullets = (lvl: number): number => g.creatureMaxBullets[lvl];

const distToWall = (pos: any): number => Math.min(pos.x, pos.y, W() - pos.x, H() - pos.y);

function isAimingAt(enemy: any, pos: any, tolerance: number): boolean {
  const angleToPos = Math.atan2(pos.y - enemy.position.y, pos.x - enemy.position.x);
  const diff = Math.abs(g.differenceBetweenAngles(enemy.angle, angleToPos));
  return diff < tolerance;
}

function scoreEnemy(self: any, enemy: any): number {
  const dist = g.distanceBetween(self, enemy);
  const killable = self.bullets * g.bulletDamage >= enemy.lives ? 1 : 0;
  const aiming = isAimingAt(enemy, self.position, Math.PI / 10) ? 1 : 0;
  const sticky = lastTargetId === enemy.id ? 120 : 0;
  return killable * 600 + aiming * 250 + enemy.bullets * 35 + enemy.iq * 0.5 + (1 / Math.max(dist, 1)) * 380 + sticky;
}

function predictDanger(self: any, bullets: any[]): { bullet: any; distance: number } | null {
  const horizon = 25;
  const radius = 70;
  let best: any = null;
  let bestDist = Infinity;

  for (const bullet of bullets) {
    if (!bullet.dangerous) continue;
    const vx = bullet.velocity.x;
    const vy = bullet.velocity.y;
    const speedSq = vx * vx + vy * vy;
    if (speedSq < 0.01) continue;

    const rx = self.position.x - bullet.position.x;
    const ry = self.position.y - bullet.position.y;
    const t = (rx * vx + ry * vy) / speedSq;
    if (t < 0 || t > horizon) continue;

    const cx = bullet.position.x + vx * t;
    const cy = bullet.position.y + vy * t;
    const dx = self.position.x - cx;
    const dy = self.position.y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < radius && d < bestDist) {
      bestDist = d;
      best = bullet;
    }
  }

  return best ? { bullet: best, distance: bestDist } : null;
}

function chooseDodgeAngle(self: any, bullet: any): number {
  const bulletAngle = Math.atan2(bullet.velocity.y, bullet.velocity.x);
  const a1 = bulletAngle + Math.PI / 2;
  const a2 = bulletAngle - Math.PI / 2;

  const step = 120;
  const p1 = { x: self.position.x + Math.cos(a1) * step, y: self.position.y + Math.sin(a1) * step };
  const p2 = { x: self.position.x + Math.cos(a2) * step, y: self.position.y + Math.sin(a2) * step };

  return distToWall(p1) > distToWall(p2) ? a1 : a2;
}

function bestSafeBullet(self: any, enemies: any[], bullets: any[]): any | null {
  let best: any = null;
  let bestScore = Infinity;

  for (const bullet of bullets) {
    if (bullet.dangerous) continue;
    if (!g.rayBetween(self, bullet)) continue;

    const distToMe = g.distanceBetween(self, bullet);
    let minEnemyDist = Infinity;

    for (const enemy of enemies) {
      const d = g.distanceBetween(enemy, bullet);
      if (d < minEnemyDist) minEnemyDist = d;
    }

    const score = distToMe - minEnemyDist * 0.45;
    if (score < bestScore) {
      bestScore = score;
      best = bullet;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// AegisPrime — Bear (Telekinesis) — Efficient control + precision shooting
// ---------------------------------------------------------------------------

const aegisprime: Brain = {
  name: 'AegisPrime',
  kind: g.kinds.bear,
  author: 'komme',
  description: 'Efficient threat control with predictive dodging, smart telekinesis, and precision fire.',

  thinkAboutIt(self, enemies, bullets, objects, events) {
    tick++;

    const criticalHp = self.lives < maxLives(self.level) * 0.35;

    // 1. Predictive dodge for dangerous bullets
    const danger = predictDanger(self, bullets);
    if (danger) {
      const dodgeAngle = chooseDodgeAngle(self, danger.bullet);
      if (danger.distance < 55 && self.energy >= g.jumpEnergyCost) {
        return { do: g.actions.jump, params: { angle: dodgeAngle, message: 'Dodge' } };
      }
      return { do: g.actions.move, params: { angle: dodgeAngle, message: 'Evade' } };
    }

    // 2. Heal if critical
    if (criticalHp && self.bullets > 0 && self.energy >= g.eatBulletEnergyCost) {
      return { do: g.actions.eat, params: { message: 'Reboot' } };
    }

    // 3. Pick target by threat score
    let target: any = null;
    let bestScore = -Infinity;
    for (const enemy of enemies) {
      const s = scoreEnemy(self, enemy);
      if (s > bestScore) {
        bestScore = s;
        target = enemy;
      }
    }
    if (target) lastTargetId = target.id;

    // 4. Telekinesis control (bear spell)
    if (target && self.level >= 1 && self.energy >= g.telekinesisEnergyCost && tick - lastSpellTick >= 3) {
      const dist = g.distanceBetween(self, target);
      const edgeDist = distToWall(target.position);
      const angleToTarget = g.angleBetween(self, target);

      if (dist < 230 && target.bullets > 0 && isAimingAt(target, self.position, Math.PI / 8)) {
        lastSpellTick = tick;
        lastTargetId = target.id;
        return { do: g.actions.spell, params: { target, angle: angleToTarget, message: 'Disarm' } };
      }

      if (edgeDist < 130 && dist < 420) {
        let pushAngle: number;
        const ex = target.position.x;
        const ey = target.position.y;
        if (ex < edgeDist + 1) pushAngle = Math.PI;
        else if (ex > W() - edgeDist - 1) pushAngle = 0;
        else if (ey < edgeDist + 1) pushAngle = -Math.PI / 2;
        else pushAngle = Math.PI / 2;

        lastSpellTick = tick;
        lastTargetId = target.id;
        return { do: g.actions.spell, params: { target, angle: pushAngle, message: 'Crush' } };
      }

      if (dist > 280 && self.bullets > 0 && self.bullets * g.bulletDamage >= target.lives) {
        lastSpellTick = tick;
        lastTargetId = target.id;
        return { do: g.actions.spell, params: { target, angle: angleToTarget + Math.PI, message: 'Pull' } };
      }
    }

    // 5. Precision shooting
    if (target && self.bullets > 0 && self.energy >= g.shotEnergyCost) {
      const angle = g.angleBetween(self, target);
      const dist = g.distanceBetween(self, target);
      const aimDiff = Math.abs(g.differenceBetweenAngles(self.angle, angle));
      const tolerance = Math.PI / 40;

      if (!g.rayBetween(self, target)) {
        return { do: g.actions.move, params: { angle, message: 'Reposition' } };
      }

      if (dist < 360 && aimDiff < tolerance) {
        return { do: g.actions.shoot, params: { message: 'Fire' } };
      }

      if (dist < 360) {
        return { do: g.actions.turn, params: { angle, message: 'Aim' } };
      }

      return { do: g.actions.move, params: { angle, message: 'Advance' } };
    }

    // 6. Collect safe bullets
    if (self.bullets < maxBullets(self.level)) {
      const bullet = bestSafeBullet(self, enemies, bullets);
      if (bullet) {
        const angle = g.angleBetween(self, bullet);
        return { do: g.actions.move, params: { angle, message: 'Ammo' } };
      }
    }

    // 7. Stay away from walls
    if (distToWall(self.position) < 90) {
      const center = { x: W() / 2, y: H() / 2 };
      const angle = g.angleBetweenPoints(self.position, center);
      return { do: g.actions.move, params: { angle, message: 'Center' } };
    }

    // 8. Strafe away from armed aimers
    for (const enemy of enemies) {
      if (enemy.bullets > 0 && g.distanceBetween(self, enemy) < 380 && isAimingAt(enemy, self.position, Math.PI / 10)) {
        const escapeAngle = g.angleBetween(enemy, self) + Math.PI / 2;
        return { do: g.actions.move, params: { angle: escapeAngle, message: 'Strafe' } };
      }
    }

    // 9. Hunt weakest if armed
    if (self.bullets > 0 && enemies.length > 0) {
      let weakest = enemies[0];
      for (const enemy of enemies) {
        if (enemy.lives < weakest.lives) weakest = enemy;
      }
      const angle = g.angleBetween(self, weakest);
      return { do: g.actions.move, params: { angle, message: 'Hunt' } };
    }

    // 10. Idle
    const idleMsgs = ['Scan', 'Analyze', 'Wait', 'Observe'];
    return { do: g.actions.none, params: { message: idleMsgs[tick % idleMsgs.length] } };
  },
};

export default aegisprime;
