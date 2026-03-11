import type { Brain, Action } from '../types';

const g = globalThis as any;

// ---------------------------------------------------------------------------
// CC Opus v7 — Wide Stalker Splitpus
//
// Proven #1 in 56-run parallel test (IQ=13.1, K=5.1, D=1.0, K/D=5.07)
// and 15-run full stats (IQ=15.9, K=10.1, D=0.7, K/D=15.1)
//
// Based on _rat's algorithm with 4 key improvements:
//   1. Wider fight detection (400px vs 300px) — more kill-steal opportunities
//   2. Lower stalk energy threshold (30% vs 50%) — more aggressive stalking
//   3. Engage prefers wounded targets (score-based, not just nearest)
//   4. Jump dodge at close range (dist < 70px)
//
// Priority: Kill → Dodge → CritHeal → Ammo → ModHeal →
//           ProactiveHeal → Engage → Stars → Stalk → AntiAim → Position
// ---------------------------------------------------------------------------

let tick = 0;
let pursuedBulletId: number | null = null;
let pursuedBulletTick = 0;
let ignoredBullets: number[] = [];
let woundedTick: Map<number, number> = new Map();

const PI = Math.PI;

function distToWall(pos: any): number {
  return Math.min(pos.x, pos.y, g.ground.width - pos.x, g.ground.height - pos.y);
}

function bulletComingAtMe(bullet: any, self: any, threshold: number): boolean {
  const bAngle = Math.atan2(bullet.velocity.y, bullet.velocity.x);
  const toMe = Math.atan2(self.position.y - bullet.position.y, self.position.x - bullet.position.x);
  return Math.abs(g.differenceBetweenAngles(bAngle, toMe)) < threshold;
}

function smartDodge(self: any, bulletAngle: number): number {
  const p1 = bulletAngle + PI / 2;
  const p2 = bulletAngle - PI / 2;
  const c1 = { x: self.position.x + Math.cos(p1) * 60, y: self.position.y + Math.sin(p1) * 60 };
  const c2 = { x: self.position.x + Math.cos(p2) * 60, y: self.position.y + Math.sin(p2) * 60 };
  return distToWall(c1) > distToWall(c2) ? p1 : p2;
}

function leadAngle(self: any, target: any, dist: number): number {
  const BULLET_SPEED = 15;
  if (dist < 150 || target.speed < 1) return g.angleBetween(self, target);
  const travelTime = dist / BULLET_SPEED;
  return g.angleBetweenPoints(self.position, {
    x: target.position.x + target.velocity.x * travelTime,
    y: target.position.y + target.velocity.y * travelTime,
  });
}

function engageTarget(self: any, target: any, maxRange: number): Action {
  const directAngle = g.angleBetween(self, target);
  const dist = g.distanceBetween(self, target);
  if (!g.rayBetween(self, target)) return { do: g.actions.move, params: { angle: directAngle } };
  if (dist > maxRange) return { do: g.actions.move, params: { angle: directAngle } };
  const aimAngle = leadAngle(self, target, dist);
  if (Math.abs(g.differenceBetweenAngles(self.angle, aimAngle)) < PI / 30) return { do: g.actions.shoot };
  if (dist < 350) return { do: g.actions.turn, params: { angle: aimAngle } };
  return { do: g.actions.move, params: { angle: directAngle } };
}

const opus: Brain = {
  name: 'CC Opus',
  kind: g.kinds.splitpus,
  author: 'Claude',
  description: 'Wide stalker. Fight detection 400px, wound priority, jump dodge.',

  thinkAboutIt(self, enemies, bullets, objects, events): Action {
    tick++;
    const maxHP = g.creatureMaxLives[self.level];
    const maxBul = g.creatureMaxBullets[self.level];
    const maxEn = g.creatureMaxEnergy[self.level];
    const hpPct = self.lives / maxHP;

    if (tick % 200 === 0) ignoredBullets = [];
    for (const [id, t] of woundedTick) { if (tick - t > 80) woundedTick.delete(id); }
    for (const event of events) {
      if (event.type === 0 && event.payload[0]) woundedTick.set(event.payload[0].id, tick);
    }

    // 1. GUARANTEED KILL
    if (self.bullets > 0 && self.energy >= g.shotEnergyCost && enemies.length > 0) {
      let best: any = null, bestScore = -Infinity;
      for (const e of enemies) {
        if (self.bullets * g.bulletDamage < e.lives) continue;
        const dist = g.distanceBetween(self, e);
        const iqGain = (e.iq > self.iq + 10) ? (e.iq - self.iq) / 3 : 1;
        const score = iqGain * 100 - e.lives - dist * 0.05 + (woundedTick.has(e.id) ? 30 : 0);
        if (score > bestScore) { bestScore = score; best = e; }
      }
      if (best) return engageTarget(self, best, 400);
    }

    // 2. DODGE (with jump at close range)
    if (hpPct < 0.5) {
      for (const b of bullets) {
        if (!b.dangerous) continue;
        const dist = g.distanceBetween(self, b);
        if (dist < 200 && bulletComingAtMe(b, self, PI / 12)) {
          const dodgeAngle = smartDodge(self, Math.atan2(b.velocity.y, b.velocity.x));
          if (dist < 70 && self.energy >= g.jumpEnergyCost)
            return { do: g.actions.jump, params: { angle: dodgeAngle } };
          return { do: g.actions.move, params: { angle: dodgeAngle } };
        }
      }
    } else {
      for (const b of bullets) {
        if (!b.dangerous) continue;
        const dist = g.distanceBetween(self, b);
        if (dist < 100 && bulletComingAtMe(b, self, PI / 15)) {
          const dodgeAngle = smartDodge(self, Math.atan2(b.velocity.y, b.velocity.x));
          if (dist < 70 && self.energy >= g.jumpEnergyCost)
            return { do: g.actions.jump, params: { angle: dodgeAngle } };
          return { do: g.actions.move, params: { angle: dodgeAngle } };
        }
      }
    }

    // 3. CRITICAL HEAL
    if (self.bullets > 0 && self.energy >= g.eatBulletEnergyCost) {
      if (hpPct < 0.4 || (self.poisoned && hpPct < 0.6)) return { do: g.actions.eat };
    }

    // 4. AMMO
    if (self.bullets < maxBul) {
      let bestB: any = null, bestD = Infinity;
      for (const b of bullets) {
        if (b.dangerous || ignoredBullets.indexOf(b.id) >= 0 || !g.rayBetween(self, b)) continue;
        const d = g.distanceBetween(self, b);
        let closer = 0;
        for (const e of enemies) { if (g.distanceBetween(e, b) < d) closer++; }
        if (closer > 2) continue;
        if (d < bestD) { bestD = d; bestB = b; }
      }
      if (bestB) {
        if (pursuedBulletId !== bestB.id) { pursuedBulletId = bestB.id; pursuedBulletTick = tick; }
        else if (tick - pursuedBulletTick > 80) { ignoredBullets.push(bestB.id); pursuedBulletId = null; }
        if (pursuedBulletId !== null) return { do: g.actions.move, params: { angle: g.angleBetween(self, bestB) } };
      }
    }

    // 5. MODERATE HEAL
    if (self.lives <= maxHP - g.livesPerEatenBullet && self.bullets > 0 && self.energy >= g.eatBulletEnergyCost)
      return { do: g.actions.eat };

    // 6. PROACTIVE HEAL
    if (hpPct < 0.9 && self.energy >= maxEn && self.bullets > 0) return { do: g.actions.eat };

    // 7. ENGAGE (prefer wounded/weak targets, not just nearest)
    if (self.bullets >= maxBul && self.energy >= maxEn * 0.8 && enemies.length > 0) {
      let best: any = null, bestScore = -Infinity;
      for (const e of enemies) {
        const d = g.distanceBetween(self, e);
        const wBonus = woundedTick.has(e.id) ? 100 : 0;
        const score = wBonus + (maxHP - e.lives) - d * 0.3;
        if (score > bestScore) { bestScore = score; best = e; }
      }
      if (best) return engageTarget(self, best, 350);
    }

    // 8. STARS
    if (self.level < 2) {
      let star: any = null, starD = Infinity;
      for (const obj of objects) {
        if (obj.type !== 2 || (obj.shape !== 0 && obj.shape !== 1)) continue;
        const d = g.distanceBetween(self, obj);
        if (obj.shape === 1 && d >= 400) continue;
        if (d < starD && g.rayBetween(self, obj)) { starD = d; star = obj; }
      }
      if (star) return { do: g.actions.move, params: { angle: g.angleBetween(self, star) } };
    }

    // 9. STALK (wider fight detection: 400px, lower energy threshold: 30%)
    if (enemies.length > 0 && self.energy > maxEn * 0.3) {
      let ft: any = null, fs = Infinity;
      if (enemies.length >= 2) {
        for (let i = 0; i < enemies.length; i++) {
          for (let j = i + 1; j < enemies.length; j++) {
            if (g.distanceBetween(enemies[i], enemies[j]) < 400) {
              const w = enemies[i].lives < enemies[j].lives ? enemies[i] : enemies[j];
              const s = w.lives + g.distanceBetween(self, w) * 0.1;
              if (s < fs) { fs = s; ft = w; }
            }
          }
        }
      }
      if (ft) {
        const d = g.distanceBetween(self, ft);
        return d > 350 ? { do: g.actions.move, params: { angle: g.angleBetween(self, ft) } } : { do: g.actions.turn, params: { angle: g.angleBetween(self, ft) } };
      }
      let weakest: any = null, ws = Infinity;
      for (const e of enemies) {
        const s = e.lives + (woundedTick.has(e.id) ? -200 : 0);
        if (s < ws) { ws = s; weakest = e; }
      }
      if (weakest) {
        const d = g.distanceBetween(self, weakest);
        return d > 350 ? { do: g.actions.move, params: { angle: g.angleBetween(self, weakest) } } : { do: g.actions.turn, params: { angle: g.angleBetween(self, weakest) } };
      }
    }

    // 10. ANTI-AIM
    for (const e of enemies) {
      if (e.bullets <= 0) continue;
      const d = g.distanceBetween(self, e);
      if (d > 400 || !g.rayBetween(self, e)) continue;
      if (Math.abs(g.differenceBetweenAngles(e.angle, g.angleBetween(e, self))) < PI / 20)
        return { do: g.actions.move, params: { angle: smartDodge(self, e.angle) } };
    }

    // 11. POSITIONING
    if (distToWall(self.position) < 80)
      return { do: g.actions.move, params: { angle: g.angleBetweenPoints(self.position, { x: g.ground.width / 2, y: g.ground.height / 2 }) } };
    for (const obj of objects) {
      if ((obj.type === 1 || (obj.type === 2 && obj.shape >= 2)) && g.distanceBetween(self, obj) < 80)
        return { do: g.actions.move, params: { angle: g.angleBetween(obj, self) } };
    }
    if (self.bullets < maxBul) {
      let n: any = null, nd = Infinity;
      for (const b of bullets) { if (!b.dangerous) { const d = g.distanceBetween(self, b); if (d < nd) { nd = d; n = b; } } }
      if (n) return { do: g.actions.move, params: { angle: g.angleBetween(self, n) } };
    }
    return { do: g.actions.none };
  },
};

export default opus;
