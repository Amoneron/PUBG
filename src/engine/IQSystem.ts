import type { InternalBrain } from '../types';

export interface IQStorage {
  load(brainId: string): number | null;
  save(brainId: string, iq: number): void;
}

export class LocalStorageIQStorage implements IQStorage {
  load(brainId: string): number | null {
    if (typeof localStorage === 'undefined') return null;
    const val = localStorage.getItem(brainId);
    return val ? parseInt(val, 10) : null;
  }
  save(brainId: string, iq: number): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(brainId, String(iq));
  }
}

export class FileIQStorage implements IQStorage {
  private data: Map<string, number> = new Map();

  load(brainId: string): number | null {
    return this.data.get(brainId) ?? null;
  }
  save(brainId: string, iq: number): void {
    this.data.set(brainId, iq);
  }
  getAll(): Record<string, number> {
    const result: Record<string, number> = {};
    this.data.forEach((v, k) => { result[k] = v; });
    return result;
  }
}

export class IQSystem {
  private storage: IQStorage;

  constructor(storage: IQStorage) {
    this.storage = storage;
  }

  loadIQ(brainId: string): number {
    return this.storage.load(brainId) ?? 10;
  }

  calculateIQForVictimAndKiller(victim: InternalBrain | null, killer: InternalBrain | null): void {
    const safeDecrease = (brain: InternalBrain, value: number) => {
      brain.iq -= value;
      if (brain.iq < 0) brain.iq = 0;
    };

    const save = () => {
      if (victim) this.storage.save(victim.id, victim.iq);
      if (killer) this.storage.save(killer.id, killer.iq);
    };

    if (victim == null) return;

    // Suicide (no killer)
    if (killer == null) {
      safeDecrease(victim, 3);
      save();
      return;
    }

    const killerIQ = killer.iq;
    const victimIQ = victim.iq;

    if (killerIQ >= victimIQ) {
      if (killerIQ - victimIQ > 10) {
        // No IQ change when much stronger kills weaker
      } else {
        killer.iq++;
        safeDecrease(victim, 1);
      }
    } else {
      if (victimIQ - killerIQ > 10) {
        const diff = victimIQ - killerIQ;
        safeDecrease(victim, Math.round(diff / 5));
        killer.iq += Math.round(diff / 3);
      } else {
        killer.iq++;
        safeDecrease(victim, 1);
      }
    }
    save();
  }
}
