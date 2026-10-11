// world.js
// Builds everything that makes up the lake setting:
// the animated water, the curvy shoreline with beaches and hills, the wooden dock,
// trees, rocks and reeds.
//
// It also exports helper functions other files use:
//   getWaveHeight(x, z, t) – how high the water is at a spot (so things can float)
//   getLakeEdges(z)        – the left and right shore at a given Z (so the bobber stays in)

import * as THREE from 'three';
import { LAKE, DOCK, SHORE, COURSE, COLORS } from './config.js';

// Front and back ends of the water.
export const WATER_BOUNDS = {
  minZ: -LAKE.length - LAKE.extraPastFinish, // far shore
  maxZ: LAKE.extraBehindStart,               // shore behind the dock
};

// ---------------------------------------------------------------------------
// Lake shape
// ---------------------------------------------------------------------------
// The lake is described by two smooth curves along Z:
//   lakeCenterX(z)  – where the middle of the lake is (makes it bend left/right)
//   lakeHalfWidth(z) – half of how wide it is (makes it wider/narrower)
// Each curve adds a few sine waves of different lengths. Because the lengths don't
// line up, the result looks irregular, like a real lake, but it's the same every time.

// 0 near the dock, smoothly rising to 1 further out, so the start area stays straight.
function shapeFade(z) {
  return THREE.MathUtils.smoothstep(-z, 0, LAKE.straightStart);
}

export function lakeCenterX(z) {
  const bend = Math.sin(z * 0.012 + 0.5) * 0.7 + Math.sin(z * 0.037 + 1.7) * 0.3;
  return shapeFade(z) * LAKE.bendAmount * bend;
}

export function lakeHalfWidth(z) {
  const wiggle =
    Math.sin(z * 0.019 + 1.0) * 0.55 +
    Math.sin(z * 0.053 + 2.3) * 0.3 +
    Math.sin(z * 0.11 + 0.4) * 0.15;
  return LAKE.width / 2 + shapeFade(z) * LAKE.widthWiggle * wiggle;
}

// Left and right edge of the water at this Z. The bobber is kept between these.
export function getLakeEdges(z) {
  const c = lakeCenterX(z);
  const h = lakeHalfWidth(z);
  return { minX: c - h, maxX: c + h };
}

// How far a point is from the water's edge.
// Negative = in the water, positive = on land.
function distanceFromShore(x, z) {
  const sideways = Math.abs(x - lakeCenterX(z)) - lakeHalfWidth(z);
  const pastFar = WATER_BOUNDS.minZ - z;  // positive past the far shore
  const pastNear = z - WATER_BOUNDS.maxZ; // positive behind the dock
  // The biggest of the three tells us which edge is closest to being "outside".
  let d = Math.max(sideways, pastFar, pastNear);
  // Little bumps and coves. They only push the shoreline OUTWARD (d gets smaller),
  // so everything inside getLakeEdges() is always water.
  const bumps = (Math.sin(x * 0.31 + z * 0.17) + Math.sin(x * 0.13 - z * 0.29 + 2.0)) * 0.25 + 0.5;
  d -= bumps * LAKE.shoreBumps;
  return d;
}

// Height of the land at (x, z): a sandy slope under the water, a beach, then hills.
export function getTerrainHeight(x, z) {
  const d = distanceFromShore(x, z);
  if (d < 0) {
    // Under water: the bottom slopes down gently, so shallow water near the shore.
    return Math.max(-4, d * 0.35) - 0.1;
  }
  if (d < SHORE.sandWidth) {
    // Beach: rises from the waterline up to 0.7
    return (d / SHORE.sandWidth) * 0.7;
  }
  // Grass: gentle bumps close to the beach, growing into hills further away.
  const far = THREE.MathUtils.clamp((d - SHORE.sandWidth - 8) / 50, 0, 1);
  const hills = SHORE.hillHeight * (0.7 + 0.5 * Math.sin(x * 0.05) * Math.cos(z * 0.04));
  const bumps = 0.3 * Math.sin(x * 0.4) * Math.sin(z * 0.35);
  return 0.7 + far * far * hills + bumps;
}

// ---------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------
// Height of the water surface at point (x, z) at time t (seconds).
// Four sine waves travel in different directions at different speeds and lengths.
// Because their lengths aren't multiples of each other, the pattern never looks
// perfectly regular. A slow "swell" makes some patches calmer than others.
export function getWaveHeight(x, z, t) {
  const k = (Math.PI * 2) / LAKE.waveLength; // turns distance into an angle
  const s = LAKE.waveSpeed;
  const w1 = Math.sin(z * k + t * s);
  const w2 = Math.sin((x * 0.8 + z * 0.45) * k * 0.71 + t * s * 1.31);
  const w3 = Math.sin((-x * 0.6 + z * 0.3) * k * 1.73 + t * s * 0.83 + 1.7);
  const w4 = Math.sin((x * 0.25 - z * 0.9) * k * 2.37 + t * s * 1.9 + 4.1);
  const swell = 0.65 + 0.35 * Math.sin(x * 0.031 + z * 0.017 + t * 0.25);
  return LAKE.waveHeight * swell * (0.45 * w1 + 0.3 * w2 + 0.15 * w3 + 0.1 * w4);
}

// ---------------------------------------------------------------------------
// Build the world
// ---------------------------------------------------------------------------
export function createWorld(scene) {
  const water = createWater();
  scene.add(water);

  scene.add(createTerrain());
  scene.add(createDock());
  scene.add(createTrees());
  scene.add(createRocks());
  scene.add(createReeds());
  scene.add(createStartLine());
  scene.add(createFinish());

  // Every water point gets its own random amount of extra "chop" and its own timing,
  // so the surface looks less perfect.
  const pos = water.geometry.attributes.position;
  const chopAmount = new Float32Array(pos.count);
  const chopPhase = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    chopAmount[i] = Math.random();
    chopPhase[i] = Math.random() * Math.PI * 2;
  }

  // Called every frame to animate the waves.
  function update(time) {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const chop = LAKE.waveRandomness * chopAmount[i] * Math.sin(time * 2.2 + chopPhase[i]);
      pos.setY(i, getWaveHeight(x, z, time) + chop);
    }
    pos.needsUpdate = true;
  }

  return { update };
}

// ---------------------------------------------------------------------------
// Water: one big see-through sheet. The land covers it outside the lake.
// ---------------------------------------------------------------------------
function createWater() {
  // Wide enough to cover the lake at its widest and most bent point.
  const halfX = LAKE.width / 2 + LAKE.widthWiggle + LAKE.bendAmount + LAKE.shoreBumps + 10;
  const minZ = WATER_BOUNDS.minZ - 10;
  const maxZ = WATER_BOUNDS.maxZ + 10;
  const width = halfX * 2;
  const length = maxZ - minZ;

  const geo = new THREE.PlaneGeometry(
    width,
    length,
    Math.round(width / LAKE.waterCellSize),
    Math.round(length / LAKE.waterCellSize)
  );
  geo.rotateX(-Math.PI / 2); // PlaneGeometry stands up like a wall; lay it flat
  geo.translate(0, 0, (minZ + maxZ) / 2);

  // Give each point a slightly different shade of blue-green so the water isn't one flat color.
  const base = new THREE.Color(COLORS.water);
  const colors = [];
  const tmp = new THREE.Color();
  for (let i = 0; i < geo.attributes.position.count; i++) {
    tmp.copy(base).offsetHSL(
      THREE.MathUtils.randFloatSpread(0.02),
      0,
      THREE.MathUtils.randFloatSpread(0.05)
    );
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.3,
    metalness: 0.1,
    flatShading: true, // gives the low-poly faceted look
    transparent: true,
    opacity: LAKE.waterOpacity,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// Terrain: one big bumpy sheet for the lake bottom, beaches and hills.
// ---------------------------------------------------------------------------
function createTerrain() {
  const halfX = LAKE.width / 2 + SHORE.landSize;
  const minZ = WATER_BOUNDS.minZ - SHORE.landSize;
  const maxZ = WATER_BOUNDS.maxZ + SHORE.landSize;
  const width = halfX * 2;
  const length = maxZ - minZ;

  const geo = new THREE.PlaneGeometry(
    width,
    length,
    Math.round(width / SHORE.terrainCellSize),
    Math.round(length / SHORE.terrainCellSize)
  );
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, (minZ + maxZ) / 2);

  // Move each point up or down to the terrain height, and color it by what it is.
  const pos = geo.attributes.position;
  const colors = [];
  const sand = new THREE.Color(COLORS.sand);
  const wetSand = new THREE.Color(COLORS.wetSand);
  const grass = new THREE.Color(COLORS.grass);
  const grassDark = new THREE.Color(COLORS.grassDark);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getTerrainHeight(x, z);
    pos.setY(i, y);

    const d = distanceFromShore(x, z);
    // A little noise on the sand/grass border so it isn't a perfect line.
    const edgeNoise = Math.sin(x * 0.5) * Math.cos(z * 0.45) * 1.5;
    if (d < 0) c.copy(wetSand);
    else if (d < SHORE.sandWidth + edgeNoise) c.copy(sand);
    else c.copy(grass).lerp(grassDark, THREE.MathUtils.clamp(y / SHORE.hillHeight, 0, 1));
    c.offsetHSL(0, 0, THREE.MathUtils.randFloatSpread(0.04));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// Dock: planks on posts, running from the near shore out to the start line (Z = 0)
// ---------------------------------------------------------------------------
function createDock() {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: COLORS.wood, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: COLORS.woodDark, flatShading: true });

  // The dock reaches from Z = 0 back onto the beach.
  const length = WATER_BOUNDS.maxZ + SHORE.sandWidth;
  const h = DOCK.deckHeight;

  // Planks: thin boxes lying across the dock, with a small gap between each.
  const plankCount = Math.floor(length / DOCK.plankWidth);
  const plankGeo = new THREE.BoxGeometry(DOCK.width, 0.2, DOCK.plankWidth * 0.9);
  for (let i = 0; i < plankCount; i++) {
    const plank = new THREE.Mesh(plankGeo, i % 2 ? woodMat : darkMat);
    plank.position.set(0, h, i * DOCK.plankWidth + DOCK.plankWidth / 2);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }

  // Posts: a grid of cylinders under the dock, going down into the water.
  // Along the two side edges, railing posts poke up above the deck too.
  const postGeo = new THREE.CylinderGeometry(0.3, 0.3, h + 5, 8);
  const railPostGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6);
  const edgeX = DOCK.width / 2 - 0.3;
  const postsAcross = Math.max(1, Math.round(DOCK.width / DOCK.postSpacing));
  for (let z = 0.5; z <= length; z += DOCK.postSpacing) {
    for (let i = 0; i <= postsAcross; i++) {
      const x = -edgeX + (i / postsAcross) * edgeX * 2;
      const post = new THREE.Mesh(postGeo, darkMat);
      post.position.set(x, (h - 5) / 2, z);
      group.add(post);
    }
    for (const side of [-1, 1]) {
      const railPost = new THREE.Mesh(railPostGeo, darkMat);
      railPost.position.set(side * edgeX, h + 0.6, z);
      group.add(railPost);
    }
  }

  // Top rails along both sides
  const railGeo = new THREE.BoxGeometry(0.15, 0.15, length);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeo, woodMat);
    rail.position.set(side * (DOCK.width / 2 - 0.3), h + 1.2, length / 2);
    rail.castShadow = true;
    group.add(rail);
  }

  // Tackle box sitting on the dock
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.7, 0.7),
    new THREE.MeshStandardMaterial({ color: COLORS.tackleBox, flatShading: true })
  );
  box.position.set(-2.4, h + 0.45, 6);
  box.rotation.y = 0.3;
  box.castShadow = true;
  group.add(box);
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.05, 6, 12, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  handle.position.set(-2.4, h + 0.8, 6);
  handle.rotation.y = 0.3;
  group.add(handle);

  // Fishing rod leaning against the right railing
  const rodMat = new THREE.MeshStandardMaterial({ color: COLORS.rod });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 5, 6), rodMat);
  rod.position.set(DOCK.width / 2 - 0.8, h + 2.0, 8);
  rod.rotation.z = -0.35; // tilt so it leans on the rail
  rod.rotation.x = 0.25;
  rod.castShadow = true;
  group.add(rod);
  const reel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0xb0b0b0, metalness: 0.6, roughness: 0.3 })
  );
  reel.position.set(DOCK.width / 2 - 0.45, h + 0.8, 7.7);
  reel.rotation.z = Math.PI / 2;
  group.add(reel);

  return group;
}

// ---------------------------------------------------------------------------
// Start line: a white stripe painted across the end of the dock, with a little flag
// ---------------------------------------------------------------------------
function createStartLine() {
  const group = new THREE.Group();
  const h = DOCK.deckHeight;

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(DOCK.width - 1, 0.05, 0.8),
    new THREE.MeshStandardMaterial({ color: COLORS.startLine })
  );
  stripe.position.set(0, h + 0.12, 0.8);
  stripe.receiveShadow = true;
  group.add(stripe);

  // Flag: a thin pole with a triangle-ish flag (a thin box) near the top.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 3, 6),
    new THREE.MeshStandardMaterial({ color: 0xdddddd })
  );
  pole.position.set(COURSE.startFlagX, h + 1.6, 0.8);
  pole.castShadow = true;
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.7, 0.04),
    new THREE.MeshStandardMaterial({ color: COLORS.flag })
  );
  flag.position.set(COURSE.startFlagX + 0.65, h + 2.7, 0.8);
  flag.castShadow = true;
  group.add(pole, flag);
  return group;
}

// ---------------------------------------------------------------------------
// Finish: two tall red-and-white striped buoy posts with a checkered banner on top
// ---------------------------------------------------------------------------

// Draws a black-and-white checkerboard on a hidden canvas and turns it into a texture.
// (We draw it ourselves, so no image files are needed.)
function makeCheckerTexture(columns, rows) {
  const size = 32; // pixels per square
  const canvas = document.createElement('canvas');
  canvas.width = columns * size;
  canvas.height = rows * size;
  const ctx = canvas.getContext('2d');
  for (let cx = 0; cx < columns; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      ctx.fillStyle = (cx + cy) % 2 === 0 ? '#111111' : '#ffffff';
      ctx.fillRect(cx * size, cy * size, size, size);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFinish() {
  const group = new THREE.Group();
  const z = COURSE.finishZ;
  const centerX = lakeCenterX(z);
  const half = COURSE.finishWidth / 2;
  const height = COURSE.finishHeight;
  const red = new THREE.MeshStandardMaterial({ color: COLORS.finishRed, flatShading: true });
  const white = new THREE.MeshStandardMaterial({ color: COLORS.finishWhite, flatShading: true });

  // Each post is a stack of short cylinders, alternating red and white.
  const stripes = 6;
  const stripeHeight = height / stripes;
  const stripeGeo = new THREE.CylinderGeometry(1.3, 1.5, stripeHeight, 12);
  for (const side of [-1, 1]) {
    const post = new THREE.Group();
    for (let i = 0; i < stripes; i++) {
      const piece = new THREE.Mesh(stripeGeo, i % 2 ? white : red);
      piece.position.y = i * stripeHeight + stripeHeight / 2 - 1; // starts a little under water
      piece.castShadow = true;
      post.add(piece);
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), red);
    ball.position.y = height - 0.5;
    ball.castShadow = true;
    post.add(ball);
    post.position.set(centerX + side * half, 0, z);
    group.add(post);
  }

  // Checkered banner stretched between the two posts.
  const bannerWidth = COURSE.finishWidth;
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(bannerWidth, 2.4, 0.3),
    new THREE.MeshStandardMaterial({ map: makeCheckerTexture(Math.round(bannerWidth / 1.2), 2) })
  );
  banner.position.set(centerX, height - 2, z);
  banner.castShadow = true;
  group.add(banner);

  // A see-through checkered strip on the water marks the exact finish line.
  const lineTex = makeCheckerTexture(Math.round(bannerWidth / 1.5), 1);
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(bannerWidth, 1.5),
    new THREE.MeshBasicMaterial({ map: lineTex, transparent: true, opacity: 0.6, depthWrite: false })
  );
  line.rotation.x = -Math.PI / 2;
  line.position.set(centerX, 0.6, z);
  group.add(line);

  return group;
}

// ---------------------------------------------------------------------------
// Trees, rocks and reeds
// ---------------------------------------------------------------------------

// Picks a random spot whose distance from the water is between minD and maxD.
function randomSpotNearShore(minD, maxD) {
  const halfX = LAKE.width / 2 + SHORE.landSize - 10;
  for (let tries = 0; tries < 1000; tries++) {
    const x = THREE.MathUtils.randFloat(-halfX, halfX);
    const z = THREE.MathUtils.randFloat(WATER_BOUNDS.minZ - 60, WATER_BOUNDS.maxZ + 60);
    const d = distanceFromShore(x, z);
    const nearDock = Math.abs(x) < DOCK.width / 2 + 4 && z > -2; // keep the dock clear
    if (d >= minD && d <= maxD && !nearDock) return { x, z };
  }
  return { x: 0, z: WATER_BOUNDS.maxZ + 60 };
}

function createTrees() {
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 3, 6);
  const leafGeo = new THREE.ConeGeometry(2.2, 6, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.trunk, flatShading: true });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: COLORS.leaves, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: COLORS.leavesLight, flatShading: true }),
  ];

  for (let i = 0; i < SHORE.treeCount; i++) {
    const { x, z } = randomSpotNearShore(SHORE.sandWidth + 2, 70);
    const scale = THREE.MathUtils.randFloat(0.8, 1.7);
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5;
    const leaves = new THREE.Mesh(leafGeo, leafMats[i % 2]);
    leaves.position.y = 5.5;
    trunk.castShadow = true;
    leaves.castShadow = true;
    tree.add(trunk, leaves);
    tree.position.set(x, getTerrainHeight(x, z) - 0.2, z);
    tree.scale.setScalar(scale);
    tree.rotation.y = Math.random() * Math.PI;
    group.add(tree);
  }
  return group;
}

function createRocks() {
  const group = new THREE.Group();
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: COLORS.rock, flatShading: true });

  for (let i = 0; i < SHORE.rockCount; i++) {
    // Rocks sit on the beach, some right at the waterline.
    const { x, z } = randomSpotNearShore(0, SHORE.sandWidth + 4);
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, getTerrainHeight(x, z), z);
    rock.scale.set(
      THREE.MathUtils.randFloat(0.6, 1.8),
      THREE.MathUtils.randFloat(0.4, 1.1),
      THREE.MathUtils.randFloat(0.6, 1.8)
    );
    rock.rotation.y = Math.random() * Math.PI;
    rock.castShadow = true;
    group.add(rock);
  }
  return group;
}

// Cattails: a few thin green stalks with a brown tip, growing right at the water's edge.
function createReeds() {
  const group = new THREE.Group();
  const stalkGeo = new THREE.CylinderGeometry(0.04, 0.06, 2.4, 4);
  const tipGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.5, 6);
  const stalkMat = new THREE.MeshStandardMaterial({ color: COLORS.reed, flatShading: true });
  const tipMat = new THREE.MeshStandardMaterial({ color: COLORS.cattail, flatShading: true });

  for (let i = 0; i < SHORE.reedCount; i++) {
    const { x, z } = randomSpotNearShore(-0.5, 1.5);
    const clump = new THREE.Group();
    const stalks = THREE.MathUtils.randInt(3, 6);
    for (let s = 0; s < stalks; s++) {
      const stalk = new THREE.Group();
      const stem = new THREE.Mesh(stalkGeo, stalkMat);
      stem.position.y = 1.2;
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.y = 2.2;
      stalk.add(stem, tip);
      stalk.position.set(THREE.MathUtils.randFloatSpread(1.2), 0, THREE.MathUtils.randFloatSpread(1.2));
      stalk.rotation.set(THREE.MathUtils.randFloatSpread(0.3), 0, THREE.MathUtils.randFloatSpread(0.3));
      stalk.scale.setScalar(THREE.MathUtils.randFloat(0.7, 1.2));
      clump.add(stalk);
    }
    clump.position.set(x, Math.max(getTerrainHeight(x, z), -0.3), z);
    group.add(clump);
  }
  return group;
}
