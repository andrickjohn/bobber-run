// obstacles.js
// Every obstacle type, how it looks, and how it moves.
//
//   Jumping Bass    – leaps out of the water in an arc, splashes back in, repeats
//   Patrolling Pike – swims back and forth across the lake
//   Snapping Turtle – chases the bobber if it comes close, gives up if it escapes
//                     (and leaves you alone while you're blinking after a respawn)
//   Swinging Lure   – a hook and shiny lure swinging like a pendulum on a fishing line
//   Drifting Log    – floats slowly across the lake, wraps around at the shore
//   Lily Pad Patch  – NOT deadly, slows the bobber down while inside
//   Whirlpool       – NOT deadly by itself, pulls the bobber toward its center
//                     (where a pike may be circling...)
//
// Each obstacle is an object with:
//   group           – its 3D model (added to the scene)
//   update(dt, t, bobber) – moves it each frame
//   hitCircles()    – list of {x, z, r} circles that hurt the bobber right now
//   affect(bobber, dt) – (lily pads and whirlpools only) changes the bobber's velocity
//   area()          – (some types) the whole circle of water they cover, to keep coins out
//
// Collisions treat everything as circles on the flat water (X/Z), which is easy math:
// two circles touch when the distance between their centers is less than r1 + r2.
// Each circle also has a height y and a half-thickness h, so things up in the air
// only hit a bobber that's up in the air too.

import * as THREE from 'three';
import { OBSTACLES, COLORS } from './config.js';
import { getWaveHeight, getLakeEdges, getLevel, isOverLake } from './world.js';

const rand = THREE.MathUtils.randFloat;

// main.js can give us a function to call when something splashes (like a jumping bass),
// so effects.js can draw the splash. Until then, splashes do nothing.
let onSplash = () => {};
export function setSplashHandler(fn) {
  onSplash = fn;
}

// ---------------------------------------------------------------------------
// Shared materials (made once, used by every obstacle of that kind)
// ---------------------------------------------------------------------------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
const M = {
  bass: mat(COLORS.bass),
  bassBelly: mat(COLORS.bassBelly),
  eye: mat(0x111111),
  pike: mat(COLORS.pike),
  pikeFin: mat(COLORS.pikeFin),
  shell: mat(COLORS.turtleShell),
  skin: mat(COLORS.turtleSkin),
  // (Very metallic materials look almost black without reflections, so we keep
  // metalness low and add a little glow instead.)
  lure: mat(COLORS.lureMetal, { metalness: 0.4, roughness: 0.25, emissive: 0x443300, flatShading: false }),
  hook: mat(COLORS.hookMetal, { metalness: 0.5, roughness: 0.3, flatShading: false }),
  bead: mat(0xd32f2f),
  line: new THREE.MeshBasicMaterial({ color: COLORS.fishingLine, transparent: true, opacity: 0.7 }),
  log: mat(COLORS.log),
  logEnd: mat(COLORS.logEnd),
  lily: mat(COLORS.lilyPad, { side: THREE.DoubleSide }),
  flower: mat(COLORS.lilyFlower),
  whirl: new THREE.MeshStandardMaterial({ color: COLORS.whirlpool, transparent: true, opacity: 0.75 }),
  whirlCenter: new THREE.MeshBasicMaterial({ color: 0x0b1f40, transparent: true, opacity: 0.8 }),
  whirlShadow: new THREE.MeshBasicMaterial({ color: 0x0b1f40, transparent: true, opacity: 0.25, depthWrite: false }),
};

// Turns a heading (direction of travel on the water) into a Y rotation.
// Our fish models face +Z, so atan2(x, z) gives the angle to turn them.
function faceDirection(group, dx, dz) {
  group.rotation.y = Math.atan2(dx, dz);
}

// Keeps an X position inside the lake at this Z, with a margin from the shore.
function clampToLake(x, z, margin) {
  const e = getLakeEdges(z);
  return THREE.MathUtils.clamp(x, e.minX + margin, e.maxX - margin);
}

// ---------------------------------------------------------------------------
// Fish models (all face +Z)
// ---------------------------------------------------------------------------
function makeBassModel() {
  const fish = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), M.bass);
  body.scale.set(0.8, 1, 2); // stretch a sphere into a fish shape
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 6), M.bassBelly);
  belly.scale.set(0.7, 0.6, 1.7);
  belly.position.y = -0.25;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.9, 4), M.bass);
  tail.rotation.x = -Math.PI / 2; // point the cone backward
  tail.scale.set(0.3, 1, 1.2);
  tail.position.z = -1.6;
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 3), M.bass);
  fin.position.set(0, 0.7, -0.1);
  fin.scale.set(0.3, 1, 1.5);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), M.eye);
    eye.position.set(side * 0.45, 0.2, 1.0);
    fish.add(eye);
  }
  fish.add(body, belly, tail, fin);
  fish.traverse((o) => (o.castShadow = true));
  return fish;
}

function makePikeModel() {
  const fish = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), M.pike);
  body.scale.set(0.42, 0.4, 2.4); // long and thin
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.0, 6), M.pike);
  snout.rotation.x = Math.PI / 2;
  snout.position.z = 2.6;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.0, 4), M.pikeFin);
  tail.rotation.x = -Math.PI / 2;
  tail.scale.set(0.25, 1, 1.2);
  tail.position.z = -2.7;
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 3), M.pikeFin);
  dorsal.position.set(0, 0.5, -1.3);
  dorsal.scale.set(0.3, 1, 1.6);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), M.eye);
    eye.position.set(side * 0.3, 0.15, 1.9);
    fish.add(eye);
  }
  fish.add(body, snout, tail, dorsal);
  fish.traverse((o) => (o.castShadow = true));
  return { fish, tail };
}

// ---------------------------------------------------------------------------
// Jumping Bass: waits under water, then leaps sideways across the path in an arc.
// ---------------------------------------------------------------------------
function makeBass(homeX, z) {
  const c = OBSTACLES.bass;
  const group = new THREE.Group();
  const pivot = new THREE.Group(); // tilts the fish nose-up / nose-down along the arc
  pivot.add(makeBassModel());
  group.add(pivot);
  group.visible = false;

  let jumping = false;
  let wait = rand(0, c.waitMax); // start at different times so they don't all jump together
  let t = 0;                      // 0 = start of the jump, 1 = end
  let dir = Math.random() < 0.5 ? -1 : 1;
  let startX = homeX;

  function update(dt, time) {
    if (!jumping) {
      wait -= dt;
      if (wait <= 0) {
        jumping = true;
        t = 0;
        startX = homeX - (dir * c.jumpDistance) / 2;
        group.visible = true;
        onSplash(startX, getWaveHeight(startX, z, time), z, 0.45); // leaping out of the water
      }
      return;
    }

    t += dt / c.jumpTime;
    if (t >= 1) {
      // Splash back in, wait, then jump the other way.
      const endX = startX + dir * c.jumpDistance;
      onSplash(endX, getWaveHeight(endX, z, time), z, 0.5);
      jumping = false;
      group.visible = false;
      wait = rand(c.waitMin, c.waitMax);
      dir = -dir;
      return;
    }

    // The arc is a parabola: height = 4 × jumpHeight × t × (1 − t).
    // It is 0 at t = 0 and t = 1, and reaches jumpHeight in the middle (t = 0.5).
    const x = startX + dir * c.jumpDistance * t;
    const y = 4 * c.jumpHeight * t * (1 - t) - 0.5 + getWaveHeight(x, z, time);
    group.position.set(x, y, z);
    group.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    // Tilt to follow the arc. The slope of the parabola is
    // dy/dx = 4 × jumpHeight × (1 − 2t) / jumpDistance; atan turns a slope into an angle.
    const slope = (4 * c.jumpHeight * (1 - 2 * t)) / c.jumpDistance;
    pivot.rotation.x = -Math.atan(slope);
  }

  // Only dangerous while jumping. The circle has a height (y), so a bobber on the water
  // can slip right underneath it at the top of its arc... and a flying bobber can't!
  function hitCircles() {
    if (!jumping) return [];
    return [{ x: group.position.x, z, r: c.radius, y: group.position.y, h: 0.8 }];
  }

  // The whole stretch of water the bass leaps across (used to keep coins away).
  const area = () => ({ x: homeX, z, r: c.jumpDistance / 2 + c.radius });

  return { type: 'bass', deadly: true, group, update, hitCircles, area };
}

// ---------------------------------------------------------------------------
// Patrolling Pike: swims in a straight line across the lake and turns at the shore.
// (Or, when guarding a whirlpool, swims in a small circle around its center.)
// ---------------------------------------------------------------------------
function makePike(x, z, circleAround = null) {
  const c = OBSTACLES.pike;
  const group = new THREE.Group();
  const { fish, tail } = makePikeModel();
  group.add(fish);

  let dir = Math.random() < 0.5 ? -1 : 1;
  let angle = Math.random() * Math.PI * 2; // used in circle mode
  const circleRadius = 2.5;
  const pos = new THREE.Vector3(x, 0, z);

  function update(dt, time) {
    if (circleAround) {
      // Circle mode: angle grows over time; cos/sin turn the angle into a point on a circle.
      angle += (c.speed * 0.6 * dt) / circleRadius;
      pos.x = circleAround.x + Math.cos(angle) * circleRadius;
      pos.z = circleAround.z + Math.sin(angle) * circleRadius;
      // Facing along the circle: the direction is (−sin, cos) of the angle.
      faceDirection(group, -Math.sin(angle), Math.cos(angle));
    } else {
      // Patrol mode: move sideways, turn around near the shore.
      pos.x += dir * c.speed * dt;
      const e = getLakeEdges(pos.z);
      if (pos.x > e.maxX - c.edgeMargin) dir = -1;
      if (pos.x < e.minX + c.edgeMargin) dir = 1;
      faceDirection(group, dir, 0);
    }
    // Swim just under the surface, with the back and fin showing. Wiggle the tail.
    group.position.set(pos.x, getWaveHeight(pos.x, pos.z, time) - 0.15, pos.z);
    tail.rotation.y = Math.sin(time * 10) * 0.4;
  }

  function hitCircles() {
    return [{ x: pos.x, z: pos.z, r: c.radius, y: 0, h: 0.7 }];
  }

  return { type: 'pike', deadly: true, group, update, hitCircles };
}

// ---------------------------------------------------------------------------
// Snapping Turtle: sits at home. If the bobber comes within chaseRadius it chases
// (slower than the bobber). If the bobber gets past giveUpRadius it swims home.
// ---------------------------------------------------------------------------
function makeTurtle(x, z) {
  const c = OBSTACLES.turtle;
  const group = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), // top half = dome
    M.shell
  );
  shell.scale.y = 0.6;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), M.skin);
  head.position.set(0, 0.15, 1.55);
  const flipperGeo = new THREE.BoxGeometry(0.9, 0.12, 0.45);
  const flippers = [];
  for (const [fx, fz] of [[-1, 0.8], [1, 0.8], [-1, -0.8], [1, -0.8]]) {
    const f = new THREE.Mesh(flipperGeo, M.skin);
    f.position.set(fx * 1.25, 0, fz);
    flippers.push(f);
    group.add(f);
  }
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), M.eye);
    eye.position.set(side * 0.22, 0.32, 1.85);
    group.add(eye);
  }
  group.add(shell, head);
  group.traverse((o) => (o.castShadow = true));

  const home = new THREE.Vector3(x, 0, z);
  const pos = home.clone();
  let chasing = false;

  function update(dt, time, bobber, bobberSafe) {
    const toBobber = Math.hypot(bobber.position.x - pos.x, bobber.position.z - pos.z);
    if (!chasing && toBobber < c.chaseRadius) chasing = true;
    if (chasing && toBobber > c.giveUpRadius) chasing = false;
    // To be fair, turtles leave a just-respawned (blinking) bobber alone and swim home.
    if (bobberSafe) chasing = false;

    // Move toward the target (the bobber, or home) at a steady speed.
    const target = chasing ? bobber.position : home;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.2) {
      const step = Math.min(c.speed * dt, dist);
      pos.x += (dx / dist) * step; // dx / dist = direction (length 1)
      pos.z += (dz / dist) * step;
      pos.x = clampToLake(pos.x, pos.z, 2);
      faceDirection(group, dx, dz);
      // Paddle the flippers while moving
      flippers.forEach((f, i) => (f.rotation.y = Math.sin(time * 8 + i * Math.PI) * 0.4));
    }
    group.position.set(pos.x, getWaveHeight(pos.x, pos.z, time) - 0.1, pos.z);
  }

  function hitCircles() {
    return [{ x: pos.x, z: pos.z, r: c.radius, y: 0, h: 0.8 }];
  }

  return { type: 'turtle', deadly: true, group, update, hitCircles };
}

// ---------------------------------------------------------------------------
// Swinging Lure: hangs from a fishing line high above and swings side to side.
// ---------------------------------------------------------------------------
function makeLure(x, z) {
  const c = OBSTACLES.lure;
  const L = c.lineLength;
  const anchorY = L + 0.9; // so the lure just skims the water at the bottom of the swing

  // The pendulum group sits at the top of the line. Rotating it swings everything.
  const group = new THREE.Group();
  group.position.set(x, anchorY, z);
  const pendulum = new THREE.Group();
  group.add(pendulum);

  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, L, 4), M.line);
  line.position.y = -L / 2;
  const lure = new THREE.Group();
  lure.position.y = -L;
  const spoon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), M.lure);
  spoon.scale.set(0.6, 1.2, 0.2); // flattened like a spoon lure
  spoon.position.y = -0.5;
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), M.bead);
  bead.position.y = 0.15;
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 12, Math.PI * 1.4), M.hook);
  hook.position.y = -1.3;
  hook.rotation.z = Math.PI * 0.8;
  lure.add(spoon, bead, hook);
  lure.scale.setScalar(1.6); // big enough to see from the chase camera
  lure.traverse((o) => (o.castShadow = true));
  pendulum.add(line, lure);

  // A real pendulum swings back and forth with angle = maxAngle × sin(ω × time).
  // ω ("omega") = √(gravity ÷ length): longer lines swing more slowly, like a real one.
  const gravity = 30; // stronger than real gravity, so the swing is fast enough to be a challenge
  const omega = Math.sqrt(gravity / L);
  const phase = Math.random() * Math.PI * 2;
  let swingTime = 0;
  let lureX = x;
  let lureY = anchorY - L;

  function update(dt) {
    swingTime += dt;
    const angle = c.swingAngle * Math.sin(omega * swingTime + phase);
    pendulum.rotation.z = angle;
    lure.rotation.y += dt * 4; // spin so it flashes in the sun
    // Where the lure ends up: the bottom of a line of length L tilted by "angle".
    lureX = x + L * Math.sin(angle);
    lureY = anchorY - L * Math.cos(angle) - 0.5;
  }

  // The lure's circle moves up and down with the swing: near the bottom it skims the
  // water, at the ends of the swing it's up in the air where flying bobbers are.
  function hitCircles() {
    return [{ x: lureX, z, r: c.radius, y: lureY, h: 1.0 }];
  }

  // The whole width of the swing (used to keep coins away).
  const area = () => ({ x, z, r: L * Math.sin(c.swingAngle) + c.radius });

  return { type: 'lure', deadly: true, group, update, hitCircles, area };
}

// ---------------------------------------------------------------------------
// Drifting Log: floats slowly across the lake, turning lazily as it goes.
// Past one shore, it reappears at the other.
// ---------------------------------------------------------------------------
function makeLog(x, z) {
  const c = OBSTACLES.log;
  const group = new THREE.Group();
  const turner = new THREE.Group(); // slowly swings the log left/right as it drifts
  // Cylinder materials: [side, top end, bottom end]
  const log = new THREE.Mesh(new THREE.CylinderGeometry(c.radius, c.radius, c.length, 8), [M.log, M.logEnd, M.logEnd]);
  log.rotation.z = Math.PI / 2; // lie down, pointing along X
  log.castShadow = true;
  // A couple of broken-off branch stubs for character
  const stubGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.9, 5);
  const stub1 = new THREE.Mesh(stubGeo, M.log);
  stub1.position.set(1.2, c.radius + 0.3, 0);
  stub1.rotation.z = -0.4;
  const stub2 = new THREE.Mesh(stubGeo, M.log);
  stub2.position.set(-1.8, c.radius + 0.2, 0.2);
  stub2.rotation.x = 0.6;
  turner.add(log, stub1, stub2);
  group.add(turner);

  let posX = x;
  const dir = Math.random() < 0.5 ? -1 : 1;
  const turnPhase = Math.random() * Math.PI * 2;
  let angle = 0;

  function update(dt, time) {
    posX += dir * c.speed * dt;
    const e = getLakeEdges(z);
    // Wrap around: drift off one side, come back on the other.
    if (posX > e.maxX) posX = e.minX;
    if (posX < e.minX) posX = e.maxX;
    // Slowly turn back and forth (up to about 25 degrees).
    angle = Math.sin(time * 0.3 + turnPhase) * 0.45;
    turner.rotation.y = angle;
    group.position.set(posX, getWaveHeight(posX, z, time) + 0.1, z);
  }

  // A long log is covered by three circles in a row along its length.
  // cos/sin of the turn angle give the direction the log is pointing.
  function hitCircles() {
    const r = c.radius + 0.3;
    const step = c.length / 3;
    const ax = Math.cos(angle) * step;
    const az = -Math.sin(angle) * step;
    return [
      { x: posX - ax, z: z - az, r, y: 0.1, h: 0.9 },
      { x: posX, z, r, y: 0.1, h: 0.9 },
      { x: posX + ax, z: z + az, r, y: 0.1, h: 0.9 },
    ];
  }

  return { type: 'log', deadly: true, group, update, hitCircles };
}

// ---------------------------------------------------------------------------
// Lily Pad Patch: not deadly. Extra drag while the bobber is inside.
// ---------------------------------------------------------------------------
function makeLilyPatch(x, z) {
  const c = OBSTACLES.lily;
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const pads = [];
  for (let i = 0; i < c.padCount; i++) {
    // Spread pads around randomly inside the patch. Using √random for the distance
    // spreads them evenly instead of bunching them in the middle.
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * (c.patchRadius - 1);
    const size = rand(0.8, 1.5);
    // A flat cylinder with a slice missing (thetaLength < 2π) = a lily pad with a notch!
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(size, size, 0.08, 14, 1, false, 0, Math.PI * 1.8), M.lily);
    pad.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    pad.rotation.y = Math.random() * Math.PI * 2;
    pad.receiveShadow = true;
    group.add(pad);
    pads.push({ mesh: pad, lift: 0.05 });
    if (Math.random() < 0.3) {
      const flower = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 6), M.flower);
      flower.position.set(pad.position.x, 0, pad.position.z);
      group.add(flower);
      pads.push({ mesh: flower, lift: 0.25 });
    }
  }

  // Each pad (and flower) rides the waves on its own.
  function update(dt, time) {
    for (const p of pads) {
      p.mesh.position.y = getWaveHeight(x + p.mesh.position.x, z + p.mesh.position.z, time) + p.lift;
    }
  }

  // Inside the patch? Then the water is "thicker": lose extra speed every second.
  function affect(bobber, dt) {
    if (!bobber.onWater) return; // flying over the pads doesn't slow you down
    const d = Math.hypot(bobber.position.x - x, bobber.position.z - z);
    if (d < c.patchRadius) bobber.velocity.multiplyScalar(Math.exp(-c.drag * dt));
  }

  const area = () => ({ x, z, r: c.patchRadius });

  return { type: 'lily', deadly: false, group, update, hitCircles: () => [], affect, area };
}

// ---------------------------------------------------------------------------
// Whirlpool: not deadly by itself. Pulls the bobber in and spins it around.
// ---------------------------------------------------------------------------
function makeWhirlpool(x, z) {
  const c = OBSTACLES.whirlpool;
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const rings = [];
  // Three flat rings, smaller ones lower down, like a funnel.
  [[c.radius * 0.75, 0.25], [c.radius * 0.5, 0.2], [c.radius * 0.27, 0.15]].forEach(([r, tube], i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 28, Math.PI * 1.6), M.whirl);
    ring.rotation.x = -Math.PI / 2; // lie flat
    ring.position.y = -i * 0.12;
    rings.push(ring);
    group.add(ring);
  });
  // A faint dark patch under the rings, so the whirlpool reads as deep swirling water.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(c.radius * 0.85, 28), M.whirlShadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.05;
  group.add(shadow);
  const center = new THREE.Mesh(new THREE.CircleGeometry(c.radius * 0.18, 16), M.whirlCenter);
  center.rotation.x = -Math.PI / 2;
  center.position.y = -0.3;
  group.add(center);

  function update(dt, time) {
    // Inner rings spin faster, like real swirling water.
    rings.forEach((ring, i) => (ring.rotation.z += dt * (1.5 + i * 1.5)));
    group.position.y = getWaveHeight(x, z, time) + 0.05;
  }

  // Pull the bobber toward the center, stronger the closer it is.
  // Also push it sideways (at right angles to the pull) so it swirls around.
  function affect(bobber, dt) {
    if (!bobber.onWater) return; // you can fly right over a whirlpool
    const dx = x - bobber.position.x;
    const dz = z - bobber.position.z;
    const d = Math.hypot(dx, dz);
    if (d >= c.radius || d < 0.01) return;
    const strength = 1 - d / c.radius; // 1 at the center, 0 at the edge
    const nx = dx / d; // direction to the center (length 1)
    const nz = dz / d;
    bobber.velocity.x += (nx * c.pull + -nz * c.swirl) * strength * dt;
    bobber.velocity.z += (nz * c.pull + nx * c.swirl) * strength * dt;
  }

  const area = () => ({ x, z, r: c.radius });

  return { type: 'whirlpool', deadly: false, group, update, hitCircles: () => [], affect, area };
}

// ---------------------------------------------------------------------------
// Placing obstacles on the lake
// ---------------------------------------------------------------------------
const MAKERS = {
  bass: makeBass,
  pike: makePike,
  turtle: makeTurtle,
  lure: makeLure,
  log: makeLog,
  lily: makeLilyPatch,
  whirlpool: makeWhirlpool,
};

// How far from the shore each type's center must be.
const SHORE_MARGIN = {
  bass: OBSTACLES.bass.jumpDistance / 2 + 2,
  pike: 5,
  turtle: 4,
  lure: 4 + OBSTACLES.lure.lineLength * Math.sin(OBSTACLES.lure.swingAngle),
  log: 3,
  lily: OBSTACLES.lily.patchRadius + 1,
  whirlpool: OBSTACLES.whirlpool.radius * 0.7,
};

// How big each type is (its reach), so bigger ones are kept further from checkpoints.
const SIZE = {
  bass: OBSTACLES.bass.jumpDistance / 2,
  pike: 0,
  turtle: 0,
  lure: 0,
  log: OBSTACLES.log.length / 2,
  lily: OBSTACLES.lily.patchRadius,
  whirlpool: OBSTACLES.whirlpool.radius,
};

// Shuffles a list into random order (the "Fisher–Yates shuffle").
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Picks which type each obstacle will be. Every type appears at least once
// (if there's room), the rest are random.
function chooseTypes(count) {
  const types = ['bass', 'pike', 'turtle', 'lure', 'log', 'lily'];
  if (OBSTACLES.includeWhirlpools) types.push('whirlpool');
  const chosen = shuffle([...types]).slice(0, count);
  while (chosen.length < count) chosen.push(types[Math.floor(Math.random() * types.length)]);
  return shuffle(chosen);
}

export function createObstacles(scene) {
  let list = [];

  // Remove the old obstacles and place a fresh set.
  // gateCenters = checkpoint positions to keep clear.
  function build(count, gateCenters) {
    for (const o of list) scene.remove(o.group);
    list = [];

    const types = chooseTypes(count);
    // Split the lake (between the start and finish safe zones) into equal slices,
    // one obstacle per slice, so they're spread out from start to finish.
    const zStart = -OBSTACLES.startSafeZone;
    const zEnd = getLevel().finishZ + OBSTACLES.finishSafeZone;
    const slice = (zEnd - zStart) / count;

    // Is (x, z) a good spot? On a lake (not in a gap, not too near a lake's end)
    // and far enough from every checkpoint.
    function goodSpot(type, x, z) {
      if (!isOverLake(z, SIZE[type] + 6)) return false;
      const safe = OBSTACLES.checkpointSafeRadius + SIZE[type];
      return !gateCenters.some((g) => Math.hypot(g.x - x, g.z - z) < safe);
    }

    types.forEach((type, i) => {
      const margin = SHORE_MARGIN[type];
      // Try random spots in this obstacle's slice first. If the slice is mostly a gap
      // between space lakes, try anywhere on the course instead.
      for (let tries = 0; tries < 60; tries++) {
        const z = tries < 25 ? zStart + slice * (i + rand(0.1, 0.9)) : rand(zEnd, zStart);
        const e = getLakeEdges(z);
        const x = rand(e.minX + margin, e.maxX - margin);
        if (!goodSpot(type, x, z)) continue;
        add(MAKERS[type](x, z));
        // Some whirlpools have a pike circling in the middle, waiting...
        if (type === 'whirlpool' && Math.random() < OBSTACLES.whirlpool.pikeChance) {
          add(makePike(x, z, { x, z }));
        }
        return;
      }
      // (No good spot found: this obstacle is simply skipped.)
    });
  }

  function add(obstacle) {
    list.push(obstacle);
    scene.add(obstacle.group);
  }

  // Move every obstacle. They use "obstacle time" (dt × speedMultiplier),
  // so a higher multiplier simply makes all of them faster.
  // Lily pads and whirlpools also push the bobber around here.
  // bobberSafe = true while the bobber is blinking after a respawn.
  function update(dt, time, bobber, bobberSafe = false) {
    const obstacleDt = dt * OBSTACLES.speedMultiplier;
    for (const o of list) {
      o.update(obstacleDt, time, bobber, bobberSafe);
      if (o.affect) o.affect(bobber, dt);
    }
  }

  // Every circle that can hurt the bobber right now (used for collisions in Phase 5).
  function getHitCircles() {
    const circles = [];
    for (const o of list) if (o.deadly) circles.push(...o.hitCircles());
    return circles;
  }

  // A zap at (x, y, z) with radius r: knocks out the first dangerous obstacle it touches.
  // Uses the same height-aware circles as collisions. Returns where it was (or null).
  function zap(x, y, z, r) {
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (!o.deadly) continue;
      for (const c of o.hitCircles()) {
        const closeEnough = Math.hypot(c.x - x, c.z - z) < c.r + r;
        const rightHeight = c.y === undefined || Math.abs(c.y - y) < c.h + r;
        if (closeEnough && rightHeight) {
          scene.remove(o.group);
          list.splice(i, 1);
          return { type: o.type, x: c.x, y: c.y ?? 0, z: c.z };
        }
      }
    }
    return null;
  }

  // Is the spot (x, z) at least "clearance" away from every obstacle?
  // Obstacles that sweep over an area (bass, lure, lily pads, whirlpools) use that whole
  // area; the others use where they are right now.
  function isClear(x, z, clearance) {
    for (const o of list) {
      const circles = o.area ? [o.area()] : o.hitCircles();
      for (const c of circles) {
        if (Math.hypot(c.x - x, c.z - z) < c.r + clearance) return false;
      }
    }
    return true;
  }

  return { build, update, getHitCircles, isClear, zap, get list() { return list; } };
}
