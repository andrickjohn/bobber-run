// cooler.js
// The cooler on the side of the screen: a little stacking puzzle running alongside the race.
// It's a small grid, 3 fish wide. Every fish you catch drops into the lowest column
// (the leftmost one if there's a tie).
//   - Three (or more) of the same color in a row (up and down, or straight across) POP.
//   - When fish pop, the ones above fall down into the gaps. If THAT makes another
//     three in a row, it pops too: a CHAIN (×2, ×3 ...), worth more each time.
//   - If the cooler is completely full with nothing to pop, it overflows and dumps
//     everything, and you lose your combo.
// So the puzzle is choosing WHICH colored fish to catch!

import { CATCH } from './config.js';
import { drawPiece } from './fishart.js';

// Lighter belly for each fish color.
const BELLIES = ['#ffd0d2', '#d6ecff', '#d8f5dd', '#fff3bf'];

export function createCooler(canvas, callbacks = {}) {
  const ctx = canvas.getContext('2d');
  const COLS = CATCH.coolerColumns;
  const ROWS = CATCH.coolerRows;
  let width = 0;
  let height = 0;

  // columns[c] = the fish in column c, from the bottom up.
  // Each fish: { color, y (row it's drawn at, falls toward its real row), popping }
  let columns = Array.from({ length: COLS }, () => []);
  let popTimer = 0; // while > 0, matched fish are flashing before they pop
  let chain = 0;    // how many pops in a row from one catch (for chain bonuses)
  let shake = 0;    // the cooler shakes when it overflows
  let sparks = [];  // little bursts when fish pop

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  const total = () => columns.reduce((n, col) => n + col.length, 0);

  // A caught fish drops into the lowest column (leftmost if tied).
  function add(color) {
    let target = 0;
    for (let c = 1; c < COLS; c++) if (columns[c].length < columns[target].length) target = c;
    if (columns[target].length >= ROWS) {
      overflow(); // completely full: no room for this fish
      return;
    }
    columns[target].push({ color, y: ROWS + 1, popping: false });
    chain = 0;
  }

  // Marks every fish that's part of 3+ of the same color in a row: up and down in a
  // column, or straight across a row. Returns how many were marked.
  function markMatches() {
    // Up and down: walk each column looking for runs of the same color.
    for (const col of columns) {
      let start = 0;
      for (let i = 1; i <= col.length; i++) {
        if (i < col.length && col[i].color === col[start].color) continue;
        if (i - start >= 3) for (let k = start; k < i; k++) col[k].popping = true;
        start = i;
      }
    }
    // Straight across: the same idea along each row.
    for (let row = 0; row < ROWS; row++) {
      let start = 0;
      for (let c = 1; c <= COLS; c++) {
        const here = c < COLS ? columns[c][row] : null;
        const first = columns[start][row];
        if (here && first && here.color === first.color) continue;
        if (first && c - start >= 3) for (let k = start; k < c; k++) columns[k][row].popping = true;
        start = c;
      }
    }
    return columns.reduce((n, col) => n + col.filter((f) => f.popping).length, 0);
  }

  // Have all the fish finished falling into place?
  function settled() {
    return columns.every((col) => col.every((f, row) => Math.abs(f.y - row) < 0.02));
  }

  function overflow() {
    columns.forEach((col, c) => col.forEach((f, row) => burst(c, row, f.color)));
    columns = Array.from({ length: COLS }, () => []);
    shake = 0.5;
    callbacks.onOverflow?.();
  }

  function update(dt) {
    shake = Math.max(0, shake - dt);

    // Each fish falls toward its row (its place in the column).
    for (const col of columns) col.forEach((f, row) => (f.y = Math.max(row, f.y - dt * 14)));

    if (popTimer > 0) {
      popTimer -= dt;
      if (popTimer <= 0) {
        // POP! Remove the flashing fish; the ones above fall into the gaps.
        let popped = 0;
        columns.forEach((col, c) => {
          col.forEach((f, row) => {
            if (f.popping) {
              burst(c, row, f.color);
              popped++;
            }
          });
        });
        columns = columns.map((col) => col.filter((f) => !f.popping));
        callbacks.onPop?.(popped, chain);
      }
    } else if (settled() && total() > 0) {
      if (markMatches() > 0) {
        chain++;
        popTimer = 0.35; // flash for a moment first, so you can see what matched
      } else if (total() >= COLS * ROWS) {
        overflow(); // full to the top with nothing to pop
      }
    }

    for (const s of sparks) {
      s.age += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 300 * dt;
    }
    sparks = sparks.filter((s) => s.age < 0.6);
    draw();
  }

  // ----- Drawing -----
  const pad = 6;
  const cellW = () => (width - pad * 2) / COLS;
  const cellH = () => (height - pad * 2 - 4) / ROWS;
  const cellX = (c) => pad + cellW() * (c + 0.5);
  const cellY = (row) => height - pad - cellH() * (row + 0.5); // row 0 = bottom

  function burst(c, row, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      sparks.push({ x: cellX(c), y: cellY(row), vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, age: 0, color: CATCH.colors[color] });
    }
  }

  function draw() {
    if (!width) resize();
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(performance.now() / 20) * 6 * shake, 0);

    // The cooler: a white box with a thick blue rim.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    roundRect(2, 2, width - 4, height - 4, 10);
    ctx.fill();
    // Faint column dividers
    ctx.strokeStyle = 'rgba(28,126,214,0.15)';
    ctx.lineWidth = 2;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(pad + cellW() * c, pad);
      ctx.lineTo(pad + cellW() * c, height - pad);
      ctx.stroke();
    }
    // A red warning glow when it's nearly full
    if (total() >= COLS * ROWS - COLS) {
      ctx.fillStyle = `rgba(255, 82, 82, ${0.15 + 0.15 * Math.sin(performance.now() / 120)})`;
      roundRect(2, 2, width - 4, height - 4, 10);
      ctx.fill();
    }
    ctx.strokeStyle = '#1b1b2f';
    ctx.lineWidth = 3;
    roundRect(2, 2, width - 4, height - 4, 10);
    ctx.stroke();

    const r = Math.min(cellW() * 0.36, cellH() * 0.42);
    columns.forEach((col, c) => {
      col.forEach((f) => {
        const flash = f.popping ? 1 + Math.sin(performance.now() / 40) * 0.25 : 1;
        const look = { kind: 'fish', body: CATCH.colors[f.color], belly: BELLIES[f.color] };
        drawPiece(ctx, cellX(c), cellY(f.y), r * flash, look);
        if (f.popping) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath();
          ctx.arc(cellX(c), cellY(f.y), r * 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });

    for (const s of sparks) {
      ctx.globalAlpha = 1 - s.age / 0.6;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function roundRect(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function clear() {
    columns = Array.from({ length: COLS }, () => []);
    popTimer = 0;
    chain = 0;
    sparks = [];
  }

  window.addEventListener('resize', resize);

  return { add, update, clear, resize, get count() { return total(); } };
}
