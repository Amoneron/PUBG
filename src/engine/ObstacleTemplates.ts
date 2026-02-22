/**
 * Programmers BattleGround — Obstacle Templates
 *
 * Declarative array of obstacle/dynamite templates replacing the
 * switch-case in battleground.js (lines 414-436).
 *
 * Each template describes the physical properties and sprite info
 * for a type of obstacle or dynamite.
 */

export interface ObstacleTemplate {
  /** Shape/sub-type index (used for sprite selection and identification) */
  shape: number;
  /** Human-readable name */
  name: string;
  /** Width in pixels (for rectangular bodies) */
  w?: number;
  /** Height in pixels (for rectangular bodies) */
  h?: number;
  /** Radius in pixels (for circular bodies; if set, w/h are ignored) */
  r?: number;
  /** Matter.js body density */
  density: number;
  /** Maximum hit points (condition starts at this value) */
  firmness: number;
  /** Number of sprite variants available for this shape */
  sprites: number;
  /** Air friction override (if not set, Matter.js default is used) */
  frictionAir?: number;
}

// ---------------------------------------------------------------------------
// Obstacle templates (from battleground.js lines 414-431)
// ---------------------------------------------------------------------------

export const obstacleTemplates: ObstacleTemplate[] = [
  { shape: 0,  name: 'Wooden box',     w: 60,  h: 60,  density: 1.0,   firmness: 50,  sprites: 3 },
  { shape: 1,  name: 'Wooden block',   w: 88,  h: 60,  density: 1.0,   firmness: 70,  sprites: 3 },
  { shape: 2,  name: 'Bottle',         w: 11,  h: 40,  density: 0.5,   firmness: 15,  sprites: 2, frictionAir: 0.02 },
  { shape: 3,  name: 'Carton',         w: 50,  h: 50,  density: 0.2,   firmness: 15,  sprites: 2 },
  { shape: 4,  name: 'Steel box',      w: 55,  h: 55,  density: 5.5,   firmness: 90,  sprites: 3, frictionAir: 0.1 },
  { shape: 5,  name: 'Log',            w: 100, h: 31,  density: 1.0,   firmness: 60,  sprites: 3 },
  { shape: 6,  name: 'Concrete block', w: 88,  h: 60,  density: 20.0,  firmness: 110, sprites: 3, frictionAir: 0.1 },
  { shape: 7,  name: 'Large gear',     r: 22,          density: 2.0,   firmness: 90,  sprites: 3 },
  { shape: 8,  name: 'Small gear',     r: 9,           density: 2.0,   firmness: 80,  sprites: 2 },
  { shape: 9,  name: 'Lifebuoy',       r: 25,          density: 0.8,   firmness: 30,  sprites: 3, frictionAir: 0.05 },
  { shape: 10, name: 'Large stone',    r: 40,          density: 20.0,  firmness: 160, sprites: 3, frictionAir: 0.1 },
  { shape: 11, name: 'Middle stone',   r: 27,          density: 20.0,  firmness: 150, sprites: 3, frictionAir: 0.1 },
  { shape: 12, name: 'Small stone',    r: 15,          density: 20.0,  firmness: 140, sprites: 3, frictionAir: 0.1 },
  { shape: 13, name: 'Tambourine',     r: 15,          density: 1.0,   firmness: 100, sprites: 3 },
  { shape: 14, name: 'Large tire',     r: 34,          density: 0.7,   firmness: 40,  sprites: 3, frictionAir: 0.05 },
  { shape: 15, name: 'Small tire',     r: 20,          density: 0.7,   firmness: 30,  sprites: 3, frictionAir: 0.05 },
];

// ---------------------------------------------------------------------------
// Dynamite templates (from battleground.js lines 433-436)
// ---------------------------------------------------------------------------

export const dynamiteTemplates: ObstacleTemplate[] = [
  { shape: 0, name: 'Large dynamite', w: 55, h: 55, density: 5.5, firmness: 5, sprites: 1, frictionAir: 0.1 },
  { shape: 1, name: 'Small dynamite', w: 35, h: 35, density: 5.5, firmness: 5, sprites: 1, frictionAir: 0.1 },
];
