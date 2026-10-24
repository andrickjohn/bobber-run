// tacklebox.js
// "Tackle Box Drop": the little toy on the title screen.
// Move along the top to aim, tap/click to drop a fish into the tackle box.
// Bobbers, lures and fish drop in. When two of the SAME thing touch, they merge into
// the next bigger one:
//   bobber → lure → minnow → perch → bass → pike → GOLDEN FISH
// Two golden fish make a big sparkly burst. Fill the box past the line and it
// shakes empty, so you can start again. It's a toy, so there's no losing!
//
// The physics is written by hand (no physics library):
//   - gravity pulls every fish down
//   - fish bounce off the walls and floor
//   - two fish that overlap get pushed apart, and bounce off each other

import { TACKLE_BOX } from './config.js';
import { drawPiece } from './fishart.js';

// Everything that can be in the box, from smallest to biggest.
// r = size (as a fraction of the box width).
const FISH = [
  { name: 'Bobber', r: 0.05, kind: 'bobber' },
  { name: 'Lure', r: 0.065, kind: 'lure' },
  { name: 'Minnow', r: 0.085, kind: 'fish', body: '#8fd3ff', belly: '#e3f6ff' },
  { name: 'Perch', r: 0.105, kind: 'fish', body: '#c6d84a', belly: '#f4f7c8', stripes: '#5d7a1e' },
  { name: 'Bass', r: 0.13, kind: 'fish', body: '#5fae4e', belly: '#d8efc4' },
  { name: 'Pike', r: 0.155, kind: 'fish', body: '#7f9c7a', belly: '#dfe9d8', stripes: '#4a6346' },
  { name: 'Golden Fish', r: 0.185, kind: 'fish', body: '#ffd43b', belly: '#fff3bf', golden: true },
];
// Burst colors for merges (bobbers and lures don't have a body color).
const burstColor = (tier) => FISH[tier].body || (FISH[tier].kind === 'bobber' ? '#e53935' : '#ffd54f');

export function createTackleBox(canvas, callbacks = {}) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let scale = 1; // pixels per "box width" unit (fish sizes are fractions of the width)

  let fish = [];        // fish in the box
  let particles = [];   // little pops and sparkles
  let floatTexts = [];  // "+20" numbers floating up
  let aimX = 0.5;       // where the dropper is (0 = left wall, 1 = right wall)
  let nextTier = 0;     // which fish drops next
  let cooldown = 0;     // seconds until the next drop is allowed
  let overflowTime = 0; // how long fish have been piled above the line
  let shakeTime = 0;    // the box shakes when it empties
  let score = 0;
  let best = loadBest();
  let running = false;
  let lastTime = 0;

  function loadBest() {
    try {
      return Number(localStorage.getItem('bobberRun.toyBest')) || 0;
    } catch (e) {
      return 0;
    }
  }
  function saveBest() {
    try {
      localStorage.setItem('bobberRun.toyBest', String(best));
    } catch (e) {
      // Storage blocked: the best score just won't be remembered.
    }
  }

  // ----- Sizing: match the canvas to how big it is on screen (sharp on any screen) -----
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    scale = width;
  }

  // The inside of the box, in pixels.
  const wall = () => width * 0.06;
  const top = () => height * 0.2; // the dropper hangs above this
  const dangerY = () => height * 0.3; // fish piled above this line = box too full

  // ----- Input: aim with the pointer, tap/click to drop -----
  function pointerX(e) {
    const rect = canvas.getBoundingClientRect();
    return (e.clientX - rect.left) / rect.width;
  }
  canvas.addEventListener('pointermove', (e) => (aimX = pointerX(e)));
  canvas.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    aimX = pointerX(e);
    drop();
  });

  // Pick a random small fish to drop next (only the 3 smallest, like Suika).
  function pickNext() {
    nextTier = Math.floor(Math.random() * 3);
  }

  function drop() {
    if (cooldown > 0) return;
    const r = FISH[nextTier].r * scale;
    const x = Math.min(width - wall() - r, Math.max(wall() + r, aimX * width));
    fish.push(makeFish(nextTier, x, top()));
    cooldown = TACKLE_BOX.dropCooldown;
    pickNext();
    callbacks.onDrop?.();
  }

  function makeFish(tier, x, y, vx = 0, vy = 0) {
    return { tier, x, y, vx, vy, r: FISH[tier].r * scale, angle: 0, age: 0, pop: 0 };
  }

  // ----- Physics -----
  function step(dt) {
    const g = TACKLE_BOX.gravity * height;
    const left = wall();
    const right = width - wall();
    const floor = height - wall();

    for (const f of fish) {
      f.age += dt;
      f.pop = Math.max(0, f.pop - dt * 3);
      f.vy += g * dt; // gravity: speed up downward
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx *= 0.995; // a little air/water slowing
      // Walls and floor: put the fish back inside and bounce (losing most of the speed).
      if (f.x - f.r < left) { f.x = left + f.r; f.vx = Math.abs(f.vx) * 0.3; }
      if (f.x + f.r > right) { f.x = right - f.r; f.vx = -Math.abs(f.vx) * 0.3; }
      if (f.y + f.r > floor) { f.y = floor - f.r; f.vy = -Math.abs(f.vy) * 0.2; f.vx *= 0.9; }
      // Roll as it moves sideways (turning = distance ÷ radius).
      f.angle += (f.vx / f.r) * dt * 0.5;
    }

    // Every pair of fish: are they overlapping?
    for (let i = 0; i < fish.length; i++) {
      for (let j = i + 1; j < fish.length; j++) {
        const a = fish[i];
        const b = fish[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const overlap = a.r + b.r - dist;
        if (overlap <= 0) continue;

        // Same fish? Merge into the next bigger one!
        if (a.tier === b.tier && a.age > 0.05 && b.age > 0.05) {
          merge(a, b);
          return; // the list changed; carry on next step
        }

        // Push them apart. Heavier (bigger) fish get pushed less:
        // each moves by its share of the overlap, based on the other one's weight.
        const nx = dx / dist; // direction from a to b (length 1)
        const ny = dy / dist;
        const ma = a.r * a.r; // weight grows with size (area)
        const mb = b.r * b.r;
        const pushA = (overlap * mb) / (ma + mb);
        const pushB = (overlap * ma) / (ma + mb);
        a.x -= nx * pushA;
        a.y -= ny * pushA;
        b.x += nx * pushB;
        b.y += ny * pushB;
        // Bounce: if they're moving toward each other, swap some of that speed.
        const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (closing < 0) {
          const impulse = (-(1 + 0.15) * closing) / (1 / ma + 1 / mb);
          a.vx -= (impulse / ma) * nx;
          a.vy -= (impulse / ma) * ny;
          b.vx += (impulse / mb) * nx;
          b.vy += (impulse / mb) * ny;
        }
      }
    }
  }

  function merge(a, b) {
    fish = fish.filter((f) => f !== a && f !== b);
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    const tier = a.tier;
    // Points double with each size: minnows give a little, golden fish a LOT.
    const points = TACKLE_BOX.mergePoints * 2 ** tier;
    addScore(points, x, y);
    burst(x, y, burstColor(tier), 10 + tier * 3);
    if (tier < FISH.length - 1) {
      const born = makeFish(tier + 1, x, y, (a.vx + b.vx) / 2, (a.vy + b.vy) / 2 - 80);
      born.pop = 1; // starts with a bouncy "pop"
      fish.push(born);
      callbacks.onMerge?.(tier + 1);
    } else {
      // Two golden fish: a huge golden burst and they both disappear.
      burst(x, y, '#ffd43b', 60);
      burst(x, y, '#ffffff', 30);
      callbacks.onMerge?.(FISH.length);
    }
  }

  function addScore(points, x, y) {
    score += points;
    if (score > best) {
      best = score;
      saveBest();
    }
    floatTexts.push({ text: '+' + points, x, y, age: 0 });
  }

  // A burst of little colored dots flying out (for merges).
  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 220;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60, age: 0, life: 0.6 + Math.random() * 0.4, color, size: 2 + Math.random() * 4 });
    }
  }

  // Too full? If settled fish stay above the danger line, the box shakes itself empty.
  function checkOverflow(dt) {
    const tooHigh = fish.some((f) => f.age > 1 && f.y - f.r < dangerY());
    overflowTime = tooHigh ? overflowTime + dt : 0;
    if (overflowTime > TACKLE_BOX.overflowSeconds) {
      overflowTime = 0;
      shakeTime = 0.6;
      for (const f of fish) burst(f.x, f.y, burstColor(f.tier), 6);
      fish = [];
      score = 0;
      callbacks.onEmpty?.();
    }
  }

  // ----- Drawing -----
  function drawFish(f, x, y) {
    drawPiece(ctx, x, y, f.r, FISH[f.tier], f.angle, f.pop);
  }

  function draw(time) {
    const shake = shakeTime > 0 ? Math.sin(time * 60) * 8 * shakeTime : 0;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(shake, 0);

    // The box: wooden frame with water inside
    const w = wall();
    ctx.fillStyle = '#8b5a2b';
    roundRect(0, top() - w * 0.4, width, height - top() + w * 0.4, 14);
    ctx.fill();
    const water = ctx.createLinearGradient(0, top(), 0, height);
    water.addColorStop(0, '#5fc8d8');
    water.addColorStop(1, '#1d6f86');
    ctx.fillStyle = water;
    roundRect(w, top(), width - w * 2, height - top() - w, 8);
    ctx.fill();
    // Wood grain lines on the frame
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(w * 0.3, top() + (height - top()) * (i / 4));
      ctx.lineTo(w * 0.3, top() + (height - top()) * (i / 4) + 20);
      ctx.stroke();
    }
    // The "too full" line: dashed, turns red and blinks when the box is about to overflow
    const warn = overflowTime > 0 && Math.sin(time * 20) > 0;
    ctx.strokeStyle = warn ? '#ff5252' : 'rgba(255,255,255,0.5)';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(w, dangerY());
    ctx.lineTo(width - w, dangerY());
    ctx.stroke();
    ctx.setLineDash([]);

    // The dropper: a fishing line from the top with the next fish hanging on it
    const nextR = FISH[nextTier].r * scale;
    const dropX = Math.min(width - w - nextR, Math.max(w + nextR, aimX * width));
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(dropX, 0);
    ctx.lineTo(dropX, top() - nextR);
    ctx.stroke();
    ctx.globalAlpha = cooldown > 0 ? 0.4 : 1;
    drawFish({ tier: nextTier, r: nextR, angle: Math.sin(time * 3) * 0.15, pop: 0 }, dropX, top());
    ctx.globalAlpha = 1;
    // A faint guide line straight down from the dropper
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(dropX, top() + nextR);
    ctx.lineTo(dropX, height - w);
    ctx.stroke();

    // Fish in the box are "clipped" to the inside, so tails don't poke through the walls.
    ctx.save();
    ctx.beginPath();
    ctx.rect(w, 0, width - w * 2, height - w);
    ctx.clip();
    for (const f of fish) drawFish(f, f.x, f.y);
    ctx.restore();

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const t of floatTexts) {
      ctx.globalAlpha = Math.max(0, 1 - t.age);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 3;
      ctx.strokeText(t.text, t.x, t.y - t.age * 40);
      ctx.fillText(t.text, t.x, t.y - t.age * 40);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Score at the top
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#0b4f5c';
    ctx.textAlign = 'left';
    ctx.fillText(`Catch: ${score}`, 4, 16);
    ctx.textAlign = 'right';
    ctx.fillText(`Best: ${best}`, width - 4, 16);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ----- The toy's own little loop (runs only while the title screen is showing) -----
  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    frameStep(dt);
    draw(now / 1000);
    requestAnimationFrame(frame);
  }

  function frameStep(dt) {
    cooldown = Math.max(0, cooldown - dt);
    shakeTime = Math.max(0, shakeTime - dt);
    // Several small physics steps per frame keep stacked fish steady.
    for (let i = 0; i < 4; i++) step(dt / 4);
    checkOverflow(dt);
    for (const p of particles) {
      p.age += dt;
      p.vy += 400 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles = particles.filter((p) => p.age < p.life);
    for (const t of floatTexts) t.age += dt;
    floatTexts = floatTexts.filter((t) => t.age < 1);
  }

  function start() {
    resize();
    window.addEventListener('resize', resize);
    if (!running) {
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(frame);
    }
  }

  function stop() {
    running = false;
    window.removeEventListener('resize', resize);
  }

  pickNext();

  return { start, stop };
}
