import './styles/style.css';
import { defaultConfig } from './config';
import { installGlobals, installRayBetween } from './globals';
import { GameEngine } from './engine/Engine';
import { Renderer } from './renderer/Renderer';
import { Leaderboard } from './renderer/Leaderboard';
import { UI } from './renderer/UI';

async function main() {
  // Install globals BEFORE importing brains
  installGlobals(defaultConfig, defaultConfig.arena);

  // Dynamic import so globals are available at parse time for bots that use ground
  const { allBrains } = await import('./brains/index');

  const arenaContainer = document.getElementById('arena-container')!;
  const sidebar = document.getElementById('sidebar')!;
  const serverLb = document.getElementById('server-leaderboard')!;
  const liveLb = document.getElementById('live-leaderboard')!;
  const controls = document.getElementById('controls')!;

  // Create engine
  const engine = new GameEngine(defaultConfig, allBrains);
  installRayBetween(engine.getMatterEngine());

  // Create renderer
  const renderer = new Renderer(arenaContainer, defaultConfig);

  // Create leaderboard
  const leaderboard = new Leaderboard(serverLb, liveLb);

  // Create UI
  const ui = new UI(engine, controls);

  // Wire leaderboard updates
  let fullLeaderboard = false;
  let leaderboardCounter = 0;
  const fullLeaderboardInterval = 50;

  engine.onLeaderboardUpdate = () => {
    fullLeaderboard = true;
    leaderboardCounter = fullLeaderboardInterval;
    leaderboard.updateLive(engine.getBrains(), true);
  };

  // Initial leaderboard
  leaderboard.updateLive(engine.getBrains(), false);

  // Game loop
  function gameLoop() {
    if (!ui.isPaused()) {
      const ticks = ui.getSpeedMultiplier();
      for (let i = 0; i < ticks; i++) {
        const snapshot = engine.tick();

        // Leaderboard counter
        if (leaderboardCounter > 0 && --leaderboardCounter < 1) {
          leaderboardCounter = 0;
          fullLeaderboard = false;
          leaderboard.updateLive(engine.getBrains(), false);
        }
      }
    }

    // Render (always render even when paused for smooth display)
    const snapshot = {
      creatures: engine.getCreatures(),
      bullets: engine.getSpawner().bullets,
      obstacles: engine.getSpawner().obstacles,
      brains: engine.getBrains(),
      arena: defaultConfig.arena,
    };
    renderer.render(snapshot);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

main().catch(console.error);
