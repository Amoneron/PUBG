import type { Brain } from '../types';

// Import all bots (14 total)
import astra from './astra';
import opus from './opus';
import reptile from './reptile';
import rathorn from './rathorn';
import mindblast from './mindblast';
import pacifist from './pacifist';
import hodor from './hodor';
import helltrain from './helltrain';
import niloultet from './niloultet';
import meowstraponius from './meowstraponius';
import troll from './troll';
import mamba from './mamba';
import rat from './rat';
import aegisprime from './aegisprime';

export const allBrains: Brain[] = [
  astra, opus, reptile, niloultet, rathorn, helltrain,
  mindblast, hodor, pacifist, meowstraponius, troll,
  mamba, rat, aegisprime,
];
