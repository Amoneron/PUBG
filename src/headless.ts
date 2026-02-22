import { defaultConfig } from './config';
import { installGlobals, installRayBetween } from './globals';
import { GameEngine } from './engine/Engine';
import { FileIQStorage } from './engine/IQSystem';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const minutes = parseInt(args[0] || '60', 10);
  const ticksPerSecond = 60;
  const totalTicks = minutes * 60 * ticksPerSecond;

  console.log(`Starting headless battle for ${minutes} minutes (${totalTicks} ticks)...`);

  // Install globals before importing brains
  installGlobals(defaultConfig, defaultConfig.arena);

  const { allBrains } = await import('./brains/index');

  const iqStorage = new FileIQStorage();
  const engine = new GameEngine(defaultConfig, allBrains, { iqStorage });
  installRayBetween(engine.getMatterEngine());

  const startTime = Date.now();

  for (let i = 0; i < totalTicks; i++) {
    engine.tick();
    if (i > 0 && i % (ticksPerSecond * 60) === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`  Tick ${i}/${totalTicks} (${Math.round(i / totalTicks * 100)}%) - ${elapsed}s elapsed`);
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`Battle complete in ${elapsed}s.`);

  // Build leaderboard
  const brains = engine.getBrains();
  const standings = brains
    .map(b => ({
      name: b.name,
      author: b.author,
      iq: b.iq,
      kills: b.kills,
      deaths: b.deaths,
    }))
    .sort((a, b) => b.iq - a.iq);

  const leaderboard = {
    lastUpdated: new Date().toISOString(),
    totalTicks,
    durationMinutes: minutes,
    standings,
  };

  // Write leaderboard
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const outPath = path.join(dataDir, 'leaderboard.json');
  fs.writeFileSync(outPath, JSON.stringify(leaderboard, null, 2));
  console.log(`Leaderboard saved to ${outPath}`);
  console.log('\nResults:');
  standings.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} (${s.author}) - IQ: ${s.iq}, K: ${s.kills}, D: ${s.deaths}`);
  });
}

main().catch(console.error);
