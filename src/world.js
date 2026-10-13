// world.js
// Builds the scenery for the current level:
//   Home Lake  – a curvy lake with beaches, hills, trees, reeds and a wooden dock
//   Space Lakes – lakes on floating islands among the stars, with gaps to fly across
// Every level ends with a swirling portal.
//
// It also exports helper functions other files use:
//   setLevel(level)        – choose which level the helpers below describe
//   getWaveHeight(x, z, t) – how high the water is at a spot (so things can float)
//   getLakeEdges(z)        – the left and right shore at a given Z (so the bobber stays in)
//   isOverLake(z)          – is there a lake at this Z, or a gap (empty space)?
//   getWaterBounds()       – the nearest and farthest water in the level

import * as THREE from 'three';
import { LAKE, DOCK, SHORE, COURSE, PORTAL, LEVELS, THEMES, COLORS, MOBILE } from './config.js';
import { isTouchDevice } from './device.js';

// Size of the squares in the water and land meshes (bigger on phones = faster).
const WATER_CELL = isTouchDevice ? MOBILE.waterCellSize : LAKE.waterCellSize;
const LAND_CELL = isTouchDevice ? MOBILE.terrainCellSize : SHORE.terrainCellSize;

// ---------------------------------------------------------------------------
// The current level
// ---------------------------------------------------------------------------
let level = LEVELS[0];

export function setLevel(newLevel) {
  level = newLevel;
}
export function getLevel() {
  return level;
}
export function getTheme() {
  return THEMES[level.theme];
}

// Near end (start side) and far end of all the water in this level.
export function getWaterBounds() {
  return { maxZ: level.lakes[0].start, minZ: level.lakes[level.lakes.length - 1].end };
}

// The lake at this Z (or null over a gap).
export function getLakeAt(z) {
  return level.lakes.find((lake) => z <= lake.start && z >= lake.end) || null;
}

// Is there a lake at this Z? margin = also stay this far from the lake's ends.
export function isOverLake(z, margin = 0) {
  return level.lakes.some((lake) => z <= lake.start - margin && z >= lake.end + margin);
}

// ---------------------------------------------------------------------------
// Lake shape
// ---------------------------------------------------------------------------
// Each lake follows two smooth curves along Z:
//   lakeCenterX(z)   – where the middle of the lake is (makes it bend left/right)
//   lakeHalfWidth(z) – half of how wide it is (makes it wider/narrower)
// Each curve adds a few sine waves of different lengths. Because the lengths don't
// line up, the result looks irregular, like a real lake, but it's the same every time.

// 0 near the start, smoothly rising to 1 further out, so the start area stays straight.
function shapeFade(z) {
  return THREE.MathUtils.smoothstep(-z, 0, LAKE.straightStart);
}

export function lakeCenterX(z) {
  const bend = Math.sin(z * 0.012 + 0.5) * 0.7 + Math.sin(z * 0.037 + 1.7) * 0.3;
  return shapeFade(z) * level.bend * bend;
}

export function lakeHalfWidth(z) {
  const wiggle =
    Math.sin(z * 0.019 + 1.0) * 0.55 +
    Math.sin(z * 0.053 + 2.3) * 0.3 +
    Math.sin(z * 0.11 + 0.4) * 0.15;
  return LAKE.width / 2 + shapeFade(z) * level.widthWiggle * wiggle;
}

// Left and right edge of the water at this Z. The bobber is kept between these.
export function getLakeEdges(z) {
  const c = lakeCenterX(z);
  const h = lakeHalfWidth(z);
  return { minX: c - h, maxX: c + h };
}

// How far a point is from the water's edge. Negative = in the water, positive = on land.
// onlyLake: measure from just that one lake (used to build each floating island).
function distanceFromShore(x, z, onlyLake = null) {
  const sideways = Math.abs(x - lakeCenterX(z)) - lakeHalfWidth(z);
  // How far past the end of the nearest lake we are (negative = between its ends).
  let along = Infinity;
  for (const lake of onlyLake ? [onlyLake] : level.lakes) {
    along = Math.min(along, Math.max(z - lake.start, lake.end - z));
  }
  // Floating islands end soon after the water at their front and back (×2.5 makes the
  // beach and rim there much shorter), so there's open space between islands to fly over.
  if (getTheme().islands) along *= 2.5;
  // The biggest of the two tells us which edge is closest to being "outside".
  let d = Math.max(sideways, along);
  // Little bumps and coves. They only push the shoreline OUTWARD (d gets smaller),
  // so everything inside getLakeEdges() is always water.
  const bumps = (Math.sin(x * 0.31 + z * 0.17) + Math.sin(x * 0.13 - z * 0.29 + 2.0)) * 0.25 + 0.5;
  d -= bumps * LAKE.shoreBumps;
  return d;
}

// Height of the land at (x, z): a sandy slope under the water, a beach, then
// hills (Home Lake) or a rim that drops off into space (floating islands).
export function getTerrainHeight(x, z, onlyLake = null) {
  const d = distanceFromShore(x, z, onlyLake);
  if (d < 0) {
    // Under water: the bottom slopes down gently, so shallow water near the shore.
    return Math.max(-4, d * 0.35) - 0.1;
  }
  if (d < SHORE.sandWidth) {
    // Beach: rises from the waterline up to 0.7
    return (d / SHORE.sandWidth) * 0.7;
  }
  const bumps = 0.3 * Math.sin(x * 0.4) * Math.sin(z * 0.35);
  if (getTheme().islands) {
    // Floating island: a grassy rim, then a cliff straight down.
    const pastRim = d - SHORE.sandWidth - SHORE.islandRim;
    if (pastRim < 0) return 0.7 + bumps;
    return Math.max(-8, 0.7 - pastRim * 4);
  }
  // Grass: gentle bumps close to the beach, growing into hills further away.
  const far = THREE.MathUtils.clamp((d - SHORE.sandWidth - 8) / 50, 0, 1);
  const hills = SHORE.hillHeight * (0.7 + 0.5 * Math.sin(x * 0.05) * Math.cos(z * 0.04));
  return 0.7 + far * far * hills + bumps;
}

// ---------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------
// Height of the water surface at point (x, z) at time t (seconds).
// Four sine waves travel in different directions at different speeds and lengths.
// Because their lengths aren't multiples of each other, the pattern never looks
// perfectly regular. A slow "swell" makes some patches calmer than others.
// (Over a gap between space lakes there is no water, so the height is just 0.)
export function getWaveHeight(x, z, t) {
  if (!isOverLake(z)) return 0;
  return waveFormula(x, z, t);
}

// The wave math itself, without the gap check. The water meshes use this directly,
// because they already know which of their points are lake (it's faster).
function waveFormula(x, z, t) {
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
// Build the world for the current level
// ---------------------------------------------------------------------------
// Returns { update(time), dispose() }. dispose() removes everything again,
// so the next level can be built in its place.
export function createWorld(scene) {
  const theme = getTheme();
  const root = new THREE.Group(); // everything for this level goes in here
  scene.add(root);

  // Water: one sheet per lake. Each knows which of its points are really lake
  // (the rest are tucked away under the land).
  const waters = [];
  const lakesToFill = theme.islands ? level.lakes : [null]; // null = one sheet for the whole level
  for (const lake of lakesToFill) {
    const water = createWater(theme, lake);
    root.add(water.mesh);
    waters.push(water);
  }

  if (theme.islands) {
    for (const lake of level.lakes) root.add(createIsland(theme, lake));
    root.add(createCrystals(theme));
    root.add(createSpaceSky());
    root.add(createSpaceStartLine(theme));
  } else {
    root.add(createTerrain(theme));
    root.add(createDock());
    root.add(createTrees());
    root.add(createReeds());
    root.add(createStartLine());
  }
  root.add(createRocks(theme));
  const portal = createPortal(theme);
  root.add(portal.group);

  // Called every frame to animate the waves and the portal.
  function update(time) {
    for (const w of waters) w.update(time);
    portal.update(time);
  }

  // Remove this level's scenery and free its memory.
  function dispose() {
    scene.remove(root);
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    });
  }

  return { update, dispose };
}

// ---------------------------------------------------------------------------
// Water: a see-through, gently waving sheet
// ---------------------------------------------------------------------------
// lake = one lake (space islands), or null = cover the whole level (Home Lake).
function createWater(theme, lake) {
  // Wide enough to cover the lake at its widest and most bent point.
  const halfX = LAKE.width / 2 + level.widthWiggle + level.bend + LAKE.shoreBumps + 10;
  const bounds = getWaterBounds();
  const maxZ = (lake ? lake.start : bounds.maxZ) + 10;
  const minZ = (lake ? lake.end : bounds.minZ) - 10;
  const width = halfX * 2;
  const length = maxZ - minZ;

  const geo = new THREE.PlaneGeometry(
    width,
    length,
    Math.round(width / WATER_CELL),
    Math.round(length / WATER_CELL)
  );
  geo.rotateX(-Math.PI / 2); // PlaneGeometry stands up like a wall; lay it flat
  geo.translate(0, 0, (minZ + maxZ) / 2);
  const pos = geo.attributes.position;

  // Each point gets: a slightly different color, its own random "chop", and a flag
  // saying whether it's really lake. Points that aren't are pushed far down, out of
  // sight under the island (otherwise water would hang in space past the island's edge).
  const base = new THREE.Color(theme.water);
  const colors = [];
  const tmp = new THREE.Color();
  const chopAmount = new Float32Array(pos.count);
  const chopPhase = new Float32Array(pos.count);
  const isLake = new Uint8Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    tmp.copy(base).offsetHSL(THREE.MathUtils.randFloatSpread(0.02), 0, THREE.MathUtils.randFloatSpread(0.05));
    colors.push(tmp.r, tmp.g, tmp.b);
    chopAmount[i] = Math.random();
    chopPhase[i] = Math.random() * Math.PI * 2;
    isLake[i] = !lake || distanceFromShore(pos.getX(i), pos.getZ(i), lake) < SHORE.sandWidth ? 1 : 0;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.3,
    metalness: 0.1,
    flatShading: true, // gives the low-poly faceted look
    transparent: true,
    opacity: LAKE.waterOpacity,
    // Space water glows a little, like it's magic.
    emissive: theme.islands ? theme.water : 0x000000,
    emissiveIntensity: theme.islands ? 0.12 : 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  for (let i = 0; i < pos.count; i++) if (!isLake[i]) pos.setY(i, -30);

  // Animate the waves: move every point to the wave height (plus its own chop).
  function update(time) {
    for (let i = 0; i < pos.count; i++) {
      if (!isLake[i]) continue; // tucked away under the island (set once, below)
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const chop = LAKE.waveRandomness * chopAmount[i] * Math.sin(time * 2.2 + chopPhase[i]);
      pos.setY(i, waveFormula(x, z, time) + chop);
    }
    pos.needsUpdate = true;
  }

  return { mesh, update };
}

// ---------------------------------------------------------------------------
// Land
// ---------------------------------------------------------------------------
// Builds a bumpy sheet of land covering the given area, shaped by getTerrainHeight()
// and colored as wet sand (under water), beach, or grass.
function createLandSheet(theme, minX, maxX, minZ, maxZ, onlyLake) {
  const width = maxX - minX;
  const length = maxZ - minZ;
  const geo = new THREE.PlaneGeometry(
    width,
    length,
    Math.round(width / LAND_CELL),
    Math.round(length / LAND_CELL)
  );
  geo.rotateX(-Math.PI / 2);
  geo.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);

  // Move each point up or down to the terrain height, and color it by what it is.
  const pos = geo.attributes.position;
  const colors = [];
  const sand = new THREE.Color(theme.sand);
  const wetSand = new THREE.Color(theme.wetSand);
  const grass = new THREE.Color(theme.grass);
  const grassDark = new THREE.Color(theme.grassDark);
  const rock = new THREE.Color(theme.rock || COLORS.rock);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getTerrainHeight(x, z, onlyLake);
    pos.setY(i, y);

    const d = distanceFromShore(x, z, onlyLake);
    // A little noise on the sand/grass border so it isn't a perfect line.
    const edgeNoise = Math.sin(x * 0.5) * Math.cos(z * 0.45) * 1.5;
    if (d < 0) c.copy(wetSand);
    else if (d < SHORE.sandWidth + edgeNoise) c.copy(sand);
    else if (y < 0.3) c.copy(rock); // island cliff edge
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

// Home Lake: one big sheet for the lake bottom, beaches and hills.
function createTerrain(theme) {
  const bounds = getWaterBounds();
  const halfX = LAKE.width / 2 + SHORE.landSize;
  return createLandSheet(theme, -halfX, halfX, bounds.minZ - SHORE.landSize, bounds.maxZ + SHORE.landSize, null);
}

// Space: a floating island around one lake. The top is a land sheet; underneath hangs
// a big upside-down rocky cone, so it looks like a chunk of land floating in space.
function createIsland(theme, lake) {
  const group = new THREE.Group();
  const reach = SHORE.sandWidth + SHORE.islandRim + 4; // how far the island goes past the water
  const reachZ = reach / 2.5 + 2; // much shorter at the front and back (see distanceFromShore)
  const halfX = LAKE.width / 2 + level.widthWiggle + level.bend + reach;
  group.add(createLandSheet(theme, -halfX, halfX, lake.end - reachZ, lake.start + reachZ, lake));

  // The rocky underside. A cone pointing down, stretched to the island's shape.
  // (Multiplying the half-sizes by 1.2 makes the cone's top reach out near the corners.)
  const halfZ = (lake.start - lake.end) / 2 + reachZ;
  const depth = 50;
  const coneGeo = new THREE.ConeGeometry(1, depth, 10, 4);
  // Push each point in or out a little so the rock looks rough, not smooth.
  const p = coneGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const wobble = 1 + THREE.MathUtils.randFloatSpread(0.25);
    p.setX(i, p.getX(i) * wobble);
    p.setZ(i, p.getZ(i) * wobble);
  }
  coneGeo.computeVertexNormals();
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshStandardMaterial({ color: theme.rock, flatShading: true }));
  cone.rotation.x = Math.PI; // point down
  cone.scale.set(halfX * 1.2, 1, halfZ * 1.2);
  cone.position.set(lakeCenterX((lake.start + lake.end) / 2), -8 - depth / 2, (lake.start + lake.end) / 2);
  group.add(cone);
  return group;
}

// ---------------------------------------------------------------------------
// Space sky: stars, planets and drifting rocks
// ---------------------------------------------------------------------------
function createSpaceSky() {
  const group = new THREE.Group();

  // Stars: lots of tiny points scattered on a huge ball around the course.
  // "fog: false" so the fog doesn't hide them.
  const starCount = 1500;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // A random direction: pick random angles around and up/down, then go out 700 units.
    const around = Math.random() * Math.PI * 2;
    const up = Math.acos(THREE.MathUtils.randFloatSpread(2));
    starPositions[i * 3] = 700 * Math.sin(up) * Math.cos(around);
    starPositions[i * 3 + 1] = 700 * Math.cos(up);
    starPositions[i * 3 + 2] = 700 * Math.sin(up) * Math.sin(around) - 200;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));

  // A big ringed planet and a small moon, far away.
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(70, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0xff9e6b, flatShading: true, fog: false })
  );
  planet.position.set(-320, 140, -720);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(115, 8, 2, 64),
    new THREE.MeshBasicMaterial({ color: 0xffd8a8, transparent: true, opacity: 0.6, fog: false })
  );
  ring.rotation.set(Math.PI / 2.4, 0.3, 0);
  planet.add(ring);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(28, 24, 12),
    new THREE.MeshStandardMaterial({ color: 0x9fb4ff, flatShading: true, fog: false })
  );
  moon.position.set(360, 90, -560);
  group.add(planet, moon);

  // Small rocks drifting below and beside the islands.
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a4b78, flatShading: true });
  for (let i = 0; i < 40; i++) {
    const rock = new THREE.Mesh(rockGeo, rockMat);
    const side = Math.random() < 0.5 ? -1 : 1;
    rock.position.set(side * THREE.MathUtils.randFloat(70, 160), THREE.MathUtils.randFloat(-60, 30), THREE.MathUtils.randFloat(-460, 40));
    rock.scale.setScalar(THREE.MathUtils.randFloat(1, 6));
    rock.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    group.add(rock);
  }
  return group;
}

// Glowing crystals growing on the island rims (instead of trees).
function createCrystals(theme) {
  const group = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(1, 0);
  const mats = theme.crystals.map(
    (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, flatShading: true })
  );
  for (let i = 0; i < SHORE.crystalCount; i++) {
    const { x, z } = randomSpotNearShore(SHORE.sandWidth + 1, SHORE.sandWidth + SHORE.islandRim - 1);
    const crystal = new THREE.Mesh(geo, mats[i % mats.length]);
    const size = THREE.MathUtils.randFloat(0.8, 2);
    crystal.scale.set(size * 0.6, size * 2, size * 0.6); // tall and pointy
    crystal.position.set(x, getTerrainHeight(x, z) + size, z);
    crystal.rotation.set(THREE.MathUtils.randFloatSpread(0.4), Math.random() * 3, THREE.MathUtils.randFloatSpread(0.4));
    crystal.castShadow = true;
    group.add(crystal);
  }
  return group;
}

// Space start line: a glowing strip across the water with two beacons.
function createSpaceStartLine(theme) {
  const group = new THREE.Group();
  const edges = getLakeEdges(0);
  const width = edges.maxX - edges.minX;
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 0.8),
    new THREE.MeshBasicMaterial({ color: theme.portalGlow, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set((edges.minX + edges.maxX) / 2, 0.5, 0.8);
  group.add(strip);
  const beaconMat = new THREE.MeshStandardMaterial({ color: theme.portalGlow, emissive: theme.portalGlow, emissiveIntensity: 0.8 });
  for (const x of [edges.minX - 2, edges.maxX + 2]) {
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 4, 8), beaconMat);
    beacon.position.set(x, 2.5, 0.8);
    group.add(beacon);
  }
  return group;
}

// ---------------------------------------------------------------------------
// The portal at the finish: a glowing ring with a swirl spinning inside it
// ---------------------------------------------------------------------------

// Draws a spiral on a hidden canvas, used as the swirling inside of the portal.
function makeSwirlTexture(colorA, colorB) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const a = '#' + new THREE.Color(colorA).getHexString();
  const b = '#' + new THREE.Color(colorB).getHexString();
  // A soft glow from the middle outward...
  const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  glow.addColorStop(0, '#ffffff');
  glow.addColorStop(0.12, b);
  glow.addColorStop(0.6, a);
  glow.addColorStop(1, '#1a0b3d');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  // ...with spiral arms on top. Each arm is a line that winds outward as the angle grows.
  ctx.strokeStyle = b;
  ctx.lineWidth = 10;
  for (let arm = 0; arm < 4; arm++) {
    ctx.beginPath();
    for (let t = 0; t < 1; t += 0.01) {
      const angle = arm * (Math.PI / 2) + t * Math.PI * 3;
      const r = t * size * 0.5;
      const x = size / 2 + Math.cos(angle) * r;
      const y = size / 2 + Math.sin(angle) * r;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPortal(theme) {
  const group = new THREE.Group();
  const z = level.finishZ;
  group.position.set(lakeCenterX(z), PORTAL.centerHeight, z);

  // The ring: a fat glowing donut standing upright.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(PORTAL.radius, PORTAL.tube, 12, 48),
    new THREE.MeshStandardMaterial({ color: theme.portal, emissive: theme.portal, emissiveIntensity: 0.7, roughness: 0.3 })
  );
  group.add(ring);

  // Two swirl discs inside, spinning in opposite directions for a deep, magical look.
  // The back one is solid; the front one is see-through and "adds" light on top.
  const texture = makeSwirlTexture(theme.portal, theme.portalGlow);
  const discs = [0.95, 0.35].map((opacity, i) => {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(PORTAL.radius - 0.3, 48),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        blending: i === 0 ? THREE.NormalBlending : THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    disc.position.z = i * 0.4; // the see-through one in front
    group.add(disc);
    return disc;
  });

  // Little sparkles orbiting around the ring.
  const sparkleGeo = new THREE.OctahedronGeometry(0.35);
  const sparkleMat = new THREE.MeshBasicMaterial({ color: theme.portalGlow });
  const sparkles = [];
  for (let i = 0; i < 18; i++) {
    const s = new THREE.Mesh(sparkleGeo, sparkleMat);
    group.add(s);
    sparkles.push({ mesh: s, offset: (i / 18) * Math.PI * 2, wobble: Math.random() * 3 });
  }

  function update(time) {
    discs[0].rotation.z = time * PORTAL.spinSpeed;
    discs[1].rotation.z = -time * PORTAL.spinSpeed * 0.7;
    const pulse = 1 + Math.sin(time * 3) * 0.03;
    ring.scale.setScalar(pulse);
    for (const s of sparkles) {
      // Going around a circle: cos and sin of an angle that grows over time.
      const angle = s.offset + time * 0.8;
      const r = PORTAL.radius + 1.6 + Math.sin(time * 2 + s.wobble) * 0.6;
      s.mesh.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
      s.mesh.rotation.y = time * 4;
    }
  }

  return { group, update };
}

// ---------------------------------------------------------------------------
// Home Lake: dock and start line
// ---------------------------------------------------------------------------
function createDock() {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: COLORS.wood, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: COLORS.woodDark, flatShading: true });

  // The dock reaches from Z = 0 back onto the beach.
  const length = getWaterBounds().maxZ + SHORE.sandWidth;
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

// A white stripe painted across the end of the dock, with a little flag
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

  // Flag: a thin pole with a flag (a thin box) near the top.
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
// Trees, rocks and reeds
// ---------------------------------------------------------------------------

// Picks a random spot whose distance from the water is between minD and maxD.
function randomSpotNearShore(minD, maxD) {
  const halfX = LAKE.width / 2 + SHORE.landSize - 10;
  const bounds = getWaterBounds();
  for (let tries = 0; tries < 2000; tries++) {
    const x = THREE.MathUtils.randFloat(-halfX, halfX);
    const z = THREE.MathUtils.randFloat(bounds.minZ - 60, bounds.maxZ + 60);
    const d = distanceFromShore(x, z);
    const nearDock = !getTheme().islands && Math.abs(x) < DOCK.width / 2 + 4 && z > -2; // keep the dock clear
    if (d >= minD && d <= maxD && !nearDock) return { x, z };
  }
  return { x: 0, z: bounds.maxZ + 60 };
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

function createRocks(theme) {
  const group = new THREE.Group();
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: theme.rock || COLORS.rock, flatShading: true });

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
