// game.js
// The rules of the game: which state we're in, how many lives are left,
// the invincibility after a respawn, the score and timer, and checking if the
// bobber hit something.
//
// Game states:
//   'title'    – on the title screen (the lake is just scenery)
//   'playing'  – racing down the lake
//   'paused'   – everything frozen
//   'won'      – flew through a level's finish portal (score screen before the next level)
//   'gameover' – ran out of lives
//
// A "run" goes through every level in order. Lives carry over from level to level,
// and each level's score is added to the run's total.

import { GAME, SCORING, BOBBER, RINGS } from './config.js';

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
    points: { coins: 0, goldenLures: 0, rings: 0, zaps: 0, cooler: 0 },
    ringCount: 0,
    catchCount: 0,      // fish caught into the cooler
    popCount: 0,        // fish popped (three in a row)
    zapCount: 0,
    coinCount: 0,
    goldenCount: 0,
    levelIndex: 0,      // which level we're on (0 = the first)
    runTotal: 0,        // points from levels already finished in this run

    // Start a fresh run from the first level (or from startLevel for the level picker).
    newRun(startLevel = 0) {
      game.lives = GAME.lives;
      game.maxLives = GAME.lives;
      game.levelIndex = startLevel;
      game.runTotal = 0;
      game.reset();
    },

    // Start the current level: score and timer back to zero, lives stay the same.
    reset() {
      game.state = 'playing';
      game.invincibleTimer = 0;
      game.respawnTimer = 0;
      game.time = 0;
      game.timerRunning = false;
      game.points = { coins: 0, goldenLures: 0, rings: 0, zaps: 0, cooler: 0 };
      game.ringCount = 0;
      game.catchCount = 0;
      game.popCount = 0;
      game.zapCount = 0;
      game.coinCount = 0;
      game.goldenCount = 0;
    },

    // ----- Scoring -----
    // Each add... returns how many points were added (so the HUD can show "+10").
    // multiplier = the combo multiplier (×1, ×2, ...): long combos are worth a lot!
    addCoin(multiplier = 1) {
      const points = SCORING.coin * multiplier;
      game.coinCount++;
      game.points.coins += points;
      return points;
    },
    addGoldenLure(multiplier = 1) {
      const points = SCORING.goldenLure * multiplier;
      game.goldenCount++;
      game.points.goldenLures += points;
      return points;
    },
    addRing(multiplier = 1) {
      const points = RINGS.points * multiplier;
      game.ringCount++;
      game.points.rings += points;
      return points;
    },
    // Fish popped in the cooler: points per fish × the chain number × the combo multiplier.
    addCoolerPop(fishPopped, chain, multiplier = 1) {
      const points = SCORING.coolerPop * fishPopped * chain * multiplier;
      game.popCount += fishPopped;
      game.points.cooler += points;
      return points;
    },
    addZap() {
      game.zapCount++;
      game.points.zaps += SCORING.zap;
      return SCORING.zap;
    },
    // The score during the race (before finish bonuses and the difficulty multiplier).
    currentScore() {
      const p = game.points;
      return p.coins + p.goldenLures + p.rings + p.zaps + p.cooler;
    },

    // Total for the whole run so far, counting the level we're on (used for Game Over).
    runScoreSoFar() {
      return game.runTotal + Math.round(game.currentScore() * SCORING.multiplier[SCORING.difficulty]);
    },

    // Works out this level's score at the finish portal, with every part listed.
    // bestCombo = the longest combo this level (shown on the results screen).
    finalScore(bestCombo = 0) {
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
        rings: game.points.rings,
        ringCount: game.ringCount,
        zaps: game.points.zaps,
        zapCount: game.zapCount,
        cooler: game.points.cooler,
        catchCount: game.catchCount,
        popCount: game.popCount,
        bestCombo,
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

    // Called right after the bobber is put back on the lake.
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
// Circles also have a height: if the bobber is far above or below one, it misses.
export function bobberHitsAny(bobber, circles) {
  const bobberY = bobber.height + BOBBER.floatOffset; // center of the bobber above the water
  for (const c of circles) {
    if (c.y !== undefined && Math.abs(bobberY - c.y) > c.h + bobber.radius) continue;
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
