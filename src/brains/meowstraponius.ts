import type { Brain } from '../types';

const g = globalThis as any;

let tick = 0;

const meowstraponius: Brain = {
  name: 'strpnius',
  kind: g.kinds.runchip,
  author: 'komme',
  description: 'Patient sniper. Keeps optimal distance, aims precisely, poisons bullets. Made with Claude PRO',

  thinkAboutIt(self, enemies, bullets, objects, events) {
    tick++;

    const MAX_DIST = g.ground.width + g.ground.height;
    const OPTIMAL_MIN = 250;
    const OPTIMAL_MAX = 450;
    const AIM_PRECISION = Math.PI / 40;

    // --- 1. DODGE incoming dangerous bullets ---
    let incomingBullet: any = null;
    let incomingDist = MAX_DIST;

    bullets.forEach((b: any) => {
      if (!b.dangerous) return;
      const dist = g.distanceBetween(self, b);
      if (dist > 280) return;
      const bulletAngle = Math.atan2(b.velocity.y, b.velocity.x);
      const toMeAngle = g.angleBetween(b, self);
      const diff = Math.abs(g.differenceBetweenAngles(bulletAngle, toMeAngle));
      if (diff < Math.PI / 8 && dist < incomingDist) {
        incomingDist = dist;
        incomingBullet = b;
      }
    });

    if (incomingBullet) {
      const bulletAngle = Math.atan2(incomingBullet.velocity.y, incomingBullet.velocity.x);
      const dodgeAngle = bulletAngle + (tick % 2 === 0 ? Math.PI / 2 : -Math.PI / 2);
      return { do: g.actions.move, params: { angle: dodgeAngle, message: 'nyaa~' } };
    }

    // --- 2. HEAL if low HP ---
    if (
      self.lives < g.creatureMaxLives[self.level] * 0.45 &&
      self.bullets > 0 &&
      self.energy >= g.eatBulletEnergyCost
    ) {
      return { do: g.actions.eat, params: { message: 'om nom nom' } };
    }

    // --- 3. COLLECT safe bullets if not full ---
    if (self.bullets < g.creatureMaxBullets[self.level]) {
      let nearest: any = null;
      let nearestDist = MAX_DIST;
      bullets.forEach((b: any) => {
        if (b.dangerous) return;
        const d = g.distanceBetween(self, b);
        if (d < nearestDist) { nearestDist = d; nearest = b; }
      });
      if (nearest && nearestDist < 400) {
        return { do: g.actions.move, params: { angle: g.angleBetween(self, nearest), message: 'ammo...' } };
      }
    }

    // --- 4. No targets or ammo — wait ---
    if (enemies.length === 0 || self.bullets < 1) {
      return { do: g.actions.none, params: { message: '...' } };
    }

    // --- 5. Pick weakest enemy as target ---
    let target = enemies[0];
    enemies.forEach((e: any) => {
      if (e.lives < target.lives) target = e;
    });

    const targetDist = g.distanceBetween(self, target);
    const targetAngle = g.angleBetween(self, target);
    const hasShotEnergy = self.energy >= g.shotEnergyCost;
    const aimDiff = Math.abs(g.differenceBetweenAngles(self.angle, targetAngle));
    const hasLOS = g.rayBetween(self, target);

    // --- 6. POISON SPELL: activate when well-aimed and in range ---
    const spellCost: number = g.poisonerEnergyCost ?? 100;
    if (
      self.energy >= spellCost + g.shotEnergyCost &&
      targetDist < OPTIMAL_MAX &&
      hasLOS &&
      aimDiff < AIM_PRECISION * 4
    ) {
      return { do: g.actions.spell, params: { message: 'poison kiss' } };
    }

    // --- 7. POSITION: keep sniper range ---
    if (!hasShotEnergy) {
      if (targetDist < OPTIMAL_MIN) {
        return { do: g.actions.move, params: { angle: targetAngle + Math.PI, message: 'back off' } };
      }
      return { do: g.actions.none, params: { message: 'charging...' } };
    }

    if (targetDist < OPTIMAL_MIN) {
      return { do: g.actions.move, params: { angle: targetAngle + Math.PI, message: 'too close' } };
    }

    if (targetDist > OPTIMAL_MAX) {
      return { do: g.actions.move, params: { angle: targetAngle, message: 'closing in' } };
    }

    // --- 8. IN RANGE: get line of sight ---
    if (!hasLOS) {
      return { do: g.actions.move, params: { angle: targetAngle, message: 'find angle' } };
    }

    // --- 9. AIM and SHOOT ---
    if (aimDiff < AIM_PRECISION) {
      return { do: g.actions.shoot, params: { message: 'gotcha ' + target.name } };
    }

    return { do: g.actions.turn, params: { angle: targetAngle, message: 'aiming...' } };
  },
};

export default meowstraponius;
