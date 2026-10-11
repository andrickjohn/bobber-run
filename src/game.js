// game.js
// The rules of the game: which state we're in, how many lives are left,
// the invincibility after a respawn, the score and timer, and checking if the
// bobber hit something.
//
// Game states:
//   'title'    – on the title screen (the lake is just scenery)
//   'playing'  – racing down the lake
//   'paused'   – everything frozen
//   'won'      – crossed the finish line
//   'gameover' – ran out of lives

import { GAME, SCORING } from './config.js';

export function createGame() {
  const game = {
    state: 'title',
    lives: GAME.lives,
    maxLives: GAME.lives,
    invincibleTimer: 0, // counts down; while above 0 the bobber can't be hurt
    respawnTimer: 0,    // counts down after a hit; when it reaches 0 the bobber respawns
    time: 0,            // race timer in seconds
    timerRunning: false, // starts when the bobber leaves the dock
    // Points so far, kept separately so we can show a breakdown at the end.
    points: { coins: 0, goldenLures: 0, checkpoints: 0, penalties: 0 },
    coinCount: 0,
    goldenCount: 0,

    // Start a fresh run.
    reset() {
      game.state = 'playing';
      game.lives = GAME.lives;
      game.maxLives = GAME.lives;
      game.invincibleTimer = 0;
      game.respawnTimer = 0;
      game.time = 0;
      game.timerRunning = false;
      game.points = { coins: 0, goldenLures: 0, checkpoints: 0, penalties: 0 };
      game.coinCount = 0;
      game.goldenCount = 0;
    },

    // ----- Scoring -----
    // Each add... returns how many points were added (so the HUD can show "+10").
    addCoin() {
      game.coinCount++;
      game.points.coins += SCORING.coin;
      return SCORING.coin;
    },
    addGoldenLure() {
      game.goldenCount++;
      game.points.goldenLures += SCORING.goldenLure;
      return SCORING.goldenLure;
    },
    addCheckpoint() {
      game.points.checkpoints += SCORING.checkpoint;
      return SCORING.checkpoint;
    },
    addMissedCheckpoint() {
      game.points.penalties += SCORING.missedCheckpoint;
      return SCORING.missedCheckpoint;
    },

    // The score during the race (before finish bonuses and the difficulty multiplier).
    // It never shows below zero.
    currentScore() {
      const p = game.points;
      return Math.max(0, p.coins + p.goldenLures + p.checkpoints + p.penalties);
    },

    // Works out the final score at the finish line, with every part listed.
    finalScore() {
      const seconds = game.time;
      const timeBonus = Math.round(Math.max(0, SCORING.timeBonusSeconds - seconds) * SCORING.timeBonusPerSecond);
      const livesBonus = game.lives * SCORING.perLifeLeft;
      const subtotal = game.currentScore() + SCORING.finish + timeBonus + livesBonus;
      const multiplier = SCORING.multiplier[SCORING.difficulty];
      return {
        coins: game.points.coins,
        coinCount: game.coinCount,
        goldenLures: game.points.goldenLures,
        goldenCount: game.goldenCount,
        checkpoints: game.points.checkpoints,
        penalties: game.points.penalties,
        finish: SCORING.finish,
        timeBonus,
        seconds,
        livesBonus,
        livesLeft: game.lives,
        subtotal,
        multiplier,
        total: Math.round(subtotal * multiplier),
      };
    },

    isInvincible() {
      return game.invincibleTimer > 0;
    },

    isRespawning() {
      return game.respawnTimer > 0;
    },

    // Take away a life. Returns true if that was the last one.
    // Otherwise starts the short wait before respawning.
    loseLife() {
      game.lives--;
      if (game.lives <= 0) {
        game.state = 'gameover';
        return true;
      }
      game.respawnTimer = GAME.respawnDelay;
      return false;
    },

    // Called right after the bobber is put back at a checkpoint.
    startInvincible() {
      game.invincibleTimer = GAME.invincibleTime;
    },

    // Counts the timers down. Returns true on the frame the respawn wait finishes.
    update(dt) {
      if (game.timerRunning && game.state === 'playing') game.time += dt;
      if (game.invincibleTimer > 0) game.invincibleTimer = Math.max(0, game.invincibleTimer - dt);
      if (game.respawnTimer > 0) {
        game.respawnTimer -= dt;
        if (game.respawnTimer <= 0) {
          game.respawnTimer = 0;
          return true;
        }
      }
      return false;
    },

    // While invincible, the bobber blinks: visible for 0.1 s, hidden for 0.1 s, and so on.
    // Dividing the time left by 0.1 and rounding down gives 0, 1, 2, 3...; even = show.
    blinkVisible() {
      if (!game.isInvincible()) return true;
      return Math.floor(game.invincibleTimer / 0.1) % 2 === 0;
    },
  };
  return game;
}

// Collision check: is the bobber touching any of these circles?
// Two circles touch when the distance between their centers is less than
// the two radii added together. (Distance uses Pythagoras: √(dx² + dz²).)
export function bobberHitsAny(bobber, circles) {
  for (const c of circles) {
    const dx = c.x - bobber.position.x;
    const dz = c.z - bobber.position.z;
    if (Math.sqrt(dx * dx + dz * dz) < c.r + bobber.radius) return true;
  }
  return false;
}

// Turns seconds into "m:ss.t", e.g. 83.4 -> "1:23.4".
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
