import type { Brain, Action } from '../types';

const g = globalThis as any;

// ---------------------------------------------------------------------------
// Mamba — Runchip (Poison Bullets) — Venomous Hunter
// Author: gramenbos
// Converted from original br_mamba.js (global JS) to TypeScript module
// ---------------------------------------------------------------------------

let pendingShot: number | null = null;
let bulletTargetId: number | null = null;
let bulletTargetTick = 0;
let ignoredBullets: number[] = [];
let revengeTargetName: string | null = null;

const mamba: Brain = {
  name: 'Mamba',
  kind: g.kinds.runchip,
  author: 'gramenbos',
  description: 'Venomous hunter.',

  thinkAboutIt(self, enemies, bullets, objects, events): Action {

    // Track murder events for revenge targeting
    for (let ei = 0; ei < events.length; ei++) {
      const ev = events[ei] as any;
      if (ev.type === 1 && ev.payload.length >= 2 && ev.payload[0].name === 'Mamba') {
        revengeTargetName = ev.payload[1].name;
      }
    }

    // PENDING SHOT — finish a turn+shoot sequence
    if (pendingShot !== null) {
      const aim = pendingShot;
      pendingShot = null;
      const diff = Math.abs(g.differenceBetweenAngles(self.angle, aim));
      if (diff < Math.PI / 10 && self.bullets > 0 && self.energy >= g.shotEnergyCost) {
        return { do: g.actions.shoot, params: { message: 'Bang!' } };
      }
      if (self.bullets > 0) {
        return { do: g.actions.turn, params: { angle: aim } };
      }
    }

    // 1. DODGE
    for (let bi = 0; bi < bullets.length; bi++) {
      const b = bullets[bi];
      if (!b.dangerous) continue;
      const dist = g.distanceBetween(self, b);
      if (dist > 200) continue;
      const bulletAngle = Math.atan2(b.velocity.y, b.velocity.x);
      const toMe = g.angleBetween(b, self);
      const diff = Math.abs(g.differenceBetweenAngles(bulletAngle, toMe));
      if (diff < Math.PI / 5) {
        const dodgeAngle = bulletAngle + Math.PI / 2;
        if (dist < 90 && self.level > 1 && self.energy >= g.jumpEnergyCost) {
          return { do: g.actions.jump, params: { angle: dodgeAngle } };
        }
        return { do: g.actions.move, params: { angle: dodgeAngle } };
      }
    }

    // 2. HEAL
    if (self.lives < g.creatureMaxLives[self.level] - g.livesPerEatenBullet &&
        self.energy >= g.eatBulletEnergyCost && self.bullets > 0) {
      return { do: g.actions.eat };
    }

    // 3. FLEE if no ammo
    if (self.bullets === 0) {
      let nearestArmed: any = null;
      let nearestArmedDist = Infinity;
      for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].bullets <= 0) continue;
        const d = g.distanceBetween(self, enemies[i]);
        if (d < nearestArmedDist) { nearestArmedDist = d; nearestArmed = enemies[i]; }
      }
      if (nearestArmed && nearestArmedDist < 350) {
        return { do: g.actions.move, params: { angle: g.angleBetween(nearestArmed, self) } };
      }
    }

    // 4. STARS & DYNAMITE
    let nearestStar: any = null;
    let nearestStarDist = Infinity;
    const dynamites: Array<{ obj: any; dist: number }> = [];
    for (let oi = 0; oi < objects.length; oi++) {
      const obj = objects[oi] as any;
      const odist = g.distanceBetweenPoints(self.position, obj.position);
      if (obj.type === 1) {
        dynamites.push({ obj, dist: odist });
        const fleeRadius = (obj.condition < 10) ? 250 : 120;
        if (odist < fleeRadius) {
          return { do: g.actions.move, params: { angle: g.angleBetweenPoints(obj.position, self.position) } };
        }
      }
      if (obj.type === 2 && odist < nearestStarDist) {
        nearestStarDist = odist;
        nearestStar = obj;
      }
    }

    // Shoot dynamite near enemies (if we're safe)
    if (self.bullets > 0 && self.energy >= g.shotEnergyCost) {
      for (let di = 0; di < dynamites.length; di++) {
        const dyn = dynamites[di];
        if (dyn.dist < 300) continue;
        const blastRadius = dyn.obj.shape === 0 ? 300 : 200;
        for (let i = 0; i < enemies.length; i++) {
          const eDist = g.distanceBetweenPoints(enemies[i].position, dyn.obj.position);
          if (eDist < blastRadius && g.rayBetween(self, dyn.obj)) {
            const angle = g.angleBetweenPoints(self.position, dyn.obj.position);
            const diff = Math.abs(g.differenceBetweenAngles(self.angle, angle));
            if (diff < Math.PI / 30) {
              return { do: g.actions.shoot, params: { message: 'Boom!' } };
            }
            pendingShot = angle;
            return { do: g.actions.turn, params: { angle } };
          }
        }
      }
    }

    if (nearestStar && (self.level < 2 || nearestStarDist < 200)) {
      return { do: g.actions.move, params: { angle: g.angleBetweenPoints(self.position, nearestStar.position) } };
    }

    // 5. KILL killable targets
    let target: any = null;
    let targetDist = Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.lives > 0 && e.lives <= self.bullets * g.bulletDamage) {
        const d = g.distanceBetween(self, e);
        const priority = (e.name === revengeTargetName) ? d - 1000 : d;
        if (priority < targetDist) { targetDist = priority; target = e; }
      }
    }

    if (target && self.bullets > 0 && self.energy >= g.shotEnergyCost) {
      const realDist = g.distanceBetween(self, target);
      const angle = g.angleBetween(self, target);
      if (!g.rayBetween(self, target)) {
        return { do: g.actions.move, params: { angle } };
      }
      if (realDist > 350) {
        return { do: g.actions.move, params: { angle } };
      }
      const diff = Math.abs(g.differenceBetweenAngles(self.angle, angle));
      if (diff < Math.PI / 30) {
        if (target.name === revengeTargetName) revengeTargetName = null;
        return { do: g.actions.shoot, params: { message: target.name + ', gg!' } };
      }
      pendingShot = angle;
      return { do: g.actions.turn, params: { angle } };
    }

    // 6. COLLECT AMMO
    if (self.bullets < g.creatureMaxBullets[self.level]) {
      let bestBullet: any = null;
      let bestDist = Infinity;
      for (let i = 0; i < bullets.length; i++) {
        const b = bullets[i];
        if (b.dangerous) continue;
        const d = g.distanceBetween(self, b);
        if (d < bestDist && g.rayBetween(self, b) && ignoredBullets.indexOf(b.id) < 0) {
          bestDist = d;
          bestBullet = b;
        }
      }
      if (bestBullet) {
        if (bestBullet.id !== bulletTargetId) {
          bulletTargetId = bestBullet.id;
          bulletTargetTick = 0;
        } else {
          bulletTargetTick++;
          if (bulletTargetTick > 120) {
            ignoredBullets.push(bestBullet.id);
            bulletTargetId = null;
            bulletTargetTick = 0;
          }
        }
        if (bulletTargetId !== null) {
          return { do: g.actions.move, params: { angle: g.angleBetween(self, bestBullet) } };
        }
      }
    }

    // 7. EVADE ARMED
    let threat: any = null;
    let threatDist = Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.bullets <= 0) continue;
      const d = g.distanceBetween(self, e);
      if (d > 500 || !g.rayBetween(self, e)) continue;
      const angleToUs = g.angleBetween(e, self);
      const aimDiff = Math.abs(g.differenceBetweenAngles(e.angle, angleToUs));
      if (aimDiff < Math.PI / 20 && d < threatDist) {
        threatDist = d;
        threat = e;
      }
    }
    if (threat) {
      return { do: g.actions.move, params: { angle: threat.angle + Math.PI / 2 } };
    }

    // 8. WALL AVOIDANCE
    const margin = 30;
    if (self.position.x < margin || self.position.x > g.ground.width - margin ||
        self.position.y < margin || self.position.y > g.ground.height - margin) {
      return { do: g.actions.move, params: { angle: g.angleBetweenPoints(self.position, { x: g.ground.width / 2, y: g.ground.height / 2 }) } };
    }

    return { do: g.actions.none };
  },
};

export default mamba;
