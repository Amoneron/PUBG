import type { Brain } from '../types';

// Import all bots (12 total)
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
import meowstraponius from './meowstraponius';

export const allBrains: Brain[] = [
  opus, reptile, niloultet, rathorn, helltrain,
  dexter, mindblast, hodor, utilizator, bulletbull,
  pacifist, meowstraponius,
];
