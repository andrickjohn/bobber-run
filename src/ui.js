// ui.js
// Everything drawn on top of the 3D view with HTML and CSS:
//   - the HUD (heads-up display): title, score, checkpoints, timer, lives, progress bar
//   - the menus: title screen, settings, pause, game over and victory
//   - little pop-up notes ("toasts")
//
// Menu buttons don't run game code themselves. They "announce" an action
// (like 'play' or 'settings'), and main.js decides what to do: ui.on('play', startGame).

import { formatTime } from './game.js';
import { DIFFICULTY, SETTINGS_LIMITS } from './config.js';

export function createUI() {
  // ----- Announcing actions to main.js -----
  const listeners = {};
  function on(action, callback) {
    (listeners[action] = listeners[action] || []).push(callback);
  }
  function emit(action, data) {
    (listeners[action] || []).forEach((cb) => cb(data));
  }

  // Game title in the top-left corner
  const title = document.createElement('div');
  title.className = 'title';
  title.innerHTML = `Bobber Run<span class="byline">by Eliott</span>`;
  document.body.appendChild(title);

  // Score, under the title
  const score = document.createElement('div');
  score.className = 'score';
  score.innerHTML = `<span id="score-value">0</span> <span class="score-label">points</span>`;
  document.body.appendChild(score);

  // Progress bar along the bottom: dock on the left, finish on the right
  const progress = document.createElement('div');
  progress.className = 'progress';
  progress.innerHTML = `
    <span class="progress-end">⚓</span>
    <div class="progress-track" id="progress-track">
      <div class="progress-fill" id="progress-fill"></div>
      <div class="progress-marker" id="progress-marker"></div>
    </div>
    <span class="progress-end">🏁</span>`;
  document.body.appendChild(progress);

  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = `
    <div class="hud-checkpoints">Checkpoints <span id="cp-count">0 / 0</span>
      <span class="hud-sep">·</span> ⏱ <span id="timer">0:00.0</span></div>
    <div class="hud-warning hidden" id="cp-warning"></div>`;
  document.body.appendChild(hud);

  // The menu panel in the middle of the screen. Its contents change for each screen.
  const menu = document.createElement('div');
  menu.className = 'menu hidden';
  document.body.appendChild(menu);
  // Any click on something with data-action="..." announces that action.
  menu.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (button) emit(button.dataset.action, button.dataset.value);
  });

  // Pause and Restart buttons in the top-right corner.
  const buttons = document.createElement('div');
  buttons.className = 'top-buttons';
  const pauseButton = document.createElement('button');
  pauseButton.className = 'hud-button';
  pauseButton.textContent = '⏸ Pause';
  pauseButton.title = 'Pause (P or Esc)';
  const restartButton = document.createElement('button');
  restartButton.className = 'hud-button';
  restartButton.textContent = '↻ Restart';
  restartButton.title = 'Restart (R)';
  buttons.append(pauseButton, restartButton);
  document.body.appendChild(buttons);

  // Lives: a row of little bobber icons under the buttons.
  const lives = document.createElement('div');
  lives.className = 'lives';
  document.body.appendChild(lives);

  const toast = document.createElement('div');
  toast.className = 'toast hidden';
  document.body.appendChild(toast);
  let toastTimer = null;

  // Mute button in the bottom-right corner (shown on every screen, even the title).
  const muteButton = document.createElement('button');
  muteButton.className = 'hud-button mute-button';
  muteButton.title = 'Sound on/off (M)';
  document.body.appendChild(muteButton);
  muteButton.addEventListener('click', () => {
    emit('mute');
    muteButton.blur();
  });

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

  function bestScoresHTML(best) {
    return Object.keys(DIFFICULTY)
      .map((d) => `<div class="best"><span>${DIFFICULTY[d].label}</span><b>${best[d] || '–'}</b></div>`)
      .join('');
  }

  return {
    on,

    // On the title screen the in-game HUD is hidden.
    setTitleMode(on) {
      document.body.classList.toggle('title-mode', on);
    },

    showTitle(best, settings) {
      showMenu(
        `<h1 class="big-title">Bobber Run</h1>
        <div class="big-byline">by Eliott</div>
        <p class="howto">Steer with the mouse (or arrow keys). Pass all 4 checkpoints,
          dodge the fish, grab coins and reach the finish!</p>
        <div class="menu-buttons">
          <button class="primary" data-action="play">▶ Play</button>
          <button data-action="settings">⚙ Settings</button>
        </div>
        <div class="difficulty-now">Difficulty: <b>${DIFFICULTY[settings.difficulty].label}</b></div>
        <h3>Best scores</h3>
        <div class="bests">${bestScoresHTML(best)}</div>`,
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
        <div class="menu-buttons"><button class="primary" data-action="back">✓ Done</button></div>`
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
          <button class="primary" data-action="resume">▶ Resume</button>
          <button data-action="settings">⚙ Settings</button>
          <button data-action="quit">⌂ Quit to Title</button>
        </div>
        <p class="note">Press P or Esc to keep going</p>`
      );
    },

    showGameOver(score, passed, total) {
      showMenu(
        `<h1>Game Over</h1>
        <p class="big-number">${score} <span>points</span></p>
        <p>Checkpoints reached: <b>${passed} / ${total}</b></p>
        <div class="menu-buttons">
          <button class="primary" data-action="play">↻ Play Again</button>
          <button data-action="quit">⌂ Title</button>
        </div>`
      );
    },

    showVictory(breakdown, isNewBest, best) {
      showMenu(
        `<h1>You win!</h1>
        ${isNewBest ? '<div class="new-best">★ New best! ★</div>' : `<div class="note">Best: ${best}</div>`}
        ${this.resultsTable(breakdown)}
        <div class="menu-buttons">
          <button class="primary" data-action="play">↻ Play Again</button>
          <button data-action="quit">⌂ Title</button>
        </div>`
      );
    },

    hideMenu() {
      menu.classList.add('hidden');
    },

    setMuted(muted) {
      muteButton.textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
    },

    // The pause button's label switches between Pause and Resume.
    setPaused(paused) {
      pauseButton.textContent = paused ? '▶ Resume' : '⏸ Pause';
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
        ${row('Checkpoints', b.checkpoints)}
        ${b.penalties ? row('Missed checkpoints', b.penalties) : ''}
        ${row('Finish', b.finish)}
        ${row(`Time bonus (${formatTime(b.seconds)})`, b.timeBonus)}
        ${row(`Lives bonus (${b.livesLeft} left)`, b.livesBonus)}
        ${row('Subtotal', b.subtotal)}
        ${row('Difficulty multiplier', '×' + b.multiplier)}
        ${row('Total', b.total, 'total')}
      </table>`;
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
    // Little ticks on the progress bar for each checkpoint; passed ones turn green.
    setProgressCheckpoints(fractions, passed) {
      const track = document.getElementById('progress-track');
      track.querySelectorAll('.progress-tick').forEach((t) => t.remove());
      fractions.forEach((f, i) => {
        const tick = document.createElement('div');
        tick.className = i < passed ? 'progress-tick passed' : 'progress-tick';
        tick.style.left = f * 100 + '%';
        track.appendChild(tick);
      });
    },
    setCheckpoints(passed, total) {
      document.getElementById('cp-count').textContent = `${passed} / ${total}`;
    },
    // A warning that stays on screen (for example "Go back for checkpoint 2").
    // Pass null to hide it.
    setWarning(text) {
      const el = document.getElementById('cp-warning');
      el.textContent = text || '';
      el.classList.toggle('hidden', !text);
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
