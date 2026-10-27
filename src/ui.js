// ui.js
// Everything drawn on top of the 3D view with HTML and CSS:
//   - the HUD (heads-up display): three panels (score + combo, world + timer + progress,
//     lives + zaps + cooler)
//   - the menus: title screen, settings, pause, game over and victory
//   - little pop-up notes ("toasts")
//
// Menu buttons don't run game code themselves. They "announce" an action
// (like 'play' or 'settings'), and main.js decides what to do: ui.on('play', startGame).

import { formatTime } from './game.js';
import { DIFFICULTY, SETTINGS_LIMITS } from './config.js';
import { isTouchDevice } from './device.js';

// Small line icons drawn with SVG (simple shapes described in code, like a mini drawing
// language), so the buttons look crisp at any size without image files.
const icon = (path) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const ICONS = {
  pause: icon('<path d="M9 5v14M15 5v14"/>'),
  play: icon('<path d="M7 5l12 7-12 7z" fill="currentColor"/>'),
  restart: icon('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>'),
  soundOn: icon('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"/>'),
  soundOff: icon('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  jump: icon('<path d="M12 19V6M6 11l6-6 6 6"/>'),
  zap: icon('<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>'),
};

export function createUI() {
  // ----- Announcing actions to main.js -----
  const listeners = {};
  function on(action, callback) {
    (listeners[action] = listeners[action] || []).push(callback);
  }
  function emit(action, data) {
    (listeners[action] || []).forEach((cb) => cb(data));
  }

  // ----- The in-game HUD: three tidy panels in one layer -----
  //   left:   the game's name, your score and the combo meter
  //   top:    world name, timer and the progress bar to the portal
  //   right:  lives, zaps and the cooler
  const hudLayer = document.createElement('div');
  hudLayer.className = 'hud-layer';
  hudLayer.innerHTML = `
    <div class="panel hud-left">
      <div class="brand">Bobber Run<span>by Eliott</span></div>
      <div class="score" id="score"><span id="score-value">0</span><span class="score-label">pts</span></div>
      <div class="combo hidden" id="combo">
        <div class="combo-top"><span class="combo-fire">Combo</span><span class="combo-mult" id="combo-mult">×1</span>
          <span class="combo-count" id="combo-count">0 in a row</span></div>
        <div class="combo-track"><div class="combo-fill" id="combo-fill"></div></div>
      </div>
    </div>
    <div class="panel hud-top">
      <div class="hud-top-row"><span id="level-name"></span><span class="dot">·</span><span class="clock"><span id="timer">0:00.0</span></span></div>
      <div class="progress">
        <span class="progress-end start"></span>
        <div class="progress-track" id="progress-track">
          <div class="progress-fill" id="progress-fill"></div>
          <div class="progress-marker" id="progress-marker"></div>
        </div>
        <span class="progress-end finish"></span>
      </div>
    </div>
    <div class="panel hud-right">
      <div class="lives" id="lives"></div>
      <div class="ammo" id="ammo"></div>
      <div class="cooler"><div class="cooler-label">Cooler</div><canvas id="cooler-canvas"></canvas></div>
    </div>
    <div class="toast hidden" id="toast"></div>`;
  document.body.appendChild(hudLayer);
  const score = hudLayer.querySelector('#score');
  const comboBox = hudLayer.querySelector('#combo');
  const coolerBox = hudLayer.querySelector('.cooler');
  const lives = hudLayer.querySelector('#lives');
  const ammo = hudLayer.querySelector('#ammo');
  const toast = hudLayer.querySelector('#toast');
  let shownCount = 0;
  let shownAmmo = -1;
  let toastTimer = null;

  // A soft dark edge around the screen that pulls your eye to the middle.
  const vignette = document.createElement('div');
  vignette.className = 'vignette';
  document.body.appendChild(vignette);

  // The big "3, 2, 1, GO!" numbers at the start of a level.
  const countdown = document.createElement('div');
  countdown.className = 'countdown hidden';
  document.body.appendChild(countdown);

  // First-time tips: a friendly card near the bottom of the screen.
  const tip = document.createElement('div');
  tip.className = 'tip';
  document.body.appendChild(tip);
  let tipTimer = null;

  // The little score card that shows while you zoom through the hyperspace tunnel.
  const warpCard = document.createElement('div');
  warpCard.className = 'warp-card hidden';
  document.body.appendChild(warpCard);
  warpCard.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (button) emit(button.dataset.action);
  });

  // Big words that burst onto the middle of the screen ("×3 COMBO!", "RING!", "AWESOME!").
  const pops = document.createElement('div');
  pops.className = 'big-pops';
  document.body.appendChild(pops);

  // A blue, glowing-edges layer for hyperspace.
  const warpTint = document.createElement('div');
  warpTint.className = 'warp-tint';
  document.body.appendChild(warpTint);

  // A golden glow around the screen edges that gets stronger with your combo.
  const comboGlow = document.createElement('div');
  comboGlow.className = 'combo-glow';
  document.body.appendChild(comboGlow);

  // A full-screen white layer used for the portal "warp" flash.
  const flashOverlay = document.createElement('div');
  flashOverlay.className = 'flash';
  document.body.appendChild(flashOverlay);

  // The menu panel in the middle of the screen. Its contents change for each screen.
  const menu = document.createElement('div');
  menu.className = 'menu hidden';
  document.body.appendChild(menu);
  // Any click on something with data-action="..." announces that action.
  menu.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (button) emit(button.dataset.action, button.dataset.value);
  });

  // Pause and Restart buttons in the top-right corner (part of the HUD layer).
  const buttons = document.createElement('div');
  buttons.className = 'top-buttons';
  const pauseButton = document.createElement('button');
  pauseButton.className = 'hud-button';
  pauseButton.innerHTML = ICONS.pause + '<span class="label">Pause</span>';
  pauseButton.title = 'Pause (P or Esc)';
  const restartButton = document.createElement('button');
  restartButton.className = 'hud-button';
  restartButton.innerHTML = ICONS.restart + '<span class="label">Restart</span>';
  restartButton.title = 'Restart (R)';
  buttons.append(pauseButton, restartButton);
  hudLayer.appendChild(buttons);

  // Mute button in the bottom-left corner (shown on every screen, even the title).
  const muteButton = document.createElement('button');
  muteButton.className = 'hud-button mute-button';
  muteButton.title = 'Sound on/off (M)';
  document.body.appendChild(muteButton);
  muteButton.addEventListener('click', () => {
    emit('mute');
    muteButton.blur();
  });

  // ----- Touchscreen buttons: JUMP (tap) and ZAP (hold to keep firing) -----
  // They only show on touch devices (the "touch" class on the page turns them on).
  if (isTouchDevice) document.body.classList.add('touch');
  // A laptop with a touchscreen: show them the first time someone touches the screen.
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') document.body.classList.add('touch');
  });
  const touchControls = document.createElement('div');
  touchControls.className = 'touch-controls';
  touchControls.innerHTML = `
    <button class="touch-btn zap-btn" aria-label="Zap">${ICONS.zap}<span>Zap</span></button>
    <button class="touch-btn jump-btn" aria-label="Jump">${ICONS.jump}<span>Jump</span></button>`;
  document.body.appendChild(touchControls);
  // Each button announces when it's pressed and let go. "Pointer capture" keeps
  // listening to that finger even if it slides off the button a little.
  function holdButton(button, name) {
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      button.classList.add('down');
      emit(name + 'Down');
      try {
        button.setPointerCapture(e.pointerId);
      } catch (err) {
        // Some browsers can't capture this pointer; the button still works without it.
      }
    });
    const release = () => {
      button.classList.remove('down');
      emit(name + 'Up');
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }
  holdButton(touchControls.querySelector('.jump-btn'), 'jump');
  holdButton(touchControls.querySelector('.zap-btn'), 'zap');
  // No long-press menus on the game.
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  pauseButton.addEventListener('click', () => {
    emit('pause');
    pauseButton.blur(); // so pressing keys later doesn't "click" it again
  });
  restartButton.addEventListener('click', () => {
    emit('restart');
    restartButton.blur();
  });

  // Puts new HTML in the menu panel and shows it.
  function showMenu(html, className = '') {
    menu.className = 'menu ' + className;
    menu.innerHTML = html;
  }

  // Three stars (filled in for the ones earned), plus the list of goals.
  // stars = { earned: [true, false, true], goals: ['Reach the portal', ...] }
  function starsHTML(stars) {
    if (!stars) return '';
    const icons = stars.earned.map((e) => `<span class="star ${e ? 'earned' : ''}">★</span>`).join('');
    const goals = stars.goals.map((g, i) => `<li class="${stars.earned[i] ? 'done' : ''}">${g}</li>`).join('');
    return `<div class="stars">${icons}</div><ul class="goals">${goals}</ul>`;
  }

  function bestScoresHTML(best) {
    return Object.keys(DIFFICULTY)
      .map((d) => `<div class="best"><span>${DIFFICULTY[d].label}</span><b>${best[d] || '–'}</b></div>`)
      .join('');
  }

  return {
    on,
    coolerCanvas: coolerBox.querySelector('canvas'),

    // On the title screen the in-game HUD is hidden.
    setTitleMode(on) {
      document.body.classList.toggle('title-mode', on);
    },

    // levels = the LEVELS list from config.js, for the "jump to a level" buttons.
    // stars = the most stars earned in each world, e.g. [3, 1, 0, 0].
    showTitle(best, settings, levels, stars = []) {
      // One card per world, with the stars you've earned there.
      const worldCards = levels
        .map((lvl, i) => {
          const n = stars[i] || 0;
          return `<button class="world-card" data-action="playLevel" data-value="${i}">
            <span class="world-number">${i + 1}</span>
            <span class="world-name">${lvl.name}</span>
            <span class="world-stars">${'★'.repeat(n)}<i>${'★'.repeat(3 - n)}</i></span>
          </button>`;
        })
        .join('');
      const touch = document.body.classList.contains('touch');
      showMenu(
        `<div class="title-head">
          <div class="eyebrow">A fishing run by Eliott</div>
          <h1 class="big-title">Bobber Run</h1>
          <p class="howto">${
            touch
              ? 'Drag left and right to steer · tap <b>Jump</b> · tap <b>Zap</b>'
              : 'Point left and right to steer · <b>Space</b> jump · <b>F</b> zap · <b>↑</b> boost'
          }</p>
        </div>
        <button class="primary play-button" data-action="play">Play</button>
        ${touch && window.innerHeight > window.innerWidth ? '<p class="note">Turn your phone sideways for a bigger view</p>' : ''}
        <div class="section-label">Worlds</div>
        <div class="world-cards">${worldCards}</div>
        <div class="title-footer">
          <button class="small-button" data-action="settings">Settings</button>
          <span class="difficulty-now">${DIFFICULTY[settings.difficulty].label}</span>
          <span class="spacer"></span>
          <div class="bests"><span>Best</span>${bestScoresHTML(best)}</div>
        </div>`,
        'title-menu'
      );
    },

    // note = an extra line at the bottom (used when opened from the pause menu).
    showSettings(settings, note = '') {
      const L = SETTINGS_LIMITS;
      const difficultyButtons = Object.keys(DIFFICULTY)
        .map((d) => `<button class="choice ${d === settings.difficulty ? 'selected' : ''}"
          data-action="difficulty" data-value="${d}">${DIFFICULTY[d].label}</button>`)
        .join('');
      showMenu(
        `<h1>Settings</h1>
        <label class="setting">
          <span>Bobber Speed <b id="speed-value">${settings.speed}</b></span>
          <input type="range" id="speed-slider" min="${L.speedMin}" max="${L.speedMax}" value="${settings.speed}">
        </label>
        <label class="setting">
          <span>Number of Obstacles <b id="obstacles-value">${settings.obstacles}</b></span>
          <input type="range" id="obstacles-slider" min="${L.obstaclesMin}" max="${L.obstaclesMax}" value="${settings.obstacles}">
        </label>
        <div class="setting">
          <span>Difficulty</span>
          <div class="choices">${difficultyButtons}</div>
          <div class="difficulty-description">${DIFFICULTY[settings.difficulty].description}</div>
        </div>
        ${note ? `<p class="note">${note}</p>` : ''}
        <div class="menu-buttons"><button class="primary" data-action="back">Done</button></div>`
      );
      // Sliders announce their new value while being dragged.
      const speed = document.getElementById('speed-slider');
      const obstacles = document.getElementById('obstacles-slider');
      speed.addEventListener('input', () => {
        document.getElementById('speed-value').textContent = speed.value;
        emit('speed', Number(speed.value));
      });
      obstacles.addEventListener('input', () => {
        document.getElementById('obstacles-value').textContent = obstacles.value;
        emit('obstacles', Number(obstacles.value));
      });
    },

    showPause() {
      showMenu(
        `<h1>Paused</h1>
        <div class="menu-buttons column">
          <button class="primary" data-action="resume">Resume</button>
          <button data-action="settings">Settings</button>
          <button data-action="quit">Quit to title</button>
        </div>
        <p class="note">Press P or Esc to keep going</p>`
      );
    },

    showGameOver(score, bestCombo, levelName, isNewBest) {
      showMenu(
        `<h1>Game Over</h1>
        ${isNewBest ? '<div class="new-best">New best!</div>' : ''}
        <p class="big-number">${score} <span>points</span></p>
        <p>Made it to <b>${levelName}</b> · best combo <b>${bestCombo}</b></p>
        <div class="menu-buttons">
          <button class="primary" data-action="play">Play again</button>
          <button data-action="quit">Title</button>
        </div>`
      );
    },

    // Through a portal with more levels to go.
    showLevelComplete(breakdown, runTotal, levelName, nextName, stars) {
      showMenu(
        `<h1>${levelName} complete!</h1>
        ${starsHTML(stars)}
        ${this.resultsTable(breakdown)}
        <p>Run total so far: <b>${runTotal}</b></p>
        <div class="menu-buttons">
          <button class="primary" data-action="continueWarp">Continue to ${nextName}</button>
          <button data-action="quit">Title</button>
        </div>`
      );
    },

    // Through the last portal: the whole run is done!
    showVictory(breakdown, runTotal, isNewBest, best, stars) {
      showMenu(
        `<h1>You beat every world!</h1>
        ${starsHTML(stars)}
        ${this.resultsTable(breakdown)}
        <p class="big-number">${runTotal} <span>points total</span></p>
        ${isNewBest ? '<div class="new-best">New best!</div>' : `<div class="note">Best: ${best}</div>`}
        <div class="menu-buttons">
          <button class="primary" data-action="play">Play again</button>
          <button data-action="quit">Title</button>
        </div>`
      );
    },

    hideMenu() {
      menu.classList.add('hidden');
    },

    // The warp: the screen fades to white, middle() runs (loading the next level),
    // then it fades back in.
    flash(middle) {
      flashOverlay.classList.add('on');
      setTimeout(() => {
        middle();
        flashOverlay.classList.remove('on');
      }, 600);
    },

    // info = { levelName, nextName, stars (0-3), points, runTotal }
    showWarpCard(info) {
      warpCard.innerHTML = `
        <div class="warp-card-title">${info.levelName} complete!</div>
        <div class="warp-card-stars">${'<span class="star earned">★</span>'.repeat(info.stars)}${'<span class="star">★</span>'.repeat(3 - info.stars)}</div>
        <div class="warp-card-points">+${info.points}<span> · run total ${info.runTotal}</span></div>
        <div class="warp-card-next">Next stop: <b>${info.nextName}</b></div>
        <div class="warp-card-buttons">
          <button data-action="holdWarp">Scores</button>
          <button data-action="quit">Title</button>
        </div>`;
      warpCard.classList.remove('hidden');
    },
    hideWarpCard() {
      warpCard.classList.add('hidden');
    },

    // Hide the HUD during the hyperspace jump, so it looks like a movie scene.
    setWarpMode(on) {
      document.body.classList.toggle('warping', on);
    },

    // A blue glow over the whole screen during hyperspace (0 = none, 1 = strongest).
    setWarpTint(amount) {
      warpTint.style.opacity = amount;
    },

    setLevelName(name) {
      document.getElementById('level-name').textContent = name;
    },

    setMuted(muted) {
      muteButton.innerHTML = (muted ? ICONS.soundOff : ICONS.soundOn) + `<span class="label">${muted ? 'Sound off' : 'Sound on'}</span>`;
    },

    // The pause button's label switches between Pause and Resume.
    setPaused(paused) {
      pauseButton.innerHTML = paused ? ICONS.play + '<span class="label">Resume</span>' : ICONS.pause + '<span class="label">Pause</span>';
    },

    // Show "left" full bobbers and the rest as faded ones, out of "max".
    setLives(left, max) {
      lives.innerHTML = '';
      for (let i = 0; i < max; i++) {
        const icon = document.createElement('span');
        icon.className = i < left ? 'life' : 'life lost';
        lives.appendChild(icon);
      }
    },
    // Builds the score breakdown table shown at the finish.
    resultsTable(b) {
      const row = (label, value, cls = '') => `<tr class="${cls}"><td>${label}</td><td>${value}</td></tr>`;
      return `<table>
        ${row(`Coins (${b.coinCount})`, b.coins)}
        ${row(`Golden Lures (${b.goldenCount})`, b.goldenLures)}
        ${row(`Perfect trails (${b.perfectCount})`, b.trails)}
        ${row(`Rings (${b.ringCount})`, b.rings)}
        ${b.zapCount ? row(`Zapped (${b.zapCount})`, b.zaps) : ''}
        ${row(`Cooler pops (${b.popCount} of ${b.catchCount} caught)`, b.cooler)}
        ${row('Best combo', b.bestCombo)}
        ${row('Finish', b.finish)}
        ${row(`Time bonus (${formatTime(b.seconds)})`, b.timeBonus)}
        ${row(`Lives bonus (${b.livesLeft} left)`, b.livesBonus)}
        ${row('Subtotal', b.subtotal)}
        ${row('Difficulty multiplier', '×' + b.multiplier)}
        ${row('Total', b.total, 'total')}
      </table>`;
    },
    setAmmo(left, max) {
      if (left === shownAmmo && max === ammo.childElementCount - 1) return; // only redraw when it changes
      shownAmmo = left;
      ammo.innerHTML = '<span class="ammo-label">Zaps</span>' +
        Array.from({ length: max }, (_, i) => `<span class="zap-dot ${i < left ? '' : 'empty'}"></span>`).join('');
    },
    setScore(value) {
      document.getElementById('score-value').textContent = value;
    },
    // A "+10" (or "-25") that floats up next to the score and fades.
    popPoints(amount) {
      const pop = document.createElement('div');
      pop.className = amount >= 0 ? 'points-pop' : 'points-pop negative';
      pop.textContent = (amount >= 0 ? '+' : '') + amount;
      score.appendChild(pop);
      setTimeout(() => pop.remove(), 1000);
    },
    setTimer(text) {
      document.getElementById('timer').textContent = text;
    },
    // fraction: 0 = at the dock, 1 = at the finish.
    setProgress(fraction) {
      const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 1000) / 10;
      document.getElementById('progress-fill').style.width = percent + '%';
      document.getElementById('progress-marker').style.left = percent + '%';
    },
    // Little ticks on the progress bar for each ring gate; rings you went through turn green.
    // ticks = [{ fraction (0 = start, 1 = portal), passed }]
    setProgressTicks(ticks) {
      const track = document.getElementById('progress-track');
      track.querySelectorAll('.progress-tick').forEach((t) => t.remove());
      for (const t of ticks) {
        const tick = document.createElement('div');
        tick.className = t.passed ? 'progress-tick passed' : 'progress-tick';
        tick.style.left = t.fraction * 100 + '%';
        track.appendChild(tick);
      }
    },

    // The combo meter. Hidden when there's no combo. It "bumps" bigger each time it grows.
    setCombo(count, multiplier, timerFraction) {
      comboBox.classList.toggle('hidden', count === 0);
      if (count !== shownCount) {
        document.getElementById('combo-mult').textContent = '×' + multiplier;
        document.getElementById('combo-count').textContent = `${count} in a row`;
        if (count > shownCount) {
          comboBox.classList.remove('bump');
          void comboBox.offsetWidth; // (restart the CSS animation)
          comboBox.classList.add('bump');
        }
        comboBox.dataset.level = Math.min(multiplier, 5); // the color gets hotter as it grows
        shownCount = count;
      }
      document.getElementById('combo-fill').style.width = Math.round(timerFraction * 100) + '%';
    },

    // How strong the combo glow around the screen is (0 = none, 1 = max multiplier).
    setComboGlow(amount) {
      comboGlow.style.opacity = amount;
    },

    // A big word bursting onto the screen. kind changes its color: '', 'ring' or 'milestone'.
    bigPop(text, kind = '') {
      const pop = document.createElement('div');
      pop.className = 'big-pop ' + kind;
      pop.textContent = text;
      pops.appendChild(pop);
      setTimeout(() => pop.remove(), 1100);
    },
    // One number of the countdown ("3", "2", "1" or "GO!"). Empty text hides it.
    showCountdown(text) {
      countdown.classList.toggle('hidden', !text);
      countdown.classList.toggle('go', text === 'GO!');
      countdown.textContent = text;
      countdown.classList.remove('tick');
      void countdown.offsetWidth; // (restart the CSS animation)
      countdown.classList.add('tick');
    },

    // A first-time tip card. html can use <b> for the important words.
    showTip(html, seconds) {
      tip.innerHTML = `<span class="tip-badge">Tip</span><span>${html}</span>`;
      tip.classList.add('show');
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => tip.classList.remove('show'), seconds * 1000);
    },
    hideTip() {
      clearTimeout(tipTimer);
      tip.classList.remove('show');
    },
    get tipShowing() {
      return tip.classList.contains('show');
    },

    // A short note that pops up and disappears by itself.
    showToast(text, seconds = 1.5) {
      toast.textContent = text;
      toast.classList.remove('hidden');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.add('hidden'), seconds * 1000);
    },
  };
}
