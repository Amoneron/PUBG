/**
 * Programmers BattleGround — GameEvent
 *
 * Events that occurred during the current tick, delivered to bots in thinkAboutIt().
 * Matches the Event prototype in battleground.js (lines 189-192).
 */

import type { EventType } from './enums';
import type { CreatureView } from './creature';

/** A game event that happened this tick */
export interface GameEvent {
  /** What kind of event occurred */
  type: EventType;
  /** Creatures involved in the event (obfuscated views) */
  payload: CreatureView[];
}
