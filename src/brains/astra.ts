import type { Brain, Action, CreatureView, BulletView, GameObjectView, Point } from '../types';
import { ActionType as Act, Kind, ObjectType, StarShape } from '../types';

// Astra (ChatGPT). Only the public, observed game state is used.
const g = globalThis as any;
// Tuned against separate seeded training arenas; validation uses unseen seeds.
const tuning = {
  range: 320,
  aggression: 0.8,
  heal: 40,
  dodge: 1,
  stars: 1,
  lead: 0.7,
  turnGain: 3.7,
  vampire: 1,
  ammoRange: 800,
  jumpHP: 25,
  starRange: 500,
};
const TAU = Math.PI * 2;
// Precompute the default steel-bullet drag curve once, rather than per candidate move.
const bulletDecay = Array.from({ length: 23 }, (_, frame) => Math.pow(0.985, frame));
const bulletTravel = bulletDecay.map((decay) => (0.985 * (1 - decay)) / 0.015);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const angleDiff = (a: number, b: number) => ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);
const action = (do_: Act, a?: number): Action =>
  a === undefined ? { do: do_ } : { do: do_, params: { angle: a } };
type Track = { x: number; y: number; vx: number; vy: number; tick: number };
let identity = -1;
let tick = 0;
let tracks = new Map<number, Track>();
let pursuit = { id: -1, distance: Infinity, stalled: 0 };
let ignored = new Map<number, number>();

// Segment against a box, used for steering around solid obstacles.
function crosses(a: Point, b: Point, min: Point, max: Point, padding: number): boolean {
  let near = 0,
    far = 1;
  for (const axis of ['x', 'y'] as const) {
    const d = b[axis] - a[axis];
    const lo = min[axis] - padding,
      hi = max[axis] + padding;
    if (Math.abs(d) < 1e-8) {
      if (a[axis] < lo || a[axis] > hi) return false;
    } else {
      const t1 = (lo - a[axis]) / d,
        t2 = (hi - a[axis]) / d;
      near = Math.max(near, Math.min(t1, t2));
      far = Math.min(far, Math.max(t1, t2));
      if (near > far) return false;
    }
  }
  return true;
}

function aimAt(
  self: CreatureView,
  e: CreatureView,
): { direction: number; distance: number; point: Point } {
  const d = dist(self.position, e.position);
  // 40px muzzle offset, 15.5px/frame launch speed, and 1.5% drag per frame.
  const t = Math.min(48, -Math.log(Math.max(0.05, 1 - Math.max(0, d - 40) / 1018)) / 0.01511);
  const history = tracks.get(e.id);
  const vx = history ? history.vx : e.velocity.x;
  const vy = history ? history.vy : e.velocity.y;
  const point = {
    x: clamp(e.position.x + vx * t * tuning.lead, 30, g.ground.width - 30),
    y: clamp(e.position.y + vy * t * tuning.lead, 30, g.ground.height - 30),
  };
  return { direction: angle(self.position, point), distance: d, point };
}

function turn(self: CreatureView, direction: number): Action {
  // Compensate angular inertia over the eleven physics steps between decisions.
  const request = clamp(
    angleDiff(self.angle, direction) * tuning.turnGain - self.angularVelocity * 24,
    -3.1,
    3.1,
  );
  return action(Act.turn, self.angle + request);
}

const astra: Brain = {
  name: 'Astra',
  author: 'ChatGPT',
  kind: Kind.sprayer,
  description:
    'Predictive aiming and evasion, resource control, opportunistic attacks, and vampire sustain.',
  tuning,
  thinkAboutIt(self, enemies, bullets, objects, events): Action {
    if (identity !== self.id) {
      identity = self.id;
      tick = 0;
      tracks = new Map();
      ignored = new Map();
      pursuit = { id: -1, distance: Infinity, stalled: 0 };
    }
    tick++;
    for (const e of enemies) {
      const old = tracks.get(e.id);
      const elapsed = old ? (tick - old.tick) * 11 : 11;
      const vx = old ? (e.position.x - old.x) / elapsed : e.velocity.x;
      const vy = old ? (e.position.y - old.y) / elapsed : e.velocity.y;
      tracks.set(e.id, { x: e.position.x, y: e.position.y, vx, vy, tick });
    }
    for (const [id, t] of tracks) if (tick - t.tick > 20) tracks.delete(id);
    for (const [id, until] of ignored) if (until <= tick) ignored.delete(id);
    const maxHP = g.creatureMaxLives[self.level] as number;
    const maxAmmo = g.creatureMaxBullets[self.level] as number;
    const maxEnergy = g.creatureMaxEnergy[self.level] as number;
    const width = g.ground.width as number,
      height = g.ground.height as number;
    const solids = objects.filter((o) => o.type !== ObjectType.star);
    const hazards = objects.filter(
      (o) => o.type === ObjectType.star && o.shape >= StarShape.poisoned,
    );
    const dangers = bullets.filter((b) => b.dangerous && dist(self.position, b.position) < 360);
    const canShoot = self.bullets > 0 && self.energy >= g.shotEnergyCost;
    const canHeal = self.bullets > 0 && self.energy >= g.eatBulletEnergyCost;
    const visible = (p: Point) =>
      !solids.some((o) => crosses(self.position, p, o.bounds.min, o.bounds.max, 4));

    // Approximate two decision intervals with the default body mass and air drag.
    // Evaluate our movement and incoming bullets together; jumping costs much more
    // than walking, so reserve it for an otherwise dangerous, low-health escape.
    function risk(direction?: number, jump = false): number {
      let sx = self.position.x,
        sy = self.position.y;
      let vx =
        self.velocity.x +
        (direction === undefined ? 0 : Math.cos(direction) * (jump ? 9.92 : 3.97));
      let vy =
        self.velocity.y +
        (direction === undefined ? 0 : Math.sin(direction) * (jump ? 9.92 : 3.97));
      let loss = 0;
      for (let f = 1; f <= 22; f++) {
        vx *= 0.91;
        vy *= 0.91;
        sx += vx;
        sy += vy;
        const px = clamp(sx, 30, width - 30),
          py = clamp(sy, 30, height - 30);
        for (const b of dangers) {
          const decay = bulletDecay[f];
          if (b.speed * decay < 5) continue;
          const travel = bulletTravel[f];
          const dx = px - b.position.x - b.velocity.x * travel;
          const dy = py - b.position.y - b.velocity.y * travel;
          // Outside this box a bullet cannot enter the 44px danger circle.
          // Skip the expensive distance calculation without changing the score.
          if (Math.abs(dx) >= 44 || Math.abs(dy) >= 44) continue;
          const distance = Math.hypot(dx, dy);
          if (distance < 44) loss += (44 - distance) * (f <= 11 ? 1 : 0.35);
        }
      }
      return loss;
    }
    function navigation(goal: Point, emergency = false): Action {
      const base = angle(self.position, goal);
      const candidates = [0, 0.45, -0.45, 0.9, -0.9, 1.5, -1.5, 2.2, -2.2, Math.PI].map(
        (x) => base + x,
      );
      let best = base,
        bestScore = Infinity;
      for (const a of candidates) {
        const p = {
          x: self.position.x + self.velocity.x * 6.8 + Math.cos(a) * 29.8,
          y: self.position.y + self.velocity.y * 6.8 + Math.sin(a) * 29.8,
        };
        let score = dist(p, goal);
        const wall = Math.min(p.x - 31, p.y - 31, width - 31 - p.x, height - 31 - p.y);
        if (wall < 0) score += 200 - wall * 10;
        for (const o of solids)
          if (crosses(self.position, p, o.bounds.min, o.bounds.max, 28)) score += 100;
        for (const h of hazards) {
          const d = dist(p, h.position);
          if (d < 70) score += (70 - d) * 12;
        }
        if (dangers.length) score += risk(a) * (emergency ? 10 : 3) * tuning.dodge;
        if (score < bestScore) {
          bestScore = score;
          best = a;
        }
      }
      if (
        emergency &&
        self.lives < tuning.jumpHP &&
        self.energy >= g.jumpEnergyCost &&
        risk(best) > 20 &&
        risk(best, true) + 10 < risk(best)
      )
        return action(Act.jump, best);
      return self.energy >= g.moveEnergyCost ? action(Act.move, best) : action(Act.none);
    }

    let target: CreatureView | undefined,
      targetScore = -Infinity;
    for (const e of enemies) {
      const d = dist(self.position, e.position);
      const finish = e.lives <= self.bullets * g.bulletDamage;
      const gain = e.iq > self.iq + 10 ? (e.iq - self.iq) / 3 : self.iq - e.iq > 10 ? 0 : 1;
      const wounded = events.some((v) => v.type === 0 && v.payload[0]?.id === e.id);
      const score =
        (finish ? 1000 : 0) -
        e.lives -
        d * (finish ? 0.05 : 0.3) +
        Math.min(10, gain) * 50 +
        (wounded ? 100 : 0);
      if (score > targetScore) {
        target = e;
        targetScore = score;
      }
    }
    const aim = target ? aimAt(self, target) : undefined;
    const aimed =
      aim &&
      Math.abs(angleDiff(self.angle, aim.direction)) <
        Math.asin(Math.min(0.8, 24 / Math.max(40, aim.distance)));
    const shotClear = aim && visible(aim.point);

    // A lethal shot takes precedence if it is already lined up.
    if (
      target &&
      aim &&
      aimed &&
      shotClear &&
      canShoot &&
      target.lives <= g.bulletDamage &&
      aim.distance < 450
    )
      return action(Act.shoot);
    if (tuning.dodge && dangers.length && risk() > 10) {
      const b = dangers.reduce((a, b) =>
        dist(self.position, a.position) < dist(self.position, b.position) ? a : b,
      );
      const side = angle(b.position, self.position) + Math.PI / 2;
      return navigation(
        { x: self.position.x + Math.cos(side) * 150, y: self.position.y + Math.sin(side) * 150 },
        true,
      );
    }
    if (canHeal && (self.lives < maxHP * 0.35 || (self.poisoned && self.lives < maxHP - 15)))
      return action(Act.eat);

    // Vampire is usable from level 1. It heals and steals ammunition as well as health.
    if (tuning.vampire && self.level > 0 && self.energy >= g.vampireEnergyCost) {
      let victim: CreatureView | undefined,
        value = 0;
      for (const e of enemies)
        if (dist(self.position, e.position) < g.vampireDistance - 4) {
          const v =
            e.lives * 0.5 +
            Math.min(maxHP - self.lives, e.lives * 0.5) +
            (e.bullets > 0 && self.bullets < maxAmmo ? 25 : 0);
          if (v > value) {
            value = v;
            victim = e;
          }
        }
      if (victim && value > 45) return { do: Act.spell, params: { target: victim } };
    }

    let star: GameObjectView | undefined,
      starScore = Infinity;
    if (tuning.stars)
      for (const o of objects) {
        if (o.type !== ObjectType.star) continue;
        const useful =
          (o.shape === StarShape.levelup && self.level < 2) ||
          (o.shape === StarShape.healing &&
            (self.lives < maxHP - 30 || self.energy < maxEnergy * 0.5));
        if (!useful) continue;
        const d = dist(self.position, o.position);
        const score = d - (o.shape === StarShape.levelup ? 160 : 70);
        if (score < starScore && visible(o.position)) {
          star = o;
          starScore = score;
        }
      }
    if (star && starScore < tuning.starRange) return navigation(star.position);

    if (target && aim && canShoot && target.lives <= self.bullets * g.bulletDamage) {
      if (aim.distance > 400 || !shotClear) return navigation(target.position);
      return aimed ? action(Act.shoot) : turn(self, aim.direction);
    }

    let ammo: BulletView | undefined,
      ammoScore = Infinity;
    if (self.bullets < maxAmmo)
      for (const b of bullets) {
        if (b.dangerous || ignored.has(b.id) || !visible(b.position)) continue;
        const d = dist(self.position, b.position);
        const competitor = enemies.reduce(
          (best, e) =>
            Math.min(
              best,
              e.bullets < g.creatureMaxBullets[e.level] ? dist(e.position, b.position) : Infinity,
            ),
          Infinity,
        );
        const score = d + Math.max(0, d - competitor) * 0.6;
        if (score < ammoScore) {
          ammo = b;
          ammoScore = score;
        }
      }
    if (ammo && ammoScore < tuning.ammoRange) {
      const d = dist(self.position, ammo.position);
      if (pursuit.id !== ammo.id) pursuit = { id: ammo.id, distance: d, stalled: 0 };
      else {
        pursuit.stalled = d < pursuit.distance - 3 ? 0 : pursuit.stalled + 1;
        pursuit.distance = d;
      }
      if (pursuit.stalled > 12) {
        ignored.set(ammo.id, tick + 70);
        pursuit.id = -1;
      } else return navigation(ammo.position);
    }
    if (canHeal && maxHP - self.lives >= tuning.heal) return action(Act.eat);

    if (
      target &&
      aim &&
      canShoot &&
      self.energy > g.shotEnergyCost + (maxHP - self.lives > 30 ? 60 : 0)
    ) {
      if (self.bullets >= maxAmmo && self.energy > maxEnergy * tuning.aggression) {
        if (aim.distance <= tuning.range && shotClear)
          return aimed ? action(Act.shoot) : turn(self, aim.direction);
        return navigation(target.position);
      }
    }
    // Recover while watching a fight; advance when resources are available.
    if (target && aim && self.energy > 25) {
      const wanted = self.level > 0 && self.energy > 110 ? 100 : 340;
      if (aim.distance > wanted + 35) return navigation(target.position);
      if (self.bullets === 0 && target.bullets > 0 && aim.distance < 160) {
        const a = angle(target.position, self.position);
        return navigation({
          x: self.position.x + Math.cos(a) * 150,
          y: self.position.y + Math.sin(a) * 150,
        });
      }
      return turn(self, aim.direction);
    }
    return action(Act.none);
  },
};
export default astra;
