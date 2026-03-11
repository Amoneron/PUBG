import { defaultConfig } from './config';
import { installGlobals, installRayBetween } from './globals';
import { GameEngine } from './engine/Engine';
import { FileIQStorage } from './engine/IQSystem';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const durationSec = parseInt(args[0] || '180', 10);
  const gameMinutesPerRound = parseInt(args[1] || '60', 10);
  const ticksPerSecond = 60;
  const ticksPerRound = gameMinutesPerRound * 60 * ticksPerSecond;

  console.log(`Starting tournament: ${durationSec}s real time, ${gameMinutesPerRound} game-min per round...`);

  // Install globals once
  installGlobals(defaultConfig, defaultConfig.arena);

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const iqPath = path.join(dataDir, 'iq.json');
  const leaderboardPath = path.join(dataDir, 'leaderboard.json');

  // Accumulators
  const totals: Record<string, { author: string; iqSum: number; kills: number; deaths: number }> = {};
  let totalTicks = 0;
  let rounds = 0;

  const startTime = Date.now();
  const endTime = startTime + durationSec * 1000;

  while (Date.now() < endTime) {
    rounds++;
    const { allBrains } = await import('./brains/index');
    const iqStorage = new FileIQStorage();
    const engine = new GameEngine(defaultConfig, allBrains, { iqStorage });
    installRayBetween(engine.getMatterEngine());

    for (let i = 0; i < ticksPerRound; i++) {
      engine.tick();
    }
    totalTicks += ticksPerRound;

    // Collect stats from this round
    for (const b of engine.getBrains()) {
      if (!totals[b.name]) {
        totals[b.name] = { author: b.author, iqSum: 0, kills: 0, deaths: 0 };
      }
      totals[b.name].iqSum += b.iq;
      totals[b.name].kills += b.kills;
      totals[b.name].deaths += b.deaths;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  Round ${rounds} done (${elapsed}s elapsed)`);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nTournament complete: ${rounds} rounds, ${totalTicks} ticks in ${elapsed}s.`);

  // Build leaderboard — average IQ, total kills/deaths
  const standings = Object.entries(totals)
    .map(([name, t]) => ({
      name,
      author: t.author,
      iq: Math.round(t.iqSum / rounds * 10) / 10,
      kills: t.kills,
      deaths: t.deaths,
    }))
    .sort((a, b) => b.iq - a.iq);

  const leaderboard = {
    lastUpdated: new Date().toISOString(),
    totalTicks,
    rounds,
    gameMinutesPerRound,
    durationSeconds: elapsed,
    standings,
  };

  // Write results
  fs.writeFileSync(leaderboardPath, JSON.stringify(leaderboard, null, 2));
  const iqData: Record<string, number> = {};
  for (const s of standings) iqData[s.name] = s.iq;
  fs.writeFileSync(iqPath, JSON.stringify(iqData, null, 2));
  console.log(`Leaderboard saved to ${leaderboardPath}`);
  console.log('\nResults:');
  standings.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} (${s.author}) - avgIQ: ${s.iq}, K: ${s.kills}, D: ${s.deaths}`);
  });
}

main().catch(console.error);
