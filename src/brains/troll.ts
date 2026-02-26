import type { Brain } from '../types';

const g = globalThis as any;

// ---------------------------------------------------------------------------
// Internal state (persists across ticks, resets on page reload)
// ---------------------------------------------------------------------------
let currentHostId: number | null = null;
let huntTargetId: number | null = null;
let huntPrevPos: { x: number; y: number } | null = null;
let pendingShot: number | null = null;
let hostStallTicks = 0;
let hostLastPos: { x: number; y: number } | null = null;

// ---------------------------------------------------------------------------
// Threat classification — meta-gaming by enemy bot name
// ---------------------------------------------------------------------------
type ThreatLevel = 'dangerous' | 'not_dangerous' | 'doubtful';

function evaluateThreats(
  self: any,
  enemies: any[],
  arena: { width: number; height: number },
): Record<number, ThreatLevel> {
  const threats: Record<number, ThreatLevel> = {};

  let maxBullets = 0;
  let minLives = Infinity;
  for (const e of enemies) {
    if (e.bullets > maxBullets) maxBullets = e.bullets;
    if (e.lives < minLives) minLives = e.lives;
  }

  for (const e of enemies) {
    let level: ThreatLevel = 'doubtful';

    switch (e.name) {
      case 'Pacifist':
      case 'CC Opus':
        level = 'not_dangerous';
        break;

      case 'UtilizatoR':
        level = (self.bullets >= maxBullets && self.bullets > 0)
          ? 'dangerous' : 'not_dangerous';
        break;

      case 'RatHorn':
        level = (self.lives <= minLives) ? 'dangerous' : 'not_dangerous';
        break;

      case 'Hodor':
        level = self.message ? 'dangerous' : 'doubtful';
        break;

      case 'Mindblast':
      case 'Helltrain':
      case 'Reptile':
      case 'MoreGun':
        level = 'dangerous';
        break;

      case 'BULLetBULL': {
        const center = { x: arena.width / 2, y: arena.height / 2 };
        level = (g.distanceBetweenPoints(e.position, center) < 100 && e.bullets > 0)
          ? 'dangerous' : 'not_dangerous';
        break;
      }
    }

    threats[e.id] = level;
  }

  return threats;
}

// ---------------------------------------------------------------------------
// Host scoring — lower is better (closer, safer, away from walls)
// ---------------------------------------------------------------------------
function getHostScore(
  candidate: any,
  self: any,
  bullets: any[],
  enemies: any[],
  threats: Record<number, ThreatLevel>,
): number {
  const distToSelf = g.distanceBetween(self, candidate);

  // Nearest safe bullet to candidate
  let nearestBulletDist = Infinity;
  for (const b of bullets) {
    if (!b.dangerous) {
      const d = g.distanceBetweenPoints(candidate.position, b.position);
      if (d < nearestBulletDist) nearestBulletDist = d;
    }
  }
  if (nearestBulletDist === Infinity) nearestBulletDist = 1000;

  // Nearest dangerous enemy to candidate
  let nearestDangerDist = Infinity;
  for (const e of enemies) {
    if (threats[e.id] === 'dangerous') {
      const d = g.distanceBetweenPoints(candidate.position, e.position);
      if (d < nearestDangerDist) nearestDangerDist = d;
    }
  }

  const dangerPenalty = (nearestDangerDist < 350) ? 5000 : 0;

  const wallDist = Math.min(
    candidate.position.x,
    candidate.position.y,
    g.ground.width - candidate.position.x,
    g.ground.height - candidate.position.y,
  );
  const wallPenalty = (wallDist < 100) ? 2000 : 0;

  return distToSelf + dangerPenalty + wallPenalty - nearestDangerDist + (nearestBulletDist * 0.2);
}

// ---------------------------------------------------------------------------
// Bot definition
// ---------------------------------------------------------------------------
const DANGEROUS_NAMES = ['Mindblast', 'Helltrain', 'Reptile', 'MoreGun'];

const troll: Brain = {
  name: 'Troll',
  kind: g.kinds.rhino,
  author: 'gramenbos',
  description: 'Parasitic rhino. Follows weak enemies as cover, predicts shots, exploits dynamite, uses magnet to steal bullets.',

  thinkAboutIt(self, enemies, bullets, objects, _events) {
    // === Pending shot: finish aiming from last tick ===
    if (pendingShot !== null) {
      const angle = pendingShot;
      pendingShot = null;
      const aimDiff = Math.abs(g.differenceBetweenAngles(self.angle, angle));
      if (aimDiff < Math.PI / 10 && self.bullets > 0 && self.energy >= g.shotEnergyCost) {
        return { do: g.actions.shoot, params: { message: 'Bang!' } };
      }
      if (self.bullets > 0) {
        return { do: g.actions.turn, params: { angle } };
      }
    }

    const threats = evaluateThreats(self, enemies, g.ground);

    // === Dodge incoming dangerous bullets ===
    for (const bl of bullets) {
      if (!bl.dangerous) continue;
      const dist = g.distanceBetween(self, bl);
      if (dist > 180) continue;

      const bulletAngle = Math.atan2(bl.velocity.y, bl.velocity.x);
      const angleToMe = g.angleBetween(bl, self);
      const diff = Math.abs(g.differenceBetweenAngles(bulletAngle, angleToMe));

      if (diff < Math.PI / 5) {
        const dodgeAngle = bulletAngle + Math.PI / 2;
        if (dist < 90 && self.energy >= g.jumpEnergyCost) {
          return { do: g.actions.jump, params: { angle: dodgeAngle, message: 'Dodge!' } };
        }
        return { do: g.actions.move, params: { angle: dodgeAngle, message: 'Nope!' } };
      }
    }

    // === Heal if missing >= 40 HP ===
    if (
      self.lives <= g.creatureMaxLives[self.level] - 40 &&
      self.bullets > 0 &&
      self.energy >= g.eatBulletEnergyCost
    ) {
      return { do: g.actions.eat, params: { message: 'Heal' } };
    }

    // === Collect stars (for level up) and avoid dynamite ===
    let nearestStar: any = null;
    let nearestStarDist = Infinity;
    const dynamites: any[] = [];

    for (const obj of objects) {
      const dist = g.distanceBetweenPoints(self.position, obj.position);

      if (obj.type === 2 && dist < nearestStarDist) {
        nearestStarDist = dist;
        nearestStar = obj;
      }

      if (obj.type === 1) {
        dynamites.push(obj);
        if (dist < 120) {
          return {
            do: g.actions.move,
            params: { angle: g.angleBetweenPoints(obj.position, self.position) },
          };
        }
      }
    }

    if (nearestStar && self.level < 2) {
      return {
        do: g.actions.move,
        params: { angle: g.angleBetweenPoints(self.position, nearestStar.position), message: 'Star' },
      };
    }

    // === Find killable enemy (HP <= our total damage) ===
    let killTarget: any = null;
    let killTargetDist = Infinity;

    for (const e of enemies) {
      if (e.lives <= self.bullets * g.bulletDamage && g.rayBetween(self, e)) {
        const dist = g.distanceBetween(self, e);
        if (dist < killTargetDist) {
          killTargetDist = dist;
          killTarget = e;
        }
      }
    }

    if (killTarget && self.energy >= g.shotEnergyCost) {
      // Exploit dynamite near target
      const nearbyDynamite = dynamites.find(
        (d: any) => g.distanceBetweenPoints(killTarget.position, d.position) < 80,
      );
      if (nearbyDynamite && g.rayBetween(self, nearbyDynamite)) {
        if (currentHostId === killTarget.id) currentHostId = null;
        const angle = g.angleBetweenPoints(self.position, nearbyDynamite.position);
        pendingShot = angle;
        return { do: g.actions.turn, params: { angle, message: 'Boom!' } };
      }

      const isDangerous = DANGEROUS_NAMES.includes(killTarget.name);

      if (isDangerous) {
        if (killTargetDist < 150) {
          // Close range — direct shot
          const angle = g.angleBetween(self, killTarget);
          const aimDiff = Math.abs(g.differenceBetweenAngles(self.angle, angle));
          if (currentHostId === killTarget.id) currentHostId = null;
          if (aimDiff < Math.PI / 30) {
            return { do: g.actions.shoot, params: { message: 'GG!' } };
          }
          pendingShot = angle;
          return { do: g.actions.turn, params: { angle } };
        } else {
          // Long range — predict movement over two ticks
          if (huntTargetId !== killTarget.id) {
            huntTargetId = killTarget.id;
            huntPrevPos = { x: killTarget.position.x, y: killTarget.position.y };
            return { do: g.actions.turn, params: { angle: g.angleBetween(self, killTarget) } };
          } else {
            huntTargetId = null;
            const dx = killTarget.position.x - huntPrevPos!.x;
            const dy = killTarget.position.y - huntPrevPos!.y;
            const travelTime = killTargetDist / 12.0;
            const predictedX = killTarget.position.x + dx * travelTime;
            const predictedY = killTarget.position.y + dy * travelTime;
            const angle = g.angleBetweenPoints(self.position, { x: predictedX, y: predictedY });
            if (currentHostId === killTarget.id) currentHostId = null;
            pendingShot = angle;
            return { do: g.actions.turn, params: { angle, message: 'Gotcha!' } };
          }
        }
      } else {
        // Non-dangerous killable — direct shot
        const angle = g.angleBetween(self, killTarget);
        const aimDiff = Math.abs(g.differenceBetweenAngles(self.angle, angle));
        if (currentHostId === killTarget.id) currentHostId = null;
        if (aimDiff < Math.PI / 30) {
          return { do: g.actions.shoot, params: { message: 'Surprise!' } };
        }
        pendingShot = angle;
        return { do: g.actions.turn, params: { angle } };
      }
    } else {
      huntTargetId = null;
    }

    // === Full ammo — shoot nearest visible enemy in range ===
    if (!killTarget && self.bullets >= g.creatureMaxBullets[self.level] && self.energy >= g.shotEnergyCost) {
      let nearest: any = null;
      let nearestDist = Infinity;
      for (const e of enemies) {
        if (!g.rayBetween(self, e)) continue;
        const dist = g.distanceBetween(self, e);
        if (dist < nearestDist && dist < 350) {
          nearestDist = dist;
          nearest = e;
        }
      }
      if (nearest) {
        const angle = g.angleBetween(self, nearest);
        const aimDiff = Math.abs(g.differenceBetweenAngles(self.angle, angle));
        if (aimDiff < Math.PI / 30) {
          return { do: g.actions.shoot, params: { message: 'Full clip!' } };
        }
        pendingShot = angle;
        return { do: g.actions.turn, params: { angle } };
      }
    }

    // === Parasitic host strategy ===
    // Find nearest dangerous enemy
    let nearestDanger: any = null;
    let nearestDangerDist = Infinity;
    for (const e of enemies) {
      if (threats[e.id] === 'dangerous') {
        const dist = g.distanceBetween(self, e);
        if (dist < nearestDangerDist) {
          nearestDangerDist = dist;
          nearestDanger = e;
        }
      }
    }

    // Find best host (non-dangerous enemy to shadow)
    let bestCandidate: any = null;
    let bestCandidateScore = Infinity;
    let currentHostScore = Infinity;
    let currentHost: any = null;

    for (const e of enemies) {
      if (threats[e.id] === 'not_dangerous' || threats[e.id] === 'doubtful') {
        const score = getHostScore(e, self, bullets, enemies, threats);
        if (score < bestCandidateScore) {
          bestCandidateScore = score;
          bestCandidate = e;
        }
        if (currentHostId === e.id) {
          currentHostScore = score;
          currentHost = e;
        }
      }
    }

    // Switch host if no current or significantly better candidate
    if (!currentHost) {
      currentHost = bestCandidate;
      currentHostId = currentHost ? currentHost.id : null;
    } else if (bestCandidate && bestCandidate.id !== currentHost.id && bestCandidateScore < currentHostScore - 150) {
      currentHost = bestCandidate;
      currentHostId = currentHost.id;
    }

    if (currentHost) {
      // Track host movement — detect stalling
      if (hostLastPos && currentHostId === currentHost.id) {
        const moved = Math.abs(currentHost.position.x - hostLastPos.x)
                    + Math.abs(currentHost.position.y - hostLastPos.y);
        if (moved < 2) hostStallTicks++;
        else hostStallTicks = 0;
      } else {
        hostStallTicks = 0;
      }
      hostLastPos = { x: currentHost.position.x, y: currentHost.position.y };

      // Attack stalled host after 60 ticks of no movement
      if (hostStallTicks > 60 && self.bullets > 0 && self.energy >= g.shotEnergyCost) {
        const angle = g.angleBetween(self, currentHost);
        const aimDiff = Math.abs(g.differenceBetweenAngles(self.angle, angle));
        if (g.rayBetween(self, currentHost)) {
          if (aimDiff < Math.PI / 30) {
            if (currentHost.lives <= self.bullets * g.bulletDamage) {
              currentHostId = null;
              hostStallTicks = 0;
            }
            return { do: g.actions.shoot, params: { message: 'Wake up!' } };
          }
          pendingShot = angle;
          return { do: g.actions.turn, params: { angle } };
        }
      }

      // Use magnet spell to pull bullets near host
      if (self.bullets < g.creatureMaxBullets[self.level] && self.energy > 50) {
        let nearestBulletToHost = Infinity;
        let distToThatBullet = Infinity;
        for (const b of bullets) {
          if (!b.dangerous) {
            const d = g.distanceBetweenPoints(currentHost.position, b.position);
            if (d < nearestBulletToHost) {
              nearestBulletToHost = d;
              distToThatBullet = g.distanceBetweenPoints(self.position, b.position);
            }
          }
        }
        if (nearestBulletToHost < 100 && distToThatBullet < 250) {
          return { do: g.actions.spell, params: { message: 'Mine!' } };
        }
      }

      // Position between host and danger
      if (nearestDanger) {
        const awayAngle = Math.atan2(
          currentHost.position.y - nearestDanger.position.y,
          currentHost.position.x - nearestDanger.position.x,
        );
        const targetX = Math.max(50, Math.min(g.ground.width - 50, currentHost.position.x + 80 * Math.cos(awayAngle)));
        const targetY = Math.max(50, Math.min(g.ground.height - 50, currentHost.position.y + 80 * Math.sin(awayAngle)));
        return { do: g.actions.move, params: { angle: g.angleBetweenPoints(self.position, { x: targetX, y: targetY }) } };
      }

      // Follow host at comfortable distance
      if (g.distanceBetween(self, currentHost) < 100) {
        return { do: g.actions.none };
      }
      return { do: g.actions.move, params: { angle: g.angleBetween(self, currentHost) } };
    }

    // === Fallback: collect nearest safe bullet ===
    let nearestSafeBullet: any = null;
    let nearestSafeBulletDist = Infinity;
    for (const b of bullets) {
      if (!b.dangerous) {
        const dist = g.distanceBetweenPoints(self.position, b.position);
        if (dist < nearestSafeBulletDist) {
          nearestSafeBulletDist = dist;
          nearestSafeBullet = b;
        }
      }
    }
    if (nearestSafeBullet && self.bullets < g.creatureMaxBullets[self.level]) {
      return { do: g.actions.move, params: { angle: g.angleBetweenPoints(self.position, nearestSafeBullet.position) } };
    }

    return { do: g.actions.none };
  },
};

export default troll;
