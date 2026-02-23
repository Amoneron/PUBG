/**
 * Programmers BattleGround -- Canvas Renderer
 *
 * Draws the full game state onto a 2D canvas. Uses a custom canvas approach
 * (not Matter.Render) for full control over layering, scaling, and effects.
 *
 * The arena (1024x768 logical pixels) is scaled to fit the container element
 * while preserving aspect ratio. The area outside the arena bounds is darkened.
 *
 * Drawing order (back to front):
 *   1. Tiled ground texture
 *   2. Obstacles (sprites or fallback shapes)
 *   3. Bullets (colored circles by shell type)
 *   4. Creature auras (rotating spell overlays)
 *   5. Creature sprites (with direction indicator)
 *   6. HP / energy / bullets indicator bars
 *   7. Chat message speech bubbles
 *   8. Arena border
 */

import type {
  InternalCreature,
  InternalBullet,
  InternalObstacle,
  Aura,
} from '../types';
import type { GameSnapshot } from '../engine/Engine';
import type { GameConfig } from '../config';

// ---------------------------------------------------------------------------
// Bullet color palette — indexed by Shell enum value
// ---------------------------------------------------------------------------

const BULLET_COLORS: { fill: string; stroke: string }[] = [
  { fill: '#FFF000', stroke: '#BEB320' },   // Shell.steel   = 0
  { fill: '#42FF00', stroke: '#299E00' },   // Shell.poisoned = 1
  { fill: '#FF581E', stroke: '#C93400' },   // Shell.rubber   = 2
  { fill: '#00AEFF', stroke: '#0093A0' },   // Shell.ice      = 3
];

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private arenaWidth: number;
  private arenaHeight: number;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private groundImage: HTMLImageElement | null = null;
  private spriteCache: Map<string, HTMLImageElement> = new Map();
  private config: GameConfig;

  constructor(container: HTMLElement, config: GameConfig) {
    this.config = config;
    this.arenaWidth = config.arena.width;
    this.arenaHeight = config.arena.height;

    // Create canvas and attach to container
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    // Load ground texture
    this.groundImage = new Image();
    this.groundImage.src = './img/ground/soil.png';

    // Initial sizing and listen for resizes
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // -------------------------------------------------------------------------
  // Scaling
  // -------------------------------------------------------------------------

  /**
   * Recalculate canvas size and arena-to-canvas scale factor.
   * The arena is centered within the container with letterboxing.
   */
  private resize(): void {
    const parent = this.canvas.parentElement!;
    const cw = parent.clientWidth;
    const ch = parent.clientHeight;
    this.canvas.width = cw;
    this.canvas.height = ch;

    const scaleX = cw / this.arenaWidth;
    const scaleY = ch / this.arenaHeight;
    this.scale = Math.min(scaleX, scaleY);
    this.offsetX = (cw - this.arenaWidth * this.scale) / 2;
    this.offsetY = (ch - this.arenaHeight * this.scale) / 2;
  }

  // -------------------------------------------------------------------------
  // Sprite cache
  // -------------------------------------------------------------------------

  /**
   * Load (or retrieve from cache) an HTMLImageElement for the given URL.
   * Images are loaded lazily; on the first frame the image may not be ready
   * yet, in which case a fallback shape is drawn instead.
   */
  private loadSprite(src: string): HTMLImageElement {
    let img = this.spriteCache.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      this.spriteCache.set(src, img);
    }
    return img;
  }

  // -------------------------------------------------------------------------
  // Main render entry point
  // -------------------------------------------------------------------------

  /**
   * Draw a single frame from the given snapshot.
   * Called once per requestAnimationFrame by the game loop.
   */
  render(snapshot: GameSnapshot): void {
    const ctx = this.ctx;
    const s = this.scale;
    const ox = this.offsetX;
    const oy = this.offsetY;

    // Clear entire canvas to dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Enter arena coordinate space
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);

    // 1. Tiled ground
    this.drawGround(ctx);

    // 2. Obstacles
    for (const obs of snapshot.obstacles) {
      this.drawObstacle(ctx, obs);
    }

    // 3. Bullets
    for (const blt of snapshot.bullets) {
      this.drawBullet(ctx, blt);
    }

    // 4-5. Creatures (aura + sprite + direction)
    for (const creature of snapshot.creatures) {
      this.drawCreature(ctx, creature);
    }

    // 6-7. HUD overlay: indicators and messages (drawn on top of everything)
    for (const creature of snapshot.creatures) {
      this.drawIndicators(ctx, creature);
      this.drawMessage(ctx, creature);
    }

    ctx.restore();

    // 8. Arena border (in screen space)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, this.arenaWidth * s, this.arenaHeight * s);
  }

  // -------------------------------------------------------------------------
  // Ground
  // -------------------------------------------------------------------------

  private drawGround(ctx: CanvasRenderingContext2D): void {
    if (this.groundImage && this.groundImage.complete && this.groundImage.naturalWidth > 0) {
      const pattern = ctx.createPattern(this.groundImage, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, this.arenaWidth, this.arenaHeight);
        return;
      }
    }
    // Fallback solid colour
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, this.arenaWidth, this.arenaHeight);
  }

  // -------------------------------------------------------------------------
  // Obstacles
  // -------------------------------------------------------------------------

  private drawObstacle(ctx: CanvasRenderingContext2D, obs: InternalObstacle): void {
    const body = obs.body;
    const pos = body.position;
    const angle = body.angle;
    const render = (body as any).render;
    const tex: string | undefined = render?.sprite?.texture;

    if (tex) {
      const img = this.loadSprite(tex);
      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);
        // Draw at natural image dimensions (matching original Matter.js Render).
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
        return;
      }
    }

    // Fallback: grey rectangle using body bounds
    const bw = body.bounds.max.x - body.bounds.min.x;
    const bh = body.bounds.max.y - body.bounds.min.y;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.fillStyle = '#666';
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Bullets
  // -------------------------------------------------------------------------

  private drawBullet(ctx: CanvasRenderingContext2D, blt: InternalBullet): void {
    const pos = blt.body.position;
    const colors = BULLET_COLORS[blt.shell] || BULLET_COLORS[0];

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = colors.fill;
    ctx.fill();
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // -------------------------------------------------------------------------
  // Creatures
  // -------------------------------------------------------------------------

  private drawCreature(ctx: CanvasRenderingContext2D, creature: InternalCreature): void {
    const body = creature.body;
    const pos = body.position;
    const angle = body.angle;
    const render = (body as any).render || {};
    const opacity: number = render.opacity ?? 1;

    ctx.save();
    ctx.globalAlpha = opacity;

    // -- Aura (spell visual) --
    const aura = render.aura as Aura | undefined;
    if (aura && aura.counter > 0) {
      const auraImg = this.loadSprite(aura.texture);
      if (auraImg.complete && auraImg.naturalWidth > 0) {
        const auraSize = 80;
        aura.angle += aura.spin;

        // Fade in at start, fade out at end
        let alpha = 1;
        const animFrames = 30;
        const elapsed = aura.duration - aura.counter;
        if (elapsed < animFrames) alpha = elapsed / animFrames;
        if (aura.counter < animFrames) alpha = Math.min(alpha, aura.counter / animFrames);

        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.translate(pos.x, pos.y);
        ctx.rotate(aura.angle);
        ctx.drawImage(auraImg, -auraSize / 2, -auraSize / 2, auraSize, auraSize);
        ctx.restore();
      }
      aura.counter--;
    }

    // -- Creature sprite --
    const tex: string | undefined = render.sprite?.texture;
    if (tex) {
      const img = this.loadSprite(tex);
      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);
        // Draw at natural image dimensions (matching original Matter.js Render behaviour).
        // Sprites are not square — forcing 60×60 distorts non-square images.
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else {
        // Fallback: coloured circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 30, 0, Math.PI * 2);
        ctx.fillStyle = creature.brain.color;
        ctx.fill();
      }
    } else {
      // No texture at all: coloured circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 30, 0, Math.PI * 2);
      ctx.fillStyle = creature.brain.color;
      ctx.fill();
    }

    // -- Direction indicator line --
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + Math.cos(angle) * 35, pos.y + Math.sin(angle) * 35);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Status indicators (HP / energy / bullets bars)
  // Ported from battleground.js lines 1154-1220
  // -------------------------------------------------------------------------

  private drawIndicators(ctx: CanvasRenderingContext2D, creature: InternalCreature): void {
    const pos = creature.body.position;
    const barWidth = 50;
    const barHalfW = barWidth / 2;
    const barHeight = 4;
    const barGap = 1;
    const verticalOffset = 60;
    const color = creature.brain.color;

    // Total height of the 3-bar stack
    const stackH = barHeight * 3 + barGap * 2;
    const squareSize = stackH + barGap * 4;

    let x = pos.x - barHalfW + squareSize / 2;
    let y = pos.y - verticalOffset;

    // Colour swatch square (left of the bars)
    ctx.fillStyle = color;
    ctx.strokeStyle = this.shadeColor(color, -20);
    ctx.lineWidth = 1;
    ctx.fillRect(x - squareSize, y, stackH, stackH);
    ctx.strokeRect(x - squareSize, y, stackH, stackH);

    // Determine bar colours based on creature status
    let livesFill  = '#800000';
    let livesBar   = '#D25253';
    let energyFill = '#008002';
    let energyBar  = '#5CDC5D';
    let bulletFill = '#2A7BB9';
    let bulletBar  = '#2ABFFD';

    if (creature.poisonCounter > 0) {
      livesFill = energyFill = bulletFill = '#008002';
      livesBar  = energyBar  = bulletBar  = '#5CDC5D';
    } else if (creature.freezeCounter > 0) {
      livesFill = energyFill = bulletFill = '#2A7BB9';
      livesBar  = energyBar  = bulletBar  = '#2ABFFD';
    } else if (creature.invulnerable) {
      livesFill = energyFill = bulletFill = '#535353';
      livesBar  = energyBar  = bulletBar  = '#C0C0C0';
    }

    const maxLives   = this.config.creatureMaxLives[creature.level];
    const maxEnergy  = this.config.creatureMaxEnergy[creature.level];
    const maxBullets = this.config.creatureMaxBullets[creature.level];

    // Lives bar
    ctx.fillStyle = livesFill;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = livesBar;
    ctx.fillRect(x, y, (creature.lives / maxLives) * barWidth, barHeight);

    // Energy bar
    y += barHeight + barGap;
    ctx.fillStyle = energyFill;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = energyBar;
    ctx.fillRect(x, y, (creature.energy / maxEnergy) * barWidth, barHeight);

    // Bullets bar
    y += barHeight + barGap;
    ctx.fillStyle = bulletFill;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = bulletBar;
    ctx.fillRect(x, y, (creature.bullets / maxBullets) * barWidth, barHeight);
  }

  // -------------------------------------------------------------------------
  // Chat messages / speech bubbles
  // Ported from battleground.js lines 1222-1301
  // -------------------------------------------------------------------------

  private drawMessage(ctx: CanvasRenderingContext2D, creature: InternalCreature): void {
    if (!creature.message) return;

    // Auto-hide after messageShowTime
    if (Date.now() - creature.shouted > this.config.messageShowTime) {
      creature.message = null;
      return;
    }

    const pos = creature.body.position;
    const verticalOffset = 60;
    const lineLimit = this.config.messageLineLimit;
    const msg = creature.message;

    // -- Word-wrap into at most 2 lines --
    const lines: string[] = [];

    if (msg.length <= lineLimit) {
      if (msg.includes('\n')) {
        const parts = msg.split('\n');
        lines.push(parts[0]);
        if (parts[1]) lines.push(parts[1]);
      } else {
        lines.push(msg);
      }
    } else {
      const words = msg.split(' ');
      let line = '';
      let wordCount = 0;

      for (let w = 0; w < words.length; w++) {
        const candidate = line + words[w] + ' ';
        wordCount++;

        if (candidate.includes('\n')) {
          const nl = candidate.indexOf('\n');
          lines.push(candidate.substring(0, nl).trim());
          line = candidate.substring(nl + 1);
          wordCount = 0;
        } else {
          if (candidate.length >= lineLimit) {
            lines.push(wordCount === 1 ? candidate.substring(0, lineLimit) : line.trim());
            line = wordCount === 1 ? '' : words[w] + ' ';
            wordCount = 0;
          } else {
            line = candidate;
          }
        }
      }
      if (line.length) lines.push(line.trim());
    }

    const lineCount = Math.min(lines.length, 2);
    const fontSize = 14;
    const lineSpacing = 4;
    const msgHeight = fontSize * lineCount + lineSpacing * (lineCount - 1);
    let x = pos.x + verticalOffset * 0.7;
    let y = pos.y - (lineCount === 1 ? 0 : msgHeight / 2) + 10;
    const margin = 6;

    // Measure widest line
    ctx.font = `100 ${fontSize}px Verdana`;
    let maxWidth = 0;
    for (let i = 0; i < lineCount; i++) {
      const lw = ctx.measureText(lines[i]).width;
      if (lw > maxWidth) maxWidth = lw;
    }

    const rectWidth = maxWidth + margin * 2;

    // Decide whether bubble goes to the left or right of the creature
    const leftX = pos.x - (rectWidth + (x - pos.x));
    if (leftX < 0 && creature.cryToTheLeft) creature.cryToTheLeft = false;
    if (x + rectWidth > this.arenaWidth && !creature.cryToTheLeft) creature.cryToTheLeft = true;
    if (creature.cryToTheLeft) x = leftX;

    const corners = creature.cryToTheLeft
      ? { tl: 10, tr: 0, br: 10, bl: 10 }
      : { tl: 0, tr: 10, br: 10, bl: 10 };

    // Draw bubble background
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    this.roundRect(
      ctx,
      x - margin,
      y - margin - fontSize / 2,
      rectWidth,
      msgHeight + margin * 2,
      corners,
      true,
      true,
    );

    // Draw text
    ctx.fillStyle = '#444444';
    ctx.font = `100 ${fontSize}px Verdana`;
    ctx.textBaseline = 'middle';
    for (let i = 0; i < lineCount; i++) {
      ctx.fillText(lines[i], x, y);
      y += fontSize + lineSpacing;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Draw a rectangle with individually rounded corners.
   * Ported from the original CanvasRenderingContext2D.prototype.roundRect
   * polyfill in battleground.js.
   */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: { tl: number; tr: number; br: number; bl: number },
    fill: boolean,
    stroke: boolean,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  /**
   * Darken or lighten a CSS colour string by a percentage.
   * Negative `percent` darkens, positive lightens.
   */
  private shadeColor(color: string, percent: number): string {
    try {
      // Use an off-screen 1x1 canvas to parse any CSS colour into RGBA
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = tmpCanvas.height = 1;
      const tmpCtx = tmpCanvas.getContext('2d')!;
      tmpCtx.fillStyle = color;
      tmpCtx.fillRect(0, 0, 1, 1);
      const [r, g, b] = tmpCtx.getImageData(0, 0, 1, 1).data;

      const target = percent < 0 ? 0 : 255;
      const factor = Math.abs(percent) / 100;
      const nr = Math.round((target - r) * factor) + r;
      const ng = Math.round((target - g) * factor) + g;
      const nb = Math.round((target - b) * factor) + b;
      return `rgb(${nr},${ng},${nb})`;
    } catch {
      return color;
    }
  }

  // -------------------------------------------------------------------------
  // Public accessors
  // -------------------------------------------------------------------------

  /** Return the underlying canvas element (e.g. for external event listeners). */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /** Force a resize recalculation (useful after programmatic layout changes). */
  forceResize(): void {
    this.resize();
  }

  /** Destroy the renderer: remove the canvas and stop listening for resizes. */
  destroy(): void {
    window.removeEventListener('resize', this.resize);
    this.canvas.remove();
  }
}
