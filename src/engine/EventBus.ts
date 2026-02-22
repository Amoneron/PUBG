/**
 * Programmers BattleGround — EventBus
 *
 * Simple typed event bus for internal engine events.
 * Also collects GameEvents that are passed to bots each tick.
 */

import type { GameEvent } from '../types';

export interface EngineEvent {
  type: string;
  [key: string]: any;
}

export class EventBus {
  private handlers: Map<string, Array<(event: EngineEvent) => void>> = new Map();

  /** Events that get passed to bots via thinkAboutIt() each tick */
  private botEvents: GameEvent[] = [];

  /**
   * Register a handler for an engine event type.
   */
  on(type: string, handler: (event: EngineEvent) => void): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  /**
   * Emit an engine event — all registered handlers for that type are called.
   */
  emit(event: EngineEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach(h => h(event));
    }
  }

  /**
   * Push a GameEvent that will be delivered to bots this tick.
   */
  pushBotEvent(event: GameEvent): void {
    this.botEvents.push(event);
  }

  /**
   * Return a shallow copy of all bot events accumulated this tick.
   */
  getBotEvents(): GameEvent[] {
    return this.botEvents.slice(0);
  }

  /**
   * Clear bot events at the end of each tick.
   */
  clearTick(): void {
    this.botEvents = [];
  }
}
