// fishart.js
// Draws cute flat 2D fish (and bobbers and lures) on a canvas.
// Used by the cooler in the HUD,
// so everything is drawn by code, with no image files.
//
// look = { kind: 'fish' | 'bobber' | 'lure', body, belly, stripes, spots, whiskers, golden }
// r = size (radius) in pixels, angle = how much it's turned, pop = 0..1 bouncy "just born" puff

export function drawPiece(ctx, x, y, r, look, angle = 0, pop = 0) {
  r *= 1 + Math.sin(pop * Math.PI) * 0.25;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (look.kind === 'bobber') drawBobber(ctx, r);
  else if (look.kind === 'lure') drawLure(ctx, r);
  else drawFish(ctx, r, look);
  ctx.restore();
}

// A red-and-white bobber with a little stick and a yellow tip.
function drawBobber(ctx, r) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e53935';
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, Math.PI * 2); // top half
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r * 0.08, -r * 1.7, r * 0.16, r * 0.75);
  ctx.fillStyle = '#fbc02d';
  ctx.beginPath();
  ctx.arc(0, -r * 1.7, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  shine(ctx, r);
}

// A shiny spoon lure with a red bead and a hook.
function drawLure(ctx, r) {
  ctx.fillStyle = '#ffd54f';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.6, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.ellipse(-r * 0.15, -r * 0.2, r * 0.25, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e53935';
  ctx.beginPath();
  ctx.arc(0, -r * 1.05, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#9e9e9e';
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.beginPath();
  ctx.arc(0, r * 1.25, r * 0.3, Math.PI * 0.1, Math.PI * 1.2);
  ctx.stroke();
}

function drawFish(ctx, r, look) {
  // Tail: a triangle at the back
  ctx.fillStyle = look.body;
  ctx.beginPath();
  ctx.moveTo(-r * 0.75, 0);
  ctx.lineTo(-r * 1.25, -r * 0.55);
  ctx.lineTo(-r * 1.25, r * 0.55);
  ctx.closePath();
  ctx.fill();
  // Body: a round oval, with a lighter belly
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.belly;
  ctx.beginPath();
  ctx.ellipse(r * 0.05, r * 0.35, r * 0.7, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  if (look.stripes) {
    ctx.strokeStyle = look.stripes;
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    for (const sx of [-0.35, 0, 0.35]) {
      ctx.beginPath();
      ctx.moveTo(r * sx, -r * 0.7);
      ctx.lineTo(r * sx, r * 0.1);
      ctx.stroke();
    }
  }
  if (look.spots) {
    ctx.fillStyle = look.spots;
    for (const [sx, sy] of [[-0.4, -0.3], [0.1, -0.5], [-0.1, -0.05], [0.45, -0.15]]) {
      ctx.beginPath();
      ctx.arc(r * sx, r * sy, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (look.golden) shine(ctx, r);
  // Eye: white with a black pupil
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(r * 0.5, -r * 0.2, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(r * 0.56, -r * 0.2, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  // Smile
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.arc(r * 0.62, r * 0.18, r * 0.16, 0.2, Math.PI * 0.8);
  ctx.stroke();
}

// A white highlight that makes something look shiny.
function shine(ctx, r) {
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.45, r * 0.25, r * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fill();
}
