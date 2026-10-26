// settings.js
// Remembers the player's settings and best scores between visits, using localStorage
// (a small storage space the browser gives every website).
// Also applies the chosen settings to the game's config values.
//
// localStorage can be missing or blocked (private windows, school computers), so every
// read and write is wrapped in try/catch. If it fails, the game still works; it just
// won't remember anything.

import { BOBBER, OBSTACLES, COINS, COMBO, GAME, SCORING, DIFFICULTY, SETTINGS_LIMITS } from './config.js';

const SETTINGS_KEY = 'bobberRun.settings';
const BEST_KEY = 'bobberRun.bestScores';
const STARS_KEY = 'bobberRun.stars';
const TIPS_KEY = 'bobberRun.tipsSeen';

// The settings a brand-new player starts with (taken from config.js).
function defaultSettings() {
  return {
    speed: BOBBER.speedSetting,
    obstacles: OBSTACLES.count,
    difficulty: SCORING.difficulty,
    muted: false,
  };
}

// Keeps a number inside min..max (in case the saved data is old or broken).
function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function loadSettings() {
  const settings = defaultSettings();
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const L = SETTINGS_LIMITS;
    settings.speed = clamp(saved.speed, L.speedMin, L.speedMax, settings.speed);
    settings.obstacles = clamp(saved.obstacles, L.obstaclesMin, L.obstaclesMax, settings.obstacles);
    if (DIFFICULTY[saved.difficulty]) settings.difficulty = saved.difficulty;
    settings.muted = saved.muted === true;
  } catch (e) {
    // Nothing saved, or storage blocked: use the defaults.
  }
  return settings;
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    // Storage blocked: settings just won't be remembered.
  }
}

// Best score for each difficulty, e.g. { easy: 0, normal: 2673, hard: 0 }.
export function loadBestScores() {
  const best = { easy: 0, normal: 0, hard: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
    for (const d of Object.keys(best)) {
      if (Number.isFinite(saved[d])) best[d] = saved[d];
    }
  } catch (e) {
    // Nothing saved yet.
  }
  return best;
}

// Saves the score if it beats the best for that difficulty. Returns true if it's a new best.
export function recordScore(difficulty, score) {
  const best = loadBestScores();
  if (score <= best[difficulty]) return false;
  best[difficulty] = score;
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch (e) {
    // Storage blocked: still counts as a new best for this game.
  }
  return true;
}

// The most stars earned in each world, e.g. [3, 1, 0, 0] (index = level number).
export function loadStars() {
  try {
    const saved = JSON.parse(localStorage.getItem(STARS_KEY) || '[]');
    return Array.isArray(saved) ? saved.map((n) => (Number.isFinite(n) ? n : 0)) : [];
  } catch (e) {
    return [];
  }
}

// Saves the stars for a world if they beat the old record.
export function recordStars(levelIndex, stars) {
  const all = loadStars();
  if (stars <= (all[levelIndex] || 0)) return;
  all[levelIndex] = stars;
  try {
    localStorage.setItem(STARS_KEY, JSON.stringify(all));
  } catch (e) {
    // Storage blocked: just won't be remembered.
  }
}

// Which first-time tips have already been shown (so each one only shows once).
export function loadTipsSeen() {
  try {
    const saved = JSON.parse(localStorage.getItem(TIPS_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved : []);
  } catch (e) {
    return new Set();
  }
}

export function saveTipsSeen(seen) {
  try {
    localStorage.setItem(TIPS_KEY, JSON.stringify([...seen]));
  } catch (e) {
    // Storage blocked: tips may show again next visit. That's fine.
  }
}

// Copies the chosen difficulty and obstacle count into the config values the game reads.
// Called at the start of every game. (The bobber's speed is set separately in main.js,
// because it can change in the middle of a game.)
export function applySettings(settings) {
  const d = DIFFICULTY[settings.difficulty];
  SCORING.difficulty = settings.difficulty;
  OBSTACLES.count = settings.obstacles;
  OBSTACLES.speedMultiplier = d.obstacleSpeed;
  OBSTACLES.includeWhirlpools = d.whirlpools;
  OBSTACLES.turtle.chaseRadius = d.turtleChaseRadius;
  OBSTACLES.turtle.giveUpRadius = d.turtleGiveUpRadius;
  COINS.gapMin = d.coinGapMin;
  COINS.gapMax = d.coinGapMax;
  COMBO.window = d.comboWindow;
  GAME.lives = d.lives;
  GAME.invincibleTime = d.invincibleTime;
}
