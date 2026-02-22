/**
 * Programmers BattleGround -- UI Controls
 *
 * Provides in-browser controls for the game:
 *
 *   - **Creatures +/-** -- adjust the number of simultaneously alive creatures
 *     on the arena (clamped to 3-8 by the engine).
 *   - **Pause / Resume** -- freeze the game loop.
 *   - **Speed** -- cycle through 1x / 2x / 4x simulation speed.
 *   - **Restart** -- reload the page to start a fresh session.
 *
 * The UI is rendered as plain HTML inside the provided container element.
 * The game loop queries `isPaused()` and `getSpeedMultiplier()` each frame.
 */

import type { GameEngine } from '../engine/Engine';

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export class UI {
  private engine: GameEngine;
  private container: HTMLElement;
  private paused = false;
  private speedMultiplier = 1;

  // Cached DOM references for fast updates
  private countEl: HTMLElement | null = null;
  private pauseBtn: HTMLElement | null = null;
  private speedBtn: HTMLElement | null = null;

  constructor(engine: GameEngine, container: HTMLElement) {
    this.engine = engine;
    this.container = container;
    this.render();
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  private render(): void {
    this.container.innerHTML = `
      <div class="ui-controls">
        <div class="control-group">
          <label>Creatures:</label>
          <button class="btn" id="btn-minus" title="Decrease creature count">-</button>
          <span id="creature-count">${this.engine.getMaxCreaturesCount()}</span>
          <button class="btn" id="btn-plus" title="Increase creature count">+</button>
        </div>
        <div class="control-group">
          <button class="btn" id="btn-pause" title="Pause / Resume">Pause</button>
          <button class="btn" id="btn-speed" title="Simulation speed">1x</button>
          <button class="btn" id="btn-restart" title="Restart simulation">Restart</button>
        </div>
      </div>
    `;

    // Cache references
    this.countEl = this.container.querySelector('#creature-count');
    this.pauseBtn = this.container.querySelector('#btn-pause');
    this.speedBtn = this.container.querySelector('#btn-speed');

    // -- Event listeners --

    this.container.querySelector('#btn-minus')?.addEventListener('click', () => {
      this.engine.changeMaxCreaturesBy(-1);
      this.updateCount();
    });

    this.container.querySelector('#btn-plus')?.addEventListener('click', () => {
      this.engine.changeMaxCreaturesBy(1);
      this.updateCount();
    });

    this.container.querySelector('#btn-pause')?.addEventListener('click', () => {
      this.paused = !this.paused;
      if (this.pauseBtn) {
        this.pauseBtn.textContent = this.paused ? 'Resume' : 'Pause';
      }
    });

    this.container.querySelector('#btn-speed')?.addEventListener('click', () => {
      this.speedMultiplier = this.speedMultiplier >= 4 ? 1 : this.speedMultiplier * 2;
      if (this.speedBtn) {
        this.speedBtn.textContent = `${this.speedMultiplier}x`;
      }
    });

    this.container.querySelector('#btn-restart')?.addEventListener('click', () => {
      window.location.reload();
    });
  }

  // -------------------------------------------------------------------------
  // Public API -- queried by the game loop
  // -------------------------------------------------------------------------

  /** Whether the simulation is currently paused. */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Current speed multiplier (1, 2, or 4).
   * The game loop should call `engine.tick()` this many times per frame.
   */
  getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  /** Programmatically set the pause state. */
  setPaused(value: boolean): void {
    this.paused = value;
    if (this.pauseBtn) {
      this.pauseBtn.textContent = this.paused ? 'Resume' : 'Pause';
    }
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /** Sync the displayed creature count with the engine's value. */
  private updateCount(): void {
    if (this.countEl) {
      this.countEl.textContent = String(this.engine.getMaxCreaturesCount());
    }
  }
}
