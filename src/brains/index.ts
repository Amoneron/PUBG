import type { Brain } from '../types';

// Import all bots (11 total: 10 strongest + Pacifist)
import opus from './opus';
import bulletbull from './bulletbull';
import dexter from './dexter';
import reptile from './reptile';
import rathorn from './rathorn';
import mindblast from './mindblast';
import pacifist from './pacifist';
import hodor from './hodor';
import helltrain from './helltrain';
import niloultet from './niloultet';
import utilizator from './utilizator';

export const allBrains: Brain[] = [
  opus, reptile, niloultet, rathorn, helltrain,
  dexter, mindblast, hodor, utilizator, bulletbull,
  pacifist,
];
