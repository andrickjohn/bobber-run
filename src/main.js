// main.js
// The starting point of the game. It creates everything (scene, world, bobber,
// ring gates, coin trails, combos, obstacles, wildlife, effects, HUD, menus), loads levels, switches between
// the screens (title, settings, playing, paused, level complete, game over), and runs
// the main loop: update everything, check for hits, move the camera, draw a frame, repeat
// (about 60 times a second).

import './style.css'; // how the HUD and menus look
import * as THREE from 'three';
import { CAMERA, BOBBER, OBSTACLES, EFFECTS, SHOOT, PORTAL, LEVELS, HYPERSPACE, BLACK_HOLE, RINGS, COMBO, CATCH, INTRO, STARS, TIPS, RUNNER } from './config.js';
import { createScene, getChaseCameraPose } from './scene.js';
import { createWorld, lakeCenterX, setLevel, getLevel, getTheme } from './world.js';
import { createBobber } from './bobber.js';
import { createCourse } from './course.js';
import { createCombo } from './combo.js';
import { createCatchFish } from './catchfish.js';
import { createCooler } from './cooler.js';
import { createObstacles, setSplashHandler } from './obstacles.js';
import { createWildlife } from './wildlife.js';
import { createEffects } from './effects.js';
import { createGame, bobberHitsAny, formatTime } from './game.js';
import { createCoins } from './coins.js';
import { createShooter } from './shooting.js';
import { createHyperspace } from './hyperspace.js';
import { createUI } from './ui.js';
import { loadSettings, saveSettings, applySettings, loadBestScores, recordScore, loadStars, recordStars, loadTipsSeen, saveTipsSeen } from './settings.js';
import { playChime, playFanfare, playSplash, playGameOver, playComboDing, playMultiplierUp, playComboBreak, playGoldenDing, setMuted, playJump, playLeap, playPlop, playZap, playPoof, playFall, setAmbientTheme, playReload, setPortalHum, playHyperspace, playBlackHole, playCatch, playCoolerPop, playOverflow, playCountBeep, playTip } from './audio.js';

const canvas = document.getElementById('game');
const { renderer, scene, camera, followWithSun, applyTheme } = createScene(canvas);
const bobber = createBobber(scene, camera, canvas);
const course = createCourse(scene);
const combo = createCombo();
const catchFish = createCatchFish(scene);
const obstacles = createObstacles(scene);
const effects = createEffects(scene);
const coins = createCoins(scene);
const shooter = createShooter(scene, canvas);
const hyperspace = createHyperspace();
const game = createGame();
const ui = createUI();
const cooler = createCooler(ui.coolerCanvas, { onPop: coolerPopped, onOverflow: coolerOverflowed });

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
  catchFish.reset(); // new schools of fish to catch
  cooler.clear();
  portalOpen = false;
  world.closePortal();
  course.reset(); // new ring gates...
  obstacles.build(OBSTACLES.count, course.getRingSpots()); // ...and new obstacles around them
  combo.reset();
  bobber.reset(0, BOBBER.startZ);
  bobber.setVisible(true);
  coins.clear();
  coins.setRingSpots(course.getRingSpots()); // some coin trails line up through the rings
  shooter.clear();
  snapCamera();
  resetHUD();
  ui.setPaused(false);
}

function goToTitle() {
  intro = null;
  ui.showCountdown('');
  ui.hideTip();
  stopWarp();
  applySettings(settings);
  game.newRun(0);
  setUpCourse();
  game.state = 'title';
  bobber.setControlsEnabled(false);
  ui.setTitleMode(true);
  ui.showTitle(loadBestScores(), settings, LEVELS, loadStars());
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
  ui.setTitleMode(false);
  ui.hideMenu();
  ui.hideTip();
  ui.setLevelName(getLevel().name);
  ui.showToast(`Level ${game.levelIndex + 1}: ${getLevel().name}`, 2.5);
  startCountdown();
}

// ---------------------------------------------------------------------------
// 3, 2, 1, GO! The camera swoops down from the sky to behind the bobber while the
// numbers count down. You can't steer (and the clock doesn't run) until GO.
// ---------------------------------------------------------------------------
let intro = null; // the countdown in progress: { t = seconds so far, beat = last number shown }
const swoopFrom = new THREE.Vector3();

function startCountdown() {
  game.state = 'countdown';
  bobber.setControlsEnabled(false);
  intro = { t: 0, beat: -1 };
}

function updateCountdown(dt) {
  intro.t += dt;
  // The swoop: from high up and far behind, down to the normal chase-camera spot.
  const p = Math.min(1, intro.t / (INTRO.beat * 3));
  const e = 1 - (1 - p) * (1 - p) * (1 - p); // "ease out": fast at first, then gently settles
  placeCamera(bobber.position);
  swoopFrom.set(wantedPosition.x, wantedPosition.y + INTRO.height, wantedPosition.z + INTRO.back);
  cameraBase.lerpVectors(swoopFrom, wantedPosition, e);
  camera.position.copy(cameraBase);
  cameraLookAt.copy(wantedLookAt);
  camera.lookAt(cameraLookAt);

  // beat 0, 1, 2 show "3", "2", "1"; beat 3 is GO!
  const beat = Math.floor(intro.t / INTRO.beat);
  if (beat === intro.beat) return;
  intro.beat = beat;
  if (beat < 3) {
    ui.showCountdown(String(3 - beat));
    playCountBeep(false);
  } else {
    go();
  }
}

// GO! Hand the controls to the player.
function go() {
  intro = null;
  game.state = 'playing';
  bobber.setControlsEnabled(true);
  ui.showCountdown('GO!');
  playCountBeep(true);
  setTimeout(() => game.state !== 'countdown' && ui.showCountdown(''), 900);
  const touch = document.body.classList.contains('touch');
  tip('steer', touch
    ? 'You cruise forward by yourself. Drag left and right to <b>line up</b> with the coin trails!'
    : 'You cruise forward by yourself. Point left and right (or use the arrow keys) to <b>line up</b> with the coin trails!');
}

// ---------------------------------------------------------------------------
// First-time tips: each one shows once (ever), the first time it's useful.
// ---------------------------------------------------------------------------
const tipsSeen = loadTipsSeen();
const tipQueue = [];

// Asks for a tip. It waits its turn if another tip is showing. urgent = show it right away.
function tip(id, html, urgent = false) {
  if (tipsSeen.has(id) || tipQueue.some((t) => t.id === id)) return;
  if (urgent) tipQueue.unshift({ id, html });
  else tipQueue.push({ id, html });
  if (urgent) ui.hideTip();
}

function updateTips() {
  if (game.state !== 'playing') return;
  // Jump tip: when an obstacle is coming up right in front of you.
  if (!tipsSeen.has('jump') && obstacles.getHitCircles().some((c) => {
    const dz = bobber.position.z - c.z;
    return dz > 6 && dz < TIPS.jumpLookAhead && Math.abs(c.x - bobber.position.x) < 4;
  })) {
    const touch = document.body.classList.contains('touch');
    tip('jump', touch ? 'Something ahead! Tap <b>Jump</b> to hop over it.' : 'Something ahead! Press <b>Space</b> (or click) to hop over it.', true);
  }
  // Catch tip: when a school of little fish is close ahead.
  if (!tipsSeen.has('catch') && catchFish.list.some((f) => {
    const dz = bobber.position.z - f.mesh.position.z;
    return dz > 0 && dz < 35;
  })) {
    tip('catch', 'Bump into the little <b>colored fish</b> to catch them for your cooler.');
  }
  if (ui.tipShowing || tipQueue.length === 0) return;
  const next = tipQueue.shift();
  tipsSeen.add(next.id);
  saveTipsSeen(tipsSeen);
  ui.showTip(next.html, TIPS.seconds);
  playTip();
}

// R / Restart: start this level over (with the lives you had when it began).
function restartLevel() {
  if (game.state === 'title' || game.state === 'warping' || game.state === 'blackhole') return;
  game.lives = livesAtLevelStart;
  game.reset();
  beginLevel();
}

// ---------------------------------------------------------------------------
// The hyperspace jump to the next world (it starts the moment you fly into the portal)
// ---------------------------------------------------------------------------
// 1. "dive":   the camera rushes into the portal, rumbling, the view stretches wider and
//              wider, star streaks speed past and the screen glows blue.
// 2. "tunnel": zooming through a glowing, spinning tunnel. A little card shows how you did
//              (stars and points). Press "Scores" to stop and look at everything.
// 3. Flash:    the screen goes white, and the next world is built behind it.
// 4. "arrive": the streaks slow down and the view settles behind the bobber. GO!
let warp = null;        // the jump in progress (null when not warping)
let levelResult = null; // the score breakdown of the world we just finished

function enterPortal() {
  if (warp || game.state !== 'won') return;
  ui.setWarpMode(true);
  game.state = 'warping';
  bobber.setVisible(false);
  playHyperspace(HYPERSPACE.diveTime + HYPERSPACE.tunnelTime);
  const fz = getLevel().finishZ;
  const portal = new THREE.Vector3(lakeCenterX(fz), PORTAL.centerHeight, fz);
  warp = {
    phase: 'dive',
    t: 0,
    held: false,                                       // stopped to look at the scores
    from: camera.position.clone(),                     // where the camera starts
    to: portal.clone().add(new THREE.Vector3(0, 0, -8)), // just through the portal
    lookAt: portal.clone().add(new THREE.Vector3(0, 0, -80)), // look straight through it
    flashed: false,
  };
}

function updateWarp(dt) {
  if (!warp.held) warp.t += dt;
  const baseFov = camera.userData.baseFov;
  if (warp.phase === 'dive') {
    const p = Math.min(1, warp.t / HYPERSPACE.diveTime);
    const e = p * p * p; // "ease in": starts slow and ends REALLY fast
    camera.position.lerpVectors(warp.from, warp.to, e);
    // Rumble harder and harder as we speed up
    camera.position.x += (Math.random() - 0.5) * HYPERSPACE.shake * e;
    camera.position.y += (Math.random() - 0.5) * HYPERSPACE.shake * e;
    camera.lookAt(warp.lookAt);
    camera.fov = baseFov + HYPERSPACE.fovBoost * e;
    hyperspace.intensity = p;
    hyperspace.tunnel = (p - 0.7) / 0.3; // the tunnel fades in over the last part of the dive
    hyperspace.endGlow = hyperspace.tunnel * 0.8;
    ui.setWarpTint(p * 0.85);
    if (p >= 1) {
      warp.phase = 'tunnel';
      warp.t = 0;
      ui.bigPop('WARP SPEED!', 'milestone');
      ui.showWarpCard(warpCardInfo());
    }
  } else if (warp.phase === 'tunnel') {
    const p = Math.min(1, warp.t / HYPERSPACE.tunnelTime);
    hyperspace.intensity = 1;
    hyperspace.tunnel = 1;
    hyperspace.endGlow = 0.8 + 0.2 * p; // the light at the end gets brighter
    camera.fov = baseFov + HYPERSPACE.fovBoost * (0.85 + 0.15 * Math.sin(warp.t * 9)); // pulsing
    ui.setWarpTint(0.45 + 0.2 * Math.sin(warp.t * 6));
    // Into the light: flash white and build the next world while the screen is white.
    if (!warp.flashed && warp.t > HYPERSPACE.tunnelTime - 0.6) {
      warp.flashed = true;
      ui.hideWarpCard();
      ui.flash(arriveInNextLevel);
    }
  } else {
    const p = Math.min(1, warp.t / HYPERSPACE.arriveTime);
    const e = 1 - (1 - p) * (1 - p) * (1 - p); // "ease out": fast at first, then gently
    camera.fov = baseFov + HYPERSPACE.fovBoost * (1 - e);
    hyperspace.intensity = 1 - p;
    hyperspace.tunnel = 1 - p * 4; // the tunnel is gone almost right away
    hyperspace.endGlow = hyperspace.tunnel;
    ui.setWarpTint((1 - p) * 0.85);
    if (p >= 1) {
      // Arrived! Hand control back to the player.
      stopWarp();
      ui.showToast(`Level ${game.levelIndex + 1}: ${getLevel().name}`, 2.5);
      go(); // no countdown after hyperspace: you arrive already moving, so just GO!
    }
  }
  camera.updateProjectionMatrix();
}

// Ends (or cancels) the warp and puts everything back to normal.
function stopWarp() {
  warp = null;
  hyperspace.intensity = 0;
  hyperspace.tunnel = 0;
  hyperspace.endGlow = 0;
  if (camera.userData.baseFov) {
    camera.fov = camera.userData.baseFov;
    camera.updateProjectionMatrix();
  }
  ui.setWarpTint(0);
  ui.hideWarpCard();
  ui.setWarpMode(false);
}

// What the little card in the tunnel shows.
function warpCardInfo() {
  return {
    levelName: getLevel().name,
    nextName: LEVELS[game.levelIndex + 1].name,
    stars: starsEarned().earned.filter(Boolean).length,
    points: levelResult.total,
    runTotal: game.runTotal,
  };
}

// "Scores" button: stop in the tunnel and show the full score breakdown.
function holdWarp() {
  if (!warp || warp.phase !== 'tunnel' || warp.flashed) return;
  warp.held = true;
  ui.hideWarpCard();
  ui.showLevelComplete(levelResult, game.runTotal, getLevel().name, LEVELS[game.levelIndex + 1].name, starsEarned());
}

// "Keep warping": back into the tunnel, with a moment left before the flash.
function continueWarp() {
  if (!warp || !warp.held) return;
  warp.held = false;
  warp.t = Math.min(warp.t, HYPERSPACE.tunnelTime - 1.2);
  ui.hideMenu();
}

// Called while the screen is white: build the next world and put the bobber at its start.
function arriveInNextLevel() {
  if (!warp) return; // (quit to the title during the flash)
  game.levelIndex++;
  game.reset(); // new score and timer for this level; lives carry over
  beginLevel();
  game.state = 'warping'; // ...but keep warping until we've slowed down
  intro = null; // (no swoop: the warp is the intro)
  ui.showCountdown('');
  bobber.setControlsEnabled(false);
  ui.setWarpMode(true);
  warp.phase = 'arrive';
  warp.t = 0;
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
  else ui.showTitle(loadBestScores(), settings, LEVELS, loadStars());
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
  const result = game.finalScore(combo.best);
  game.runTotal += result.total;
  const stars = starsEarned();
  recordStars(game.levelIndex, stars.earned.filter(Boolean).length);
  levelResult = result;
  if (LEVELS[game.levelIndex + 1]) {
    enterPortal(); // straight into hyperspace: the scores show on the way
  } else {
    const isNewBest = recordScore(settings.difficulty, game.runTotal);
    ui.showVictory(result, game.runTotal, isNewBest, loadBestScores()[settings.difficulty], stars);
  }
}

// The 3 stars for a world: finish it, get a big combo, and don't lose a life.
function starsEarned() {
  return {
    earned: [true, combo.best >= STARS.comboGoal, game.lives >= livesAtLevelStart],
    goals: ['Reach the portal', `Get a ${STARS.comboGoal}+ combo`, "Don't lose a life"],
  };
}

function showGameOver() {
  const total = game.runScoreSoFar();
  const isNewBest = recordScore(settings.difficulty, total);
  ui.showGameOver(total, combo.best, getLevel().name, isNewBest);
}

// ----- Menu buttons -----
ui.on('play', () => startGame(0));
ui.on('playLevel', (index) => startGame(Number(index)));
ui.on('holdWarp', holdWarp);
ui.on('continueWarp', continueWarp);
ui.on('settings', openSettings);
ui.on('back', closeSettings);
ui.on('resume', togglePause);
ui.on('pause', togglePause);
ui.on('quit', goToTitle);
ui.on('restart', restartLevel);
// On-screen touch buttons
ui.on('jumpDown', () => bobber.setJumpButton(true));
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
  ui.setLives(game.lives, game.maxLives);
  ui.setScore(0);
  ui.setTimer(formatTime(0));
  ui.setProgress(0);
  ui.setProgressTicks(course.progressTicks());
  ui.setCombo(0, 1, 0);
}

// Adds points to the score and shows the little "+10" pop.
function scorePoints(amount) {
  ui.setScore(game.currentScore());
  ui.popPoints(amount);
}

// ---------------------------------------------------------------------------
// The combo
// ---------------------------------------------------------------------------
// Shows and plays what happened when the combo grew (from combo.add()).
function comboFeedback(result) {
  if (result.multiplierUp) {
    playMultiplierUp(combo.multiplier);
    ui.bigPop(`×${combo.multiplier} COMBO!`);
  }
  if (result.milestone) {
    ui.bigPop(result.milestone, 'milestone');
    effects.sparkle(bobber.position.x, bobber.mesh.position.y + 2, bobber.position.z, true);
  }
}

// Called every frame: the combo timer counts down, and the HUD shows it.
// The bigger the multiplier, the more the screen sparkles and glows.
function updateCombo(dt) {
  if (game.state === 'playing') {
    const lost = combo.update(dt); // how big the combo was when it ran out (0 = still going)
    if (lost >= COMBO.perStep) playComboBreak();
  }
  ui.setCombo(combo.count, combo.multiplier, combo.timerFraction);
  // 0 at ×1, up to 1 at the top multiplier
  const level = combo.count > 0 ? (combo.multiplier - 1) / (COMBO.maxMultiplier - 1) : 0;
  if (game.state === 'playing') effects.comboAura(dt, bobber.mesh.position, level);
  ui.setComboGlow(Math.min(1, level * 1.5));
}

// ---------------------------------------------------------------------------
// Ring gates and the portal
// ---------------------------------------------------------------------------
let portalOpen = false; // has this level's portal opened yet?

function updateCourse(dt, time) {
  const rings = course.update(dt, time, previousPosition, bobber.position, bobber.mesh.position.y, game.state === 'playing');
  for (const r of rings) {
    // Through a ring: points (times the combo), a combo boost and a free zap.
    const result = combo.add(RINGS.comboBoost);
    scorePoints(game.addRing(combo.multiplier));
    shooter.addAmmo(RINGS.zaps);
    playChime();
    bobber.boing(1.5);
    shakeTimer = Math.max(shakeTimer, EFFECTS.shakeTime * 0.4);
    effects.sparkle(r.x, r.y, r.z, true);
    ui.bigPop('RING!', 'ring');
    comboFeedback(result);
    ui.setProgressTicks(course.progressTicks());
    tip('ring', 'Ring gates give <b>big points</b>, a combo boost and a free zap.');
  }
  // The portal opens once you're far enough along the course.
  if (game.state === 'playing' && !portalOpen && bobber.position.z < getLevel().finishZ * PORTAL.openAt) {
    portalOpen = true;
    world.openPortal();
    playMultiplierUp(6);
    ui.bigPop('PORTAL OPEN!', 'ring');
    tip('portal', 'The <b>portal</b> is open at the end of the course. Ride into it to finish the world!');
  }
  // Close to the open portal, it pulls you toward its middle (so you can't miss it).
  const toPortal = bobber.position.z - getLevel().finishZ;
  if (game.state === 'playing' && portalOpen && toPortal > 0 && toPortal < PORTAL.pullDistance) {
    const closeness = 1 - toPortal / PORTAL.pullDistance; // 0 far away → 1 at the portal
    const middleX = lakeCenterX(getLevel().finishZ);
    bobber.position.x += (middleX - bobber.position.x) * (1 - Math.exp(-PORTAL.pullStrength * closeness * dt));
  }
  if (game.state === 'playing' && course.reachedPortal(previousPosition, bobber.position)) {
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
  // Trails are laid out on the title screen too, as scenery.
  const canSpawn = playing || game.state === 'title';
  const picked = coins.update(dt, time, bobber, obstacles.isClear, canSpawn, playing && !game.isRespawning());
  for (const p of picked) {
    effects.sparkle(p.x, p.y, p.z, p.kind !== 'coin');
    if (p.kind === 'zapPack') {
      playReload();
      shooter.addAmmo(SHOOT.packAmount);
      ui.showToast(`⚡ Zap Pack! +${SHOOT.packAmount} zaps`);
    } else {
      // Coins and Golden Lures build the combo. Each "ding" is a little higher than the last!
      const result = combo.add(p.golden ? 2 : 1);
      playComboDing(combo.count);
      bobber.addRush(); // each coin gives a little burst of speed
      tip('combo', 'Stay lined up and grab the <b>whole trail</b> for a PERFECT TRAIL bonus. Every 5 coins in a row raises your <b>multiplier</b>!');
      bobber.boing(p.golden ? 1.5 : 0.6);
      if (p.golden) {
        playGoldenDing();
        scorePoints(game.addGoldenLure(combo.multiplier));
        ui.bigPop('GOLDEN LURE!', 'ring');
      } else {
        scorePoints(game.addCoin(combo.multiplier));
      }
      comboFeedback(result);
      if (p.perfect) {
        // Got every coin in the trail!
        scorePoints(game.addPerfectTrail(combo.multiplier));
        playMultiplierUp(4);
        bobber.addRush(RUNNER.rushMax); // full speed rush!
        ui.bigPop('PERFECT TRAIL!', 'milestone');
        effects.sparkle(p.x, p.y, p.z, true);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Catch & stack: caught fish go into the cooler
// ---------------------------------------------------------------------------
function updateCatching(dt, time) {
  const playing = game.state === 'playing';
  for (const f of catchFish.update(dt, time, bobber, playing && !game.isRespawning())) {
    catchIntoCooler(f.color, f.x, f.y, f.z);
  }
  if (playing) cooler.update(dt);
}

function catchIntoCooler(color, x, y, z) {
  game.catchCount++;
  bobber.boing(1);
  cooler.add(color);
  playCatch();
  tip('cooler', 'Caught one! Line up <b>3 of the same color</b> in your cooler to POP them. Don\'t let it fill up!');
  effects.splash(x, Math.max(0, y - 0.3), z, 0.4);
  effects.sparkle(x, y + 0.5, z);
}

// Three (or more) of a color in a row popped in the cooler.
function coolerPopped(fishPopped, chain) {
  const result = combo.add(CATCH.popComboBoost);
  scorePoints(game.addCoolerPop(fishPopped, chain, combo.multiplier));
  playCoolerPop(chain);
  ui.bigPop(chain > 1 ? `CHAIN ×${chain}!` : 'POP!', 'pop');
  if (chain > 1) shakeTimer = EFFECTS.shakeTime * 0.6;
  comboFeedback(result);
}

// The cooler filled to the top with nothing to pop: it dumps, and the combo is lost.
function coolerOverflowed() {
  playOverflow();
  if (combo.break() > 0) playComboBreak();
  ui.bigPop('COOLER FULL!', 'bad');
  shakeTimer = EFFECTS.shakeTime;
}

// ---------------------------------------------------------------------------
// Zapping
// ---------------------------------------------------------------------------
// Zaps can hit obstacles or the little catchable fish.
const zapTargets = {
  zap: (x, y, z, r) => obstacles.zap(x, y, z, r) || catchFish.zap(x, y, z, r),
};

function updateShooting(dt, time) {
  const canShoot = game.state === 'playing' && !game.isRespawning();
  const shots = shooter.update(dt, time, bobber, zapTargets, canShoot);
  if (shots.fired) playZap();
  for (const z of shots.zapped) {
    if (z.type !== 'catch') {
      // Poof! The obstacle disappears in a burst of sparkles and a splash.
      effects.sparkle(z.x, z.y + 0.5, z.z, true);
      effects.splash(z.x, Math.max(0, z.y), z.z, 0.5);
      playPoof();
      scorePoints(game.addZap());
    }
    // Colored fish (bass, pike, and the little schools) get caught into the cooler.
    if (z.color !== undefined) catchIntoCooler(z.color, z.x, z.y, z.z);
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

// ---------------------------------------------------------------------------
// The black hole (Space Lakes): fall into a gap and spiral down into it
// ---------------------------------------------------------------------------
let holeFall = null; // the fall in progress (null when not falling in)

function startBlackHoleFall() {
  game.state = 'blackhole';
  bobber.setControlsEnabled(false);
  ui.setWarpMode(true); // hide the HUD: it's a movie moment
  playBlackHole(BLACK_HOLE.fallTime);
  holeFall = { t: 0, start: world.blackHole.startFall(scene, bobber.mesh.position), flashed: false };
}

const holeAway = new THREE.Vector3();
const holeLook = new THREE.Vector3();
function updateBlackHoleFall(dt) {
  holeFall.t += dt;
  const p = Math.min(1, holeFall.t / BLACK_HOLE.fallTime); // 0 → 1 over the whole fall
  const hole = world.blackHole.center;

  // The bobber follows its spiral, tumbling faster and shrinking at the very end.
  const spot = world.blackHole.updateFall(dt, p, holeFall.start);
  bobber.mesh.position.copy(spot);
  bobber.mesh.rotation.x += dt * (3 + 14 * p);
  bobber.mesh.rotation.z += dt * (2 + 10 * p);
  bobber.mesh.scale.setScalar(Math.max(0.05, 1 - p * p * p));

  // The camera chases the bobber from just outside its spiral (the direction pointing
  // away from the hole), getting closer as it falls, and looks past it into the hole.
  holeAway.set(spot.x - hole.x, 0, spot.z - hole.z);
  if (holeAway.lengthSq() < 1) holeAway.set(0, 0, 1);
  holeAway.normalize();
  wantedPosition.copy(spot).addScaledVector(holeAway, 13 - 6 * p);
  wantedPosition.y += 8 - 4 * p;
  camera.position.lerp(wantedPosition, 1 - Math.exp(-12 * dt));
  holeLook.copy(spot).lerp(hole, 0.2 + 0.4 * p);
  camera.lookAt(holeLook);
  camera.fov = camera.userData.baseFov + 30 * p; // the view stretches as you're pulled in
  camera.updateProjectionMatrix();
  ui.setWarpTint(p * 0.7);

  // Swallowed: flash, then lose a life (and respawn back on the lake).
  if (p >= 1 && !holeFall.flashed) {
    holeFall.flashed = true;
    ui.flash(() => {
      world.blackHole.endFall();
      holeFall = null;
      camera.fov = camera.userData.baseFov;
      camera.updateProjectionMatrix();
      ui.setWarpTint(0);
      ui.setWarpMode(false);
      game.state = 'playing';
      loseALife('Swallowed by a black hole!');
    });
  }
}

// Fell into a gap between lakes (in worlds without a black hole).
function fellIntoSpace() {
  if (game.state !== 'playing' || game.isRespawning()) return;
  playFall();
  loseALife(getTheme().fallMessage);
}

// Where the last life was lost (the bobber comes back a little behind this spot).
let lostLifeAtZ = 0;

function loseALife(message) {
  lostLifeAtZ = bobber.position.z;
  // Getting hit breaks your combo.
  if (combo.break() >= COMBO.perStep) playComboBreak();
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

// After the short splash pause: back on the lake a little behind where it happened,
// blinking and safe for a moment.
function respawn() {
  const spot = course.respawnPoint(lostLifeAtZ);
  bobber.reset(spot.x, spot.z);
  bobber.setControlsEnabled(true);
  game.startInvincible();
  snapCamera();
  const touch = document.body.classList.contains('touch');
  tip('zap', touch ? 'Tap <b>Zap</b> to blast obstacles out of your way.' : 'Press <b>F</b> to zap obstacles out of your way.');
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
  // (During a big leap the bobber is very fast, so the camera keeps up more tightly.)
  const followSpeed = bobber.flight.leaping ? CAMERA.leapFollowSpeed : CAMERA.followSpeed;
  const t = 1 - Math.exp(-followSpeed * dt);
  cameraBase.lerp(wantedPosition, t);
  cameraLookAt.lerp(wantedLookAt, t);
  // Rushing (grabbing lots of coins): the view widens a little, so it FEELS faster.
  const wantedFov = camera.userData.baseFov + bobber.rush * RUNNER.rushFov;
  if (Math.abs(camera.fov - wantedFov) > 0.01) {
    camera.fov += (wantedFov - camera.fov) * t;
    camera.updateProjectionMatrix();
  }
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
  if (game.state === 'blackhole') {
    gameTime += dt;
    world.update(gameTime);
    effects.update(dt, gameTime, bobber, false);
    if (holeFall) updateBlackHoleFall(dt);
    return;
  }
  if (game.state === 'warping') {
    // During hyperspace only the scenery moves; the warp controls the camera.
    gameTime += dt;
    world.update(gameTime);
    if (warp.phase === 'arrive') {
      bobber.update(dt, gameTime);
      updateCamera(dt);
    }
    updateWarp(dt);
    return;
  }
  gameTime += dt;
  const time = gameTime;
  world.update(time);
  obstacles.update(dt, time, bobber, game.isInvincible()); // also lets lily pads / whirlpools push the bobber
  if (game.isRespawning()) bobber.velocity.set(0, 0, 0); // stay put while "under water"
  if (wildlife) wildlife.update(dt, bobber.position);
  const wakeOn = game.state === 'playing' && !game.isRespawning() && bobber.onWater;
  effects.update(dt, time, bobber, wakeOn);
  updateCoins(dt, time);
  updateCatching(dt, time);

  previousPosition.copy(bobber.position); // remember where we were, to detect crossing lines
  const flightEvent = bobber.update(dt, time);
  // Falling into a gap in Space Lakes: the black hole pulls you in!
  if (world.blackHole && bobber.flight.falling && game.state === 'playing' && !game.isRespawning()) {
    startBlackHoleFall();
    return;
  }
  if (flightEvent && flightEvent.fell) fellIntoSpace();
  if (flightEvent && flightEvent.jumped) playJump();
  if (flightEvent && flightEvent.leaped) {
    playLeap();
    ui.bigPop('BIG LEAP!', 'ring');
  }
  if (flightEvent && flightEvent.landed && game.state === 'playing') {
    // Splashing down after a jump
    effects.splash(bobber.position.x, bobber.mesh.position.y - BOBBER.floatOffset, bobber.position.z, 0.6);
    playPlop();
  }
  updateShooting(dt, time);
  updateCourse(dt, time);
  updateCombo(dt);
  checkForHits();

  // The race timer starts the moment the bobber leaves the dock.
  if (!game.timerRunning && bobber.position.z < BOBBER.startZ - 1) game.timerRunning = true;
  if (game.update(dt)) respawn(); // true when the respawn wait just finished
  ui.setTimer(formatTime(game.time));
  ui.setProgress(bobber.position.z / getLevel().finishZ);
  if (game.state === 'playing' && !game.isRespawning()) bobber.setVisible(game.blinkVisible());

  updateTips();
  if (game.state === 'countdown') updateCountdown(dt);
  else updateCamera(dt);
  followWithSun(bobber.position);
}

// The browser calls loop() before every screen refresh and tells it the current time (ms).
function loop(now = performance.now()) {
  // Seconds since the last frame. Capped so a slow frame (or switching tabs)
  // doesn't make things jump.
  const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;
  step(Math.max(0, dt));
  // Portal hum: fades in over the last 80 units before the portal.
  const toPortal = Math.abs(bobber.position.z - getLevel().finishZ);
  setPortalHum(game.state === 'playing' ? Math.max(0, 1 - toPortal / 80) : 0);
  renderer.render(scene, camera);
  // Hyperspace streaks are drawn on top of the game (clearing only the depth, so the
  // game picture stays and the streaks appear in front of it).
  if (hyperspace.active) {
    hyperspace.update(dt);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(hyperspace.scene, hyperspace.camera);
    renderer.autoClear = true;
  }
  requestAnimationFrame(loop);
}
loop();
