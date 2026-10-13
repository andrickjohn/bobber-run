// main.js
// The starting point of the game. It creates everything (scene, world, bobber,
// checkpoints, obstacles, wildlife, effects, HUD, menus), loads levels, switches between
// the screens (title, settings, playing, paused, level complete, game over), and runs
// the main loop: update everything, check for hits, move the camera, draw a frame, repeat
// (about 60 times a second).

import * as THREE from 'three';
import { CAMERA, BOBBER, OBSTACLES, EFFECTS, FLY, SHOOT, PORTAL, LEVELS } from './config.js';
import { createScene, getChaseCameraPose } from './scene.js';
import { createWorld, lakeCenterX, setLevel, getLevel, getTheme } from './world.js';
import { createBobber } from './bobber.js';
import { createCheckpoints } from './checkpoints.js';
import { createObstacles, setSplashHandler } from './obstacles.js';
import { createWildlife } from './wildlife.js';
import { createEffects } from './effects.js';
import { createGame, bobberHitsAny, formatTime } from './game.js';
import { createCoins } from './coins.js';
import { createShooter } from './shooting.js';
import { createUI } from './ui.js';
import { loadSettings, saveSettings, applySettings, loadBestScores, recordScore } from './settings.js';
import { playChime, playFanfare, playBuzz, playSplash, playGameOver, playDing, playGoldenDing, setMuted, setThrust, playPlop, playZap, playPoof, playFall, playWarp, setAmbientTheme, playReload, setPortalHum } from './audio.js';

const canvas = document.getElementById('game');
const { renderer, scene, camera, followWithSun, applyTheme } = createScene(canvas);
const bobber = createBobber(scene, camera, canvas);
const checkpoints = createCheckpoints(scene);
const obstacles = createObstacles(scene);
const effects = createEffects(scene);
const coins = createCoins(scene);
const shooter = createShooter(scene, canvas);
const game = createGame();
const ui = createUI();

// The player's saved settings (speed, obstacle count, difficulty).
const settings = loadSettings();
bobber.setSpeedSetting(settings.speed);
setMuted(settings.muted);
ui.setMuted(settings.muted);

// Jumping fish make little splashes.
setSplashHandler((x, y, z, size) => effects.splash(x, y, z, size));

// Game time only counts up while not paused, so waves and obstacles freeze too.
let gameTime = 0;
const previousPosition = new THREE.Vector3();

// Which screen the Settings menu should go back to: 'title' or 'pause'.
let settingsReturnTo = 'title';

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------
// The scenery for the level we're on. Rebuilt only when the level changes.
let world = null;
let wildlife = null; // frogs and birds (Home Lake only)
let loadedLevel = -1;
let livesAtLevelStart = 0; // so Restart can start the level over fairly

function loadLevel(index) {
  if (world) world.dispose();
  if (wildlife) wildlife.dispose();
  setLevel(LEVELS[index]); // tells world.js (and everything using it) which lakes exist
  applyTheme(getTheme()); // sky, fog and light colors
  world = createWorld(scene);
  wildlife = getTheme().wildlife ? createWildlife(scene) : null;
  setAmbientTheme(getLevel().theme); // lake sounds or space hum
  loadedLevel = index;
}

// ---------------------------------------------------------------------------
// Screens: title, settings, pause, playing, level complete, game over
// ---------------------------------------------------------------------------

// Sets up the course for the current level: new gates, new obstacles, bobber at the start.
function setUpCourse() {
  if (loadedLevel !== game.levelIndex) loadLevel(game.levelIndex);
  checkpoints.reset(); // new random gate layout...
  obstacles.build(OBSTACLES.count, checkpoints.getGateCenters()); // ...and new obstacles around it
  bobber.reset(0, BOBBER.startZ);
  bobber.setVisible(true);
  coins.clear();
  shooter.clear();
  snapCamera();
  resetHUD();
  ui.setPaused(false);
  ui.setWarning(null);
}

function goToTitle() {
  applySettings(settings);
  game.newRun(0);
  setUpCourse();
  game.state = 'title';
  bobber.setControlsEnabled(false);
  ui.setTitleMode(true);
  ui.showTitle(loadBestScores(), settings, LEVELS);
}

// Start a new run. levelIndex lets the title screen start straight at a later level.
function startGame(levelIndex = 0) {
  applySettings(settings); // difficulty and obstacle count take effect here
  game.newRun(levelIndex);
  beginLevel();
}

// Start (or restart) the level we're on.
function beginLevel() {
  livesAtLevelStart = game.lives;
  setUpCourse();
  game.state = 'playing';
  bobber.setControlsEnabled(true);
  ui.setTitleMode(false);
  ui.hideMenu();
  ui.setLevelName(getLevel().name);
  ui.showToast(`Level ${game.levelIndex + 1}: ${getLevel().name}`, 2.5);
}

// R / Restart: start this level over (with the lives you had when it began).
function restartLevel() {
  if (game.state === 'title') return;
  game.lives = livesAtLevelStart;
  game.reset();
  beginLevel();
}

// After the level-complete screen: warp through the portal to the next level.
function enterPortal() {
  playWarp();
  ui.flash(() => {
    game.levelIndex++;
    game.reset(); // new score and timer for this level; lives carry over
    beginLevel();
  });
}

function openSettings() {
  settingsReturnTo = game.state === 'paused' ? 'pause' : 'title';
  showSettingsScreen();
}

function showSettingsScreen() {
  const note = settingsReturnTo === 'pause' ? 'Difficulty and obstacle changes start with your next game.' : '';
  ui.showSettings(settings, note);
}

function closeSettings() {
  if (settingsReturnTo === 'pause') ui.showPause();
  else ui.showTitle(loadBestScores(), settings, LEVELS);
}

// Pausing only works while racing.
function togglePause() {
  if (game.state === 'playing') {
    game.state = 'paused';
    ui.setPaused(true);
    ui.showPause();
  } else if (game.state === 'paused') {
    game.state = 'playing';
    ui.setPaused(false);
    ui.hideMenu();
  }
}

// Flew through the portal: show this level's score. If there's another level, the
// button warps you there; after the last level, it's the final victory screen.
function showLevelComplete() {
  const result = game.finalScore();
  game.runTotal += result.total;
  const next = LEVELS[game.levelIndex + 1];
  if (next) {
    ui.showLevelComplete(result, game.runTotal, getLevel().name, next.name);
  } else {
    const isNewBest = recordScore(settings.difficulty, game.runTotal);
    ui.showVictory(result, game.runTotal, isNewBest, loadBestScores()[settings.difficulty]);
  }
}

function showGameOver() {
  const total = game.runScoreSoFar();
  const isNewBest = recordScore(settings.difficulty, total);
  ui.showGameOver(total, checkpoints.passed, checkpoints.total, getLevel().name, isNewBest);
}

// ----- Menu buttons -----
ui.on('play', () => startGame(0));
ui.on('playLevel', (index) => startGame(Number(index)));
ui.on('nextLevel', enterPortal);
ui.on('settings', openSettings);
ui.on('back', closeSettings);
ui.on('resume', togglePause);
ui.on('pause', togglePause);
ui.on('quit', goToTitle);
ui.on('restart', restartLevel);
// On-screen touch buttons
ui.on('flyDown', () => bobber.setFlyButton(true));
ui.on('flyUp', () => bobber.setFlyButton(false));
ui.on('zapDown', () => shooter.setButton(true));
ui.on('zapUp', () => shooter.setButton(false));
ui.on('mute', toggleMute);
function toggleMute() {
  settings.muted = !settings.muted;
  setMuted(settings.muted);
  ui.setMuted(settings.muted);
  saveSettings(settings);
}
// Settings changes are saved right away.
ui.on('speed', (value) => {
  settings.speed = value;
  bobber.setSpeedSetting(value); // speed changes even in the middle of a game
  saveSettings(settings);
});
ui.on('obstacles', (value) => {
  settings.obstacles = value;
  saveSettings(settings);
});
ui.on('difficulty', (value) => {
  settings.difficulty = value;
  saveSettings(settings);
  showSettingsScreen(); // redraw so the chosen button is highlighted
});

// ----- Keyboard shortcuts -----
window.addEventListener('keydown', (e) => {
  const settingsOpen = !!document.getElementById('speed-slider');
  if (e.key === 'm' || e.key === 'M') toggleMute();
  if (e.key === 'Escape' && settingsOpen) return closeSettings();
  if ((e.key === 'Enter' || e.key === ' ') && game.state === 'title' && !settingsOpen) return startGame(0);
  if ((e.key === 'r' || e.key === 'R') && game.state !== 'title') restartLevel();
  if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && !settingsOpen) togglePause();
});

// Puts every HUD number back to its starting value.
function resetHUD() {
  ui.setCheckpoints(0, checkpoints.total);
  ui.setLives(game.lives, game.maxLives);
  ui.setScore(0);
  ui.setTimer(formatTime(0));
  ui.setProgress(0);
  ui.setProgressCheckpoints(gateFractions(), 0);
}

// How far along the course each checkpoint is (0 = start, 1 = portal), for the progress bar.
function gateFractions() {
  return checkpoints.getGateCenters().map((g) => g.z / getLevel().finishZ);
}

// Adds points to the score and shows the little "+10" pop.
function scorePoints(amount) {
  ui.setScore(game.currentScore());
  ui.popPoints(amount);
}

// React to what the checkpoints reported this frame.
function handleCourseEvent(event) {
  if (!event) return;
  if (event.checkpoint) {
    playChime();
    effects.sparkle(bobber.position.x, bobber.mesh.position.y + 1, bobber.position.z, true);
    scorePoints(game.addCheckpoint());
    shooter.addAmmo(SHOOT.checkpointBonus); // checkpoints earn extra zaps
    ui.setCheckpoints(event.checkpoint, checkpoints.total);
    ui.setProgressCheckpoints(gateFractions(), event.checkpoint);
    ui.showToast(`Checkpoint ${event.checkpoint}! +${SHOOT.checkpointBonus} zaps`);
    ui.setWarning(null);
  } else if (event.missed) {
    playBuzz();
    scorePoints(game.addMissedCheckpoint());
    ui.setWarning(`↩ Go back for checkpoint ${event.missed}`);
    ui.showToast(`Missed checkpoint ${event.missed}! Turn back and go between the buoys.`, 3);
  } else if (event.wrongGate) {
    playBuzz();
    scorePoints(game.addMissedCheckpoint());
    ui.setWarning(`↩ Go back for checkpoint ${event.need}`);
    ui.showToast(`That's gate ${event.wrongGate}. Go back for checkpoint ${event.need}!`, 3);
  } else if (event.missedCheckpoints) {
    playBuzz();
    ui.setWarning(`↩ Go back for checkpoint ${event.missedCheckpoints}`);
    ui.showToast(`You can't finish yet. Go back for checkpoint ${event.missedCheckpoints}!`, 3);
  } else if (event.finished) {
    game.state = 'won';
    playFanfare();
    const fz = getLevel().finishZ;
    effects.confetti(lakeCenterX(fz), PORTAL.centerHeight, fz);
    bobber.setControlsEnabled(false);
    showLevelComplete();
  }
}

// ---------------------------------------------------------------------------
// Coins
// ---------------------------------------------------------------------------
function updateCoins(dt, time) {
  const playing = game.state === 'playing';
  const picked = coins.update(dt, time, bobber, obstacles.isClear, playing, playing && !game.isRespawning());
  for (const p of picked) {
    effects.sparkle(p.x, p.y, p.z, p.kind !== 'coin');
    if (p.kind === 'zapPack') {
      playReload();
      shooter.addAmmo(SHOOT.packAmount);
      ui.showToast(`⚡ Zap Pack! +${SHOOT.packAmount} zaps`);
    } else if (p.golden) {
      playGoldenDing();
      scorePoints(game.addGoldenLure());
      ui.showToast('Golden Lure! +50');
    } else {
      playDing();
      scorePoints(game.addCoin());
    }
  }
}

// ---------------------------------------------------------------------------
// Zapping
// ---------------------------------------------------------------------------
function updateShooting(dt, time) {
  const canShoot = game.state === 'playing' && !game.isRespawning();
  const shots = shooter.update(dt, time, bobber, obstacles, canShoot);
  if (shots.fired) playZap();
  for (const z of shots.zapped) {
    // Poof! The obstacle disappears in a burst of sparkles and a splash.
    effects.sparkle(z.x, z.y + 0.5, z.z, true);
    effects.splash(z.x, Math.max(0, z.y), z.z, 0.5);
    playPoof();
    scorePoints(game.addZap());
  }
  for (const p of shots.splashes) effects.splash(p.x, p.y, p.z, 0.25); // missed, hit the water
  // Show at least the normal number of dots, more when carrying extra.
  ui.setAmmo(shooter.ammo, Math.max(SHOOT.maxAmmo, shooter.ammo));
}

// ---------------------------------------------------------------------------
// Getting hit
// ---------------------------------------------------------------------------
function checkForHits() {
  if (game.state !== 'playing' || game.isInvincible() || game.isRespawning()) return;
  if (!bobberHitsAny(bobber, obstacles.getHitCircles())) return;

  // Splash! Hide the bobber and stop it where it is.
  effects.splash(bobber.position.x, bobber.mesh.position.y - BOBBER.floatOffset, bobber.position.z);
  shakeTimer = EFFECTS.shakeTime;
  playSplash();
  loseALife('Splash!');
}

// Fell into a gap between space lakes.
function fellIntoSpace() {
  if (game.state !== 'playing' || game.isRespawning()) return;
  playFall();
  loseALife('Lost in space!');
}

function loseALife(message) {
  bobber.reset(bobber.position.x, bobber.position.z);
  bobber.setVisible(false);
  bobber.setControlsEnabled(false);
  const outOfLives = game.loseLife();
  ui.setLives(game.lives, game.maxLives);
  if (outOfLives) {
    playGameOver();
    showGameOver();
  } else {
    ui.showToast(game.lives === 1 ? `${message} Last life!` : `${message} ${game.lives} lives left`, 2);
  }
}

// After the short splash pause: back to the last checkpoint, blinking and safe for a moment.
function respawn() {
  const spot = checkpoints.getRespawnPoint();
  bobber.reset(spot.x, spot.z);
  bobber.setControlsEnabled(true);
  game.startInvincible();
  snapCamera();
}

// ---------------------------------------------------------------------------
// Chase camera
// ---------------------------------------------------------------------------
// The camera wants to be behind and above the bobber, looking ahead toward the finish.
// Each frame it moves part of the way there ("lerp" = linear interpolation),
// so it follows smoothly and never snaps.
const cameraLookAt = new THREE.Vector3();
const wantedPosition = new THREE.Vector3();
const wantedLookAt = new THREE.Vector3();

function placeCamera(p) {
  getChaseCameraPose(p, wantedPosition, wantedLookAt, bobber.height);
}

// The smooth camera position (without any shake added).
const cameraBase = new THREE.Vector3();
let shakeTimer = 0;

function updateCamera(dt) {
  placeCamera(bobber.position);
  // 1 - e^(-speed × dt) is the fraction of the gap to close this frame.
  // It gives the same smooth feel at 30 fps or 144 fps.
  const t = 1 - Math.exp(-CAMERA.followSpeed * dt);
  cameraBase.lerp(wantedPosition, t);
  cameraLookAt.lerp(wantedLookAt, t);
  camera.position.copy(cameraBase);
  // Shake after a hit: jolt the camera a random amount, getting weaker as the timer runs out.
  if (shakeTimer > 0) {
    shakeTimer -= dt;
    const strength = EFFECTS.shakeAmount * Math.max(0, shakeTimer / EFFECTS.shakeTime);
    camera.position.x += (Math.random() - 0.5) * 2 * strength;
    camera.position.y += (Math.random() - 0.5) * 2 * strength;
  }
  camera.lookAt(cameraLookAt);
}

// Jump the camera straight into place behind the bobber (start, restart, respawn).
function snapCamera() {
  placeCamera(bobber.position);
  cameraBase.copy(wantedPosition);
  camera.position.copy(wantedPosition);
  cameraLookAt.copy(wantedLookAt);
  camera.lookAt(cameraLookAt);
}
goToTitle(); // the game opens on the title screen

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
// We measure how much time passed since the last frame, so the game runs at the same
// speed on fast and slow computers.
let lastFrameTime = performance.now();

// Moves the whole game forward by dt seconds.
function step(dt) {
  if (game.state === 'paused') return;
  gameTime += dt;
  const time = gameTime;
  world.update(time);
  obstacles.update(dt, time, bobber, game.isInvincible()); // also lets lily pads / whirlpools push the bobber
  if (game.isRespawning()) bobber.velocity.set(0, 0, 0); // stay put while "under water"
  if (wildlife) wildlife.update(dt, bobber.position);
  const wakeOn = game.state === 'playing' && !game.isRespawning() && bobber.onWater;
  effects.update(dt, time, bobber, wakeOn);
  updateCoins(dt, time);

  previousPosition.copy(bobber.position); // remember where we were, to detect crossing lines
  const flightEvent = bobber.update(dt, time);
  if (flightEvent && flightEvent.fell) fellIntoSpace();
  if (flightEvent && flightEvent.landed && game.state === 'playing') {
    // Splashing down after a flight
    effects.splash(bobber.position.x, bobber.mesh.position.y - BOBBER.floatOffset, bobber.position.z, 0.6);
    playPlop();
  }
  updateShooting(dt, time);
  const event = checkpoints.update(previousPosition, bobber.position, time);
  if (game.state === 'playing') handleCourseEvent(event);
  checkForHits();

  // The race timer starts the moment the bobber leaves the dock.
  if (!game.timerRunning && bobber.position.z < BOBBER.startZ - 1) game.timerRunning = true;
  if (game.update(dt)) respawn(); // true when the respawn wait just finished
  ui.setTimer(formatTime(game.time));
  ui.setProgress(bobber.position.z / getLevel().finishZ);
  const f = bobber.flight;
  ui.setEnergy(f.energy, !f.flying && f.energy < FLY.minEnergyToFly);
  if (game.state === 'playing' && !game.isRespawning()) bobber.setVisible(game.blinkVisible());

  updateCamera(dt);
  followWithSun(bobber.position);
}

// The browser calls loop() before every screen refresh and tells it the current time (ms).
function loop(now = performance.now()) {
  // Seconds since the last frame. Capped so a slow frame (or switching tabs)
  // doesn't make things jump.
  const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;
  step(Math.max(0, dt));
  // Flying whoosh: on while flying during a race, off otherwise (including when paused).
  setThrust(game.state === 'playing' && bobber.flight.flying ? 1 : 0);
  // Portal hum: fades in over the last 80 units before the portal.
  const toPortal = Math.abs(bobber.position.z - getLevel().finishZ);
  setPortalHum(game.state === 'playing' ? Math.max(0, 1 - toPortal / 80) : 0);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
