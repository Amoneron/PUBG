import type { Brain, Action } from '../types';

const g = globalThis as any;

// =============================================================================
// _rat v9.2 — Lead-Targeting IQ Hunter + Event Tracking
// Species: Runchip (does NOT use poison spell)
//
// Base: v9.1 (57% wins, 93% top-3 over 14x 1h runs)
// New in v9.2:
//   - Event-based targeting: track wound events, prioritize enemies in active combat
//   - Level-up stars (shape 0) collected from ANY distance (huge stat boost)
//   - Healing stars still limited to 400px
// Result: 71% wins, 86% top-3 over 7x 1h runs
//
// Priority: Kill(IQ) → Dodge → CritHeal → Ammo → ModHeal →
//           ProactiveHeal → Engage → Stars → Stalk → AntiAim → Position
// =============================================================================

let tick = 0;

// Bullet pursuit anti-stall
let pursuedBulletId: number | null = null;
let pursuedBulletTick = 0;
let ignoredBullets: number[] = [];

// Event tracking: recently wounded enemies (in active combat)
let woundedTick: Map<number, number> = new Map();

const PI = Math.PI;

function distToWall(pos: any): number {
  return Math.min(pos.x, pos.y, g.ground.width - pos.x, g.ground.height - pos.y);
}

function bulletComingAtMe(bullet: any, self: any, threshold: number): boolean {
  const bAngle = Math.atan2(bullet.velocity.y, bullet.velocity.x);
  const toMe = Math.atan2(
    self.position.y - bullet.position.y,
    self.position.x - bullet.position.x,
  );
  return Math.abs(g.differenceBetweenAngles(bAngle, toMe)) < threshold;
}

function smartDodge(self: any, bulletAngle: number): number {
  const p1 = bulletAngle + PI / 2;
  const p2 = bulletAngle - PI / 2;
  const c1 = {
    x: self.position.x + Math.cos(p1) * 60,
    y: self.position.y + Math.sin(p1) * 60,
  };
  const c2 = {
    x: self.position.x + Math.cos(p2) * 60,
    y: self.position.y + Math.sin(p2) * 60,
  };
  return distToWall(c1) > distToWall(c2) ? p1 : p2;
}

/** Compute lead angle: aim where target WILL BE when bullet arrives. */
function leadAngle(self: any, target: any, dist: number): number {
  const BULLET_SPEED = 15;
  if (dist < 150 || target.speed < 1) {
    // Close range or stationary: aim directly
    return g.angleBetween(self, target);
  }
  // Predict target position when bullet arrives
  const travelTime = dist / BULLET_SPEED;
  const predX = target.position.x + target.velocity.x * travelTime;
  const predY = target.position.y + target.velocity.y * travelTime;
  return g.angleBetweenPoints(self.position, { x: predX, y: predY });
}

/** Aim and shoot at target with lead prediction. */
function engageTarget(self: any, target: any, maxRange: number): Action {
  const directAngle = g.angleBetween(self, target);
  const dist = g.distanceBetween(self, target);

  if (!g.rayBetween(self, target)) {
    return { do: g.actions.move, params: { angle: directAngle } };
  }
  if (dist > maxRange) {
    return { do: g.actions.move, params: { angle: directAngle } };
  }

  // Use lead targeting at medium+ range
  const aimAngle = leadAngle(self, target, dist);

  // Uniform aim tolerance PI/30 (like Reptile)
  const tol = PI / 30;

  const aimDiff = Math.abs(g.differenceBetweenAngles(self.angle, aimAngle));
  if (aimDiff < tol) {
    return { do: g.actions.shoot };
  }

  if (dist < 350) {
    return { do: g.actions.turn, params: { angle: aimAngle } };
  }
  return { do: g.actions.move, params: { angle: directAngle } };
}

// ---------------------------------------------------------------------------
// The Brain
// ---------------------------------------------------------------------------
const narciss: Brain = {
  name: '_rat',
  kind: g.kinds.runchip,
  author: '_rat',
  description: 'Fight-stalker. Kill-steal, smart dodge, stay and fight.',

  thinkAboutIt(self, enemies, bullets, objects, events): Action {
    tick++;

    const maxHP = g.creatureMaxLives[self.level];
    const maxBullets = g.creatureMaxBullets[self.level];
    const maxEnergy = g.creatureMaxEnergy[self.level];
    const hpPct = self.lives / maxHP;

    if (tick % 200 === 0) ignoredBullets = [];

    // Process events: track wounded enemies (active combat)
    for (const [id, t] of woundedTick) {
      if (tick - t > 80) woundedTick.delete(id);
    }
    for (const event of events) {
      if (event.type === 0 && event.payload[0]) { // wound
        woundedTick.set(event.payload[0].id, tick);
      }
    }

    // =================================================================
    // 1. KILL — confirmed kill targets (bullets * 10 >= lives)
    //    HIGHEST PRIORITY. Prefer high-IQ targets (more IQ gain),
    //    then weakest (easiest kill), then closest.
    //    Approach from 400px. No energy buffer — never miss a kill.
    // =================================================================
    if (self.bullets > 0 && self.energy >= g.shotEnergyCost && enemies.length > 0) {
      let bestTarget: any = null;
      let bestScore = -Infinity;

      for (const e of enemies) {
        if (self.bullets * g.bulletDamage < e.lives) continue;
        const dist = g.distanceBetween(self, e);
        // IQ gain: high-IQ targets give more; also prefer weak + close
        const iqGain = (e.iq > self.iq + 10) ? (e.iq - self.iq) / 3 : 1;
        // Bonus for recently wounded (in active combat — likely to take more damage)
        const woundBonus = woundedTick.has(e.id) ? 30 : 0;
        const score = iqGain * 100 - e.lives - dist * 0.05 + woundBonus;

        if (score > bestScore) {
          bestScore = score;
          bestTarget = e;
        }
      }

      if (bestTarget) {
        return engageTarget(self, bestTarget, 400);
      }
    }

    // =================================================================
    // 2. DODGE — incoming bullets (CONDITIONAL)
    //    HP < 50%: aggressive dodge (200px, PI/12)
    //    HP >= 50%: minimal dodge (100px, PI/15)
    // =================================================================
    if (hpPct < 0.5) {
      for (const b of bullets) {
        if (!b.dangerous) continue;
        const dist = g.distanceBetween(self, b);
        if (dist < 200 && bulletComingAtMe(b, self, PI / 12)) {
          const bAngle = Math.atan2(b.velocity.y, b.velocity.x);
          return { do: g.actions.move, params: { angle: smartDodge(self, bAngle) } };
        }
      }
    } else {
      for (const b of bullets) {
        if (!b.dangerous) continue;
        const dist = g.distanceBetween(self, b);
        if (dist < 100 && bulletComingAtMe(b, self, PI / 15)) {
          const bAngle = Math.atan2(b.velocity.y, b.velocity.x);
          return { do: g.actions.move, params: { angle: smartDodge(self, bAngle) } };
        }
      }
    }

    // =================================================================
    // 3. CRITICAL HEAL (HP < 40%, or poisoned + HP < 60%)
    // =================================================================
    if (self.bullets > 0 && self.energy >= g.eatBulletEnergyCost) {
      if (hpPct < 0.4 || (self.poisoned && hpPct < 0.6)) {
        return { do: g.actions.eat };
      }
    }

    // =================================================================
    // 4. AMMO — collect safe bullets (max 2 closer enemies)
    // =================================================================
    if (self.bullets < maxBullets) {
      let bestBullet: any = null;
      let bestDist = Infinity;

      for (const b of bullets) {
        if (b.dangerous) continue;
        if (ignoredBullets.indexOf(b.id) >= 0) continue;
        if (!g.rayBetween(self, b)) continue;

        const d = g.distanceBetween(self, b);

        let closerEnemies = 0;
        for (const e of enemies) {
          if (g.distanceBetween(e, b) < d) closerEnemies++;
        }
        if (closerEnemies > 2) continue;

        if (d < bestDist) {
          bestDist = d;
          bestBullet = b;
        }
      }

      if (bestBullet) {
        if (pursuedBulletId !== bestBullet.id) {
          pursuedBulletId = bestBullet.id;
          pursuedBulletTick = tick;
        } else if (tick - pursuedBulletTick > 80) {
          ignoredBullets.push(bestBullet.id);
          pursuedBulletId = null;
        }
        if (pursuedBulletId !== null) {
          return { do: g.actions.move, params: { angle: g.angleBetween(self, bestBullet) } };
        }
      }
    }

    // =================================================================
    // 5. MODERATE HEAL (HP missing >= bullet heal value)
    // =================================================================
    if (self.lives <= maxHP - g.livesPerEatenBullet && self.bullets > 0 && self.energy >= g.eatBulletEnergyCost) {
      return { do: g.actions.eat };
    }

    // =================================================================
    // 6. PROACTIVE HEAL (HP < 90%, full energy)
    // =================================================================
    if (hpPct < 0.9 && self.energy >= maxEnergy && self.bullets > 0) {
      return { do: g.actions.eat };
    }

    // =================================================================
    // 7. ENGAGE — shoot nearest enemy when resources are good
    //    Full ammo + 80% energy. Stay and fight.
    // =================================================================
    if (
      self.bullets >= maxBullets &&
      self.energy >= maxEnergy * 0.8 &&
      enemies.length > 0
    ) {
      let nearest: any = null;
      let nearestDist = Infinity;

      for (const e of enemies) {
        const dist = g.distanceBetween(self, e);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = e;
        }
      }

      if (nearest) {
        return engageTarget(self, nearest, 350);
      }
    }

    // =================================================================
    // 8. STARS — level-up (any distance!) and healing (400px)
    // =================================================================
    if (self.level < 2) {
      let nearestStar: any = null;
      let nearestStarDist = Infinity;

      for (const obj of objects) {
        if (obj.type !== 2) continue;
        if (obj.shape !== 0 && obj.shape !== 1) continue;
        const dist = g.distanceBetween(self, obj);
        // Level-up stars (shape 0): no distance limit — too valuable
        // Healing stars (shape 1): 400px limit
        if (obj.shape === 1 && dist >= 400) continue;
        if (dist < nearestStarDist && g.rayBetween(self, obj)) {
          nearestStarDist = dist;
          nearestStar = obj;
        }
      }

      if (nearestStar) {
        return { do: g.actions.move, params: { angle: g.angleBetween(self, nearestStar) } };
      }
    }

    // =================================================================
    // 9. STALK — fight-stalking: approach ongoing fights for kill-steal
    //    If two enemies are fighting (close together), approach their fight.
    //    Otherwise, approach weakest enemy.
    // =================================================================
    if (enemies.length > 0 && self.energy > maxEnergy * 0.5) {
      // Detect fights: two enemies close to each other
      let fightTarget: any = null;
      let fightScore = Infinity; // lower is better (weaker + closer fight)

      if (enemies.length >= 2) {
        for (let i = 0; i < enemies.length; i++) {
          for (let j = i + 1; j < enemies.length; j++) {
            const fightDist = g.distanceBetween(enemies[i], enemies[j]);
            if (fightDist < 300) {
              // These two are fighting! Go to the weaker one
              const weaker = enemies[i].lives < enemies[j].lives ? enemies[i] : enemies[j];
              const myDist = g.distanceBetween(self, weaker);
              const score = weaker.lives + myDist * 0.1; // prefer weak + close
              if (score < fightScore) {
                fightScore = score;
                fightTarget = weaker;
              }
            }
          }
        }
      }

      if (fightTarget) {
        const dist = g.distanceBetween(self, fightTarget);
        if (dist > 350) {
          return { do: g.actions.move, params: { angle: g.angleBetween(self, fightTarget) } };
        }
        return { do: g.actions.turn, params: { angle: g.angleBetween(self, fightTarget) } };
      }

      // No fight detected — stalk wounded or weakest enemy
      let weakest: any = null;
      let bestStalkScore = Infinity;

      for (const e of enemies) {
        // Prefer recently wounded (in combat), then weakest
        const wounded = woundedTick.has(e.id) ? -200 : 0;
        const score = e.lives + wounded;
        if (score < bestStalkScore) {
          bestStalkScore = score;
          weakest = e;
        }
      }

      if (weakest) {
        const dist = g.distanceBetween(self, weakest);
        if (dist > 350) {
          return { do: g.actions.move, params: { angle: g.angleBetween(self, weakest) } };
        }
        return { do: g.actions.turn, params: { angle: g.angleBetween(self, weakest) } };
      }
    }

    // =================================================================
    // 10. ANTI-AIM — dodge enemies pointing at us (like Reptile's achtung)
    // =================================================================
    if (enemies.length > 0) {
      let threat: any = null;
      let threatDist = Infinity;

      for (const e of enemies) {
        if (e.bullets <= 0) continue;
        const dist = g.distanceBetween(self, e);
        if (dist > 400) continue;
        if (!g.rayBetween(self, e)) continue;

        const angleToUs = g.angleBetween(e, self);
        const aimDiff = Math.abs(g.differenceBetweenAngles(e.angle, angleToUs));
        if (aimDiff < PI / 20 && dist < threatDist) {
          threatDist = dist;
          threat = e;
        }
      }

      if (threat) {
        return { do: g.actions.move, params: { angle: smartDodge(self, threat.angle) } };
      }
    }

    // =================================================================
    // 11. POSITIONING — avoid walls, dynamite, bad stars, drift to bullets
    // =================================================================
    if (distToWall(self.position) < 80) {
      const center = { x: g.ground.width / 2, y: g.ground.height / 2 };
      return { do: g.actions.move, params: { angle: g.angleBetweenPoints(self.position, center) } };
    }

    for (const obj of objects) {
      if (obj.type === 1 || (obj.type === 2 && obj.shape >= 2)) {
        if (g.distanceBetween(self, obj) < 80) {
          return { do: g.actions.move, params: { angle: g.angleBetween(obj, self) } };
        }
      }
    }

    if (self.bullets < maxBullets) {
      let nearest: any = null;
      let nearestDist = Infinity;
      for (const b of bullets) {
        if (b.dangerous) continue;
        const d = g.distanceBetween(self, b);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = b;
        }
      }
      if (nearest) {
        return { do: g.actions.move, params: { angle: g.angleBetween(self, nearest) } };
      }
    }

    return { do: g.actions.none };
  },
};

export default narciss;
