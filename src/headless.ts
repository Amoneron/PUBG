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

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const iqPath = path.join(dataDir, 'iq.json');
  const leaderboardPath = path.join(dataDir, 'leaderboard.json');

  // Load previous IQ data
  let initialIQ: Record<string, number> | undefined;
  if (fs.existsSync(iqPath)) {
    try {
      initialIQ = JSON.parse(fs.readFileSync(iqPath, 'utf-8'));
      console.log(`[IQ] Loaded ${Object.keys(initialIQ!).length} entries from ${iqPath}`);
    } catch {
      console.warn(`[IQ] Failed to parse ${iqPath}, starting fresh`);
    }
  }

  const iqStorage = new FileIQStorage(initialIQ);
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

  // Save IQ data to file for next run
  fs.writeFileSync(iqPath, JSON.stringify(iqStorage.getAll(), null, 2));
  console.log(`[IQ] Saved to ${iqPath}`);

  // Load previous leaderboard for accumulation
  let previousStandings: Record<string, { kills: number; deaths: number }> = {};
  let previousTotalTicks = 0;
  if (fs.existsSync(leaderboardPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(leaderboardPath, 'utf-8'));
      previousTotalTicks = prev.totalTicks || 0;
      for (const s of prev.standings || []) {
        previousStandings[s.name] = { kills: s.kills || 0, deaths: s.deaths || 0 };
      }
      console.log(`[Leaderboard] Loaded previous results (${previousTotalTicks} ticks, ${Object.keys(previousStandings).length} bots)`);
    } catch {
      console.warn('[Leaderboard] Failed to parse previous leaderboard, starting fresh');
    }
  }

  // Build leaderboard with accumulated stats
  const brains = engine.getBrains();
  const standings = brains
    .map(b => {
      const prev = previousStandings[b.name];
      return {
        name: b.name,
        author: b.author,
        iq: b.iq,
        kills: b.kills + (prev?.kills || 0),
        deaths: b.deaths + (prev?.deaths || 0),
      };
    })
    .sort((a, b) => b.iq - a.iq);

  const leaderboard = {
    lastUpdated: new Date().toISOString(),
    totalTicks: previousTotalTicks + totalTicks,
    durationMinutes: Math.round((previousTotalTicks + totalTicks) / (60 * ticksPerSecond)),
    standings,
  };

  // Write leaderboard
  fs.writeFileSync(leaderboardPath, JSON.stringify(leaderboard, null, 2));
  console.log(`Leaderboard saved to ${leaderboardPath}`);
  console.log('\nResults:');
  standings.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} (${s.author}) - IQ: ${s.iq}, K: ${s.kills}, D: ${s.deaths}`);
  });
}

main().catch(console.error);
