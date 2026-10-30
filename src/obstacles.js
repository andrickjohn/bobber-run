// obstacles.js
// Every obstacle type, how it looks, and how it moves.
//
//   Jumping Bass    – leaps out of the water in an arc, splashes back in, repeats
//   Patrolling Pike – swims back and forth across the lake
//   Snapping Turtle – chases the bobber if it comes close, gives up if it escapes
//                     (and leaves you alone while you're blinking after a respawn)
//   Swinging Lure   – a hook and shiny lure swinging like a pendulum on a fishing line
//   Drifting Log    – floats slowly across the lake, wraps around at the shore
//                     (or lies still across a lane, for you to jump over)
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
import { getWaveHeight, getLakeEdges } from './world.js';
import { cartoon } from './style.js';

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
// Smooth, slightly glossy materials (like wet skin and shells).
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
const M = {
  bassBelly: mat(COLORS.bassBelly),
  eye: mat(0x0a0a0a, { roughness: 0.1 }),
  eyeWhite: mat(0xf4f1e6, { roughness: 0.3 }),
  fin: mat(COLORS.bassFin, { side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  pikeFin: mat(COLORS.pikeFin),
  shell: mat(COLORS.turtleShell),
  shellPattern: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.6 }),
  bark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
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
// A smooth fish body made with a "lathe": draw half of the body's outline (how thick
// it is at each point from tail to nose), then spin it all the way around, like a
// pottery wheel. Each point is colored from a dark back down to a pale belly.
// profile = [[radius, along], ...] from the tail (along = 0) to the nose (along = 1).
function makeFishBody(length, profile, colors) {
  const points = profile.map(([r, t]) => new THREE.Vector2(r, (t - 0.5) * length));
  const geo = new THREE.LatheGeometry(points, 24);
  geo.rotateX(Math.PI / 2); // the lathe spins around Y; turn it to lie along Z (nose at +Z)
  const pos = geo.attributes.position;
  const back = new THREE.Color(colors.back);
  const side = new THREE.Color(colors.side);
  const belly = new THREE.Color(colors.belly);
  const c = new THREE.Color();
  const vertexColors = [];
  let maxR = 0;
  for (const [r] of profile) maxR = Math.max(maxR, r);
  for (let i = 0; i < pos.count; i++) {
    const up = THREE.MathUtils.clamp(pos.getY(i) / maxR, -1, 1); // -1 belly, +1 back
    if (up > 0) c.copy(side).lerp(back, up);
    else c.copy(side).lerp(belly, -up);
    // Darker blotches along the side (bass have a dark stripe; pike have pale spots)
    if (colors.stripe && Math.abs(up) < 0.35) c.lerp(new THREE.Color(colors.stripe), 0.45 + 0.25 * Math.sin(pos.getZ(i) * 5));
    vertexColors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  // A glossy, wet-looking skin.
  const material = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  return new THREE.Mesh(geo, material);
}

// A flat fin from a 2D outline (a list of [x, y] points), stood up on its edge.
function makeFin(outline, material = M.fin) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
}

// Eyes: a pale ball with a dark pupil, one on each side.
function addEyes(fish, x, y, z, size) {
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), M.eyeWhite);
    eye.position.set(side * x, y, z);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.6, 10, 6), M.eye);
    pupil.position.set(side * size * 0.55, 0, size * 0.2);
    eye.add(pupil);
    fish.add(eye);
  }
}

function makeBassModel() {
  const fish = new THREE.Group();
  const body = makeFishBody(
    3.2,
    [[0.12, 0], [0.25, 0.12], [0.55, 0.35], [0.68, 0.55], [0.62, 0.75], [0.42, 0.9], [0.0, 1]],
    { back: 0x2f4a22, side: 0x6f8a3c, belly: 0xece6c4, stripe: 0x2a3a1c }
  );
  body.scale.set(0.75, 1, 1); // a bit flatter side to side, like a real fish
  // Forked tail fin (turned to stand upright, facing backward)
  // (The outline is drawn going right = backward; turning it a quarter turn around Y
  // stands it up behind the fish.)
  const tail = makeFin([[0, 0], [0.8, 0.6], [0.4, 0.12], [0.55, 0], [0.4, -0.12], [0.8, -0.6]]);
  tail.rotation.y = Math.PI / 2;
  tail.position.z = -1.5;
  // Spiky dorsal fin on top, and a smaller one underneath
  const dorsal = makeFin([[-0.9, 0], [-0.6, 0.55], [-0.2, 0.42], [0.2, 0.5], [0.6, 0.1], [0.6, 0]]);
  dorsal.rotation.y = -Math.PI / 2;
  dorsal.position.set(0, 0.5, -0.1);
  const bottomFin = makeFin([[-0.3, 0], [0, -0.35], [0.3, 0]]);
  bottomFin.rotation.y = -Math.PI / 2;
  bottomFin.position.set(0, -0.5, -0.4);
  addEyes(fish, 0.36, 0.18, 1.0, 0.11);
  fish.add(body, tail, dorsal, bottomFin);
  fish.traverse((o) => (o.castShadow = true));
  return fish;
}

function makePikeModel() {
  const fish = new THREE.Group();
  const body = makeFishBody(
    5.4,
    [[0.08, 0], [0.18, 0.1], [0.38, 0.3], [0.44, 0.55], [0.38, 0.75], [0.22, 0.9], [0.1, 0.98], [0.0, 1]],
    { back: 0x34442a, side: 0x7b8a4e, belly: 0xe2dcb8, stripe: 0xb9c48a }
  );
  body.scale.set(0.85, 1, 1);
  // The tail sits on its own pivot, so swimming can wiggle it from side to side.
  const tail = new THREE.Group();
  tail.position.z = -2.6;
  const tailFin = makeFin([[0, 0], [0.75, 0.5], [0.45, 0], [0.75, -0.5]]);
  tailFin.rotation.y = Math.PI / 2;
  tail.add(tailFin);
  // A pike's dorsal fin sits far back, near the tail
  const dorsal = makeFin([[-0.5, 0], [-0.3, 0.45], [0.3, 0.2], [0.3, 0]]);
  dorsal.rotation.y = -Math.PI / 2;
  dorsal.position.set(0, 0.35, -1.6);
  addEyes(fish, 0.22, 0.14, 1.9, 0.09);
  fish.add(body, tail, dorsal);
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
// The turtle's shell: a dome with a pattern of plates ("scutes"). Each point is colored
// darker near the lines between plates, using sine waves around and over the dome.
function makeShellGeometry() {
  const geo = new THREE.SphereGeometry(1.4, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2); // top half = dome
  const pos = geo.attributes.position;
  const base = new THREE.Color(COLORS.turtleShell);
  const dark = base.clone().multiplyScalar(0.45);
  const c = new THREE.Color();
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const around = Math.atan2(z, x);
    const up = y / 1.4;
    const lines = Math.min(Math.abs(Math.sin(around * 3)), Math.abs(Math.sin(up * 7.5))); // 0 on a line
    c.copy(base).lerp(dark, Math.max(0, 1 - lines * 5));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

function makeTurtle(x, z) {
  const c = OBSTACLES.turtle;
  const group = new THREE.Group();
  const shell = new THREE.Mesh(makeShellGeometry(), M.shellPattern);
  shell.scale.y = 0.6;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), M.skin);
  head.scale.set(1, 0.85, 1.25);
  head.position.set(0, 0.15, 1.55);
  // Flippers: flattened balls, wider than they are tall
  const flipperGeo = new THREE.SphereGeometry(0.5, 12, 8);
  flipperGeo.scale(1, 0.18, 0.55);
  const flippers = [];
  for (const [fx, fz] of [[-1, 0.8], [1, 0.8], [-1, -0.8], [1, -0.8]]) {
    const f = new THREE.Mesh(flipperGeo, M.skin);
    f.position.set(fx * 1.25, 0, fz);
    flippers.push(f);
    group.add(f);
  }
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), M.eye);
    eye.position.set(side * 0.24, 0.3, 1.95);
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
  line.userData.noOutline = true; // a thin fishing line doesn't need an outline
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
// A log's bark: a cylinder with bumpy, grooved sides. Each point is pushed in or out a
// little and colored darker in the grooves running along the log.
function makeBarkGeometry(radius, length) {
  const geo = new THREE.CylinderGeometry(radius, radius * 0.92, length, 28, 8);
  const pos = geo.attributes.position;
  const base = new THREE.Color(COLORS.log);
  const c = new THREE.Color();
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const around = Math.atan2(z, x);
    const groove = Math.sin(around * 9 + Math.sin(y * 1.3) * 0.8); // wavy grooves along the log
    const r = Math.hypot(x, z);
    if (r > 0.01) {
      const push = 1 + groove * 0.07;
      pos.setX(i, x * push);
      pos.setZ(i, z * push);
    }
    c.copy(base).multiplyScalar(0.62 + groove * 0.32);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// opts.still = lies still across the lake (doesn't drift or turn): jump over it!
function makeLog(x, z, opts = {}) {
  const c = OBSTACLES.log;
  const group = new THREE.Group();
  const turner = new THREE.Group(); // slowly swings the log left/right as it drifts
  // Cylinder materials: [side, top end, bottom end]
  const log = new THREE.Mesh(makeBarkGeometry(c.radius, c.length), [M.bark, M.logEnd, M.logEnd]);
  log.rotation.z = Math.PI / 2; // lie down, pointing along X
  log.castShadow = true;
  // A couple of broken-off branch stubs for character
  const stubGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.9, 10);
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
    if (opts.still) {
      group.position.set(posX, getWaveHeight(posX, z, time) + 0.1, z);
      return;
    }
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
    // (h = half its height: the log sticks up about 0.7 above the water.)
    return [
      { x: posX - ax, z: z - az, r, y: 0.1, h: 0.6 },
      { x: posX, z, r, y: 0.1, h: 0.6 },
      { x: posX + ax, z: z + az, r, y: 0.1, h: 0.6 },
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

// How far from the shore each type's center must be (setpieces.js uses this too).
export const SHORE_MARGIN = {
  bass: OBSTACLES.bass.jumpDistance / 2 + 2,
  pike: 5,
  turtle: 4,
  lure: 4 + OBSTACLES.lure.lineLength * Math.sin(OBSTACLES.lure.swingAngle),
  log: 3,
  lily: OBSTACLES.lily.patchRadius + 1,
  whirlpool: OBSTACLES.whirlpool.radius * 0.7,
};

export function createObstacles(scene) {
  let list = [];

  // Remove the old obstacles and put new ones exactly where the course plan says
  // (see setpieces.js). spots = [{ type, x, z, opts }]
  function place(spots) {
    for (const o of list) scene.remove(o.group);
    list = [];
    for (const { type, x, z, opts } of spots) {
      if (type === 'whirlpool' && !OBSTACLES.includeWhirlpools) continue;
      add(MAKERS[type](x, z, opts));
      // Some whirlpools have a pike circling in the middle, waiting...
      if (type === 'whirlpool' && Math.random() < OBSTACLES.whirlpool.pikeChance) add(makePike(x, z, { x, z }));
    }
  }

  function add(obstacle) {
    // The cartoon look (whirlpools are swirly water, so they stay as they are).
    if (obstacle.type !== 'whirlpool') cartoon(obstacle.group);
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

  return { place, update, getHitCircles, isClear, zap, get list() { return list; } };
}
