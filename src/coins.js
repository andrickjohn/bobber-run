// coins.js
// Gold coins laid out in TRAILS ahead of the player. Trails run straight down the course
// in "lanes" (a lane = a spot across the lake, like "a third of the way from the left"),
// so they follow the lake's curves and you can line up and zoom through a whole trail:
// straight lines, smooth lane changes, gentle curves, and hops up into the sky lane.
// Over a gap between lakes, the coins float in the sky lane and show you the way across.
// Some trails line up through a ring gate. Grab EVERY coin in a trail for a bonus!
// Coins close to you fly to you by themselves (a "magnet"), so lined up = you get them.
// Some trails end with a Golden Lure, and ⚡ Zap Packs float in the gaps between trails.
// This file only reports pickups; game.js adds the points.

import * as THREE from 'three';
import { COINS, COLORS } from './config.js';
import { getWaveHeight, getLakeEdges, getLevel, isOverLake } from './world.js';
import { cartoon } from './style.js';

const rand = THREE.MathUtils.randFloat;

// Shapes are shared by every coin.
const coinGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.18, 20);
const lureBodyGeo = new THREE.SphereGeometry(0.6, 12, 8);
const lureHookGeo = new THREE.TorusGeometry(0.3, 0.07, 6, 12, Math.PI * 1.4);

function makeCoinMaterial(color) {
  // A little "emissive" glow keeps gold looking bright even in shadow.
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    metalness: 0.3,
    roughness: 0.3,
  });
}

function makeCoinModel(material) {
  const coin = new THREE.Mesh(coinGeo, material);
  coin.rotation.x = Math.PI / 2; // stand the flat cylinder up on its edge, like a coin
  const group = new THREE.Group();
  group.add(coin);
  return { group, materials: [material] };
}

// The Golden Lure: a bigger shiny spoon with a hook, worth more points.
function makeGoldenLureModel() {
  const bodyMat = makeCoinMaterial(COLORS.goldenLure);
  const hookMat = makeCoinMaterial(0xdddddd);
  const group = new THREE.Group();
  const body = new THREE.Mesh(lureBodyGeo, bodyMat);
  body.scale.set(0.7, 1.3, 0.25);
  const hook = new THREE.Mesh(lureHookGeo, hookMat);
  hook.position.y = -1.0;
  hook.rotation.z = Math.PI * 0.8;
  group.add(body, hook);
  group.scale.setScalar(1.3);
  return { group, materials: [bodyMat, hookMat] };
}

// The Zap Pack: a glowing blue crystal with a ring around it. Gives you more zaps.
const packGeo = new THREE.OctahedronGeometry(0.7);
const packRingGeo = new THREE.TorusGeometry(1.0, 0.08, 6, 24);
function makeZapPackModel() {
  const mat = makeCoinMaterial(COLORS.zapPack);
  const ringMat = makeCoinMaterial(0xffffff);
  const group = new THREE.Group();
  const crystal = new THREE.Mesh(packGeo, mat);
  crystal.scale.set(0.8, 1.3, 0.8);
  const ring = new THREE.Mesh(packRingGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(crystal, ring);
  return { group, materials: [mat, ringMat] };
}

// Smoothstep: goes from 0 to 1 smoothly (slow, fast, slow) as t goes from a to b.
function smooth(a, b, t) {
  const x = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}

// The spot across the lake for a lane at Z = z. lane: -1 = left shore, 0 = middle, 1 = right.
function laneToX(lane, z) {
  const e = getLakeEdges(z);
  return (e.minX + e.maxX) / 2 + lane * (e.maxX - e.minX) / 2;
}
function xToLane(x, z) {
  const e = getLakeEdges(z);
  return (x - (e.minX + e.maxX) / 2) / ((e.maxX - e.minX) / 2);
}

// The trail shapes. Each takes t (0 at the start of the trail, 1 at the end) plus the
// trail's starting lane and a second lane, and returns the lane and height (0 = water,
// 1 = sky lane) at that point.
const SHAPES = {
  // Straight down one lane
  line: (t, a) => ({ lane: a, up: 0 }),
  // A smooth lane change from lane a to lane b
  shift: (t, a, b) => ({ lane: a + (b - a) * smooth(0.2, 0.8, t), up: 0 }),
  // A gentle S-curve around lane a
  curve: (t, a) => ({ lane: a + Math.sin(t * Math.PI * 2) * 0.25, up: 0 }),
  // Straight along the sky lane (fly!)
  sky: (t, a) => ({ lane: a, up: 1 }),
  // A hop: up into the sky lane, along it, and back down. min(1, sin × 1.8) makes the
  // top flat, like a fly-hop.
  hop: (t, a) => ({ lane: a, up: Math.min(1, Math.sin(Math.PI * t) * 1.8) }),
  // Starts on the water, then climbs up into the sky lane
  climb: (t, a) => ({ lane: a, up: smooth(0.35, 0.55, t) }),
};
// How often each shape is picked (bigger = more often)
const SHAPE_WEIGHTS = { line: 3, shift: 3, curve: 2, sky: 1.5, hop: 2, climb: 1 };

function pickShape() {
  const total = Object.values(SHAPE_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [name, weight] of Object.entries(SHAPE_WEIGHTS)) {
    roll -= weight;
    if (roll <= 0) return name;
  }
  return 'line';
}

export function createCoins(scene) {
  const coins = [];
  let nextTrailZ = -18; // where the next trail starts (trails are laid out ahead of you)

  // One shared material for all plain coins (there are a lot of them).
  const coinMaterial = makeCoinMaterial(COLORS.coin);

  let ringSpots = []; // the ring gates on this level (some trails line up through them)

  function addPickup(kind, x, z, airHeight, trail = null) {
    const model =
      kind === 'golden' ? makeGoldenLureModel() : kind === 'zapPack' ? makeZapPackModel() : makeCoinModel(coinMaterial);
    model.group.position.set(x, 0, z);
    cartoon(model.group, 0.12);
    scene.add(model.group);
    if (trail) trail.total++;
    coins.push({
      ...model, x, z, kind, golden: kind === 'golden', airHeight, trail,
      pull: 0, // 0 = in its spot, 1 = pulled all the way to the bobber by the magnet
      spin: Math.random() * Math.PI * 2,
    });
  }

  // Lays out one trail starting at Z = startZ. Returns the Z where it ends.
  function layTrail(startZ, isClear) {
    const n = THREE.MathUtils.randInt(COINS.trailMin, COINS.trailMax);
    const endZ = startZ - (n - 1) * COINS.spacing;
    let shapeName = pickShape();
    let laneA = rand(-0.6, 0.6);
    // The other lane for lane changes: at least a third of the lake away.
    let laneB = laneA > 0 ? rand(-0.6, laneA - 0.35) : rand(laneA + 0.35, 0.6);

    // Is there a ring gate along this stretch? Then often line the trail up through it.
    const ring = ringSpots.find((r) => r.z < startZ - 4 && r.z > endZ + 4);
    if (ring && Math.random() < COINS.ringTrailChance) {
      shapeName = ring.inAir ? 'sky' : 'line';
      laneA = xToLane(ring.x, ring.z);
    }
    const shape = SHAPES[shapeName];
    const goldenEnd = Math.random() < COINS.goldenChance;
    // Every coin in this trail shares this, to find out if you got them ALL.
    const trail = { total: 0, got: 0, missed: false };
    for (let i = 0; i < n; i++) {
      const z = startZ - i * COINS.spacing;
      const { lane, up } = shape(i / (n - 1), laneA, laneB);
      const x = laneToX(THREE.MathUtils.clamp(lane, -0.8, 0.8), z);
      // Over a gap between lakes there's no water, so coins float in the sky lane there.
      const height = isOverLake(z, 2) ? up * COINS.skyHeight : COINS.skyHeight;
      // Skip coins that would sit inside an obstacle on the water.
      if (height < 2 && !isClear(x, z, 2)) continue;
      addPickup(goldenEnd && i === n - 1 ? 'golden' : 'coin', x, z, height, trail);
    }
    return endZ;
  }

  function remove(index) {
    const c = coins[index];
    scene.remove(c.group);
    c.materials.forEach((m) => m !== coinMaterial && m.dispose());
    coins.splice(index, 1);
  }

  // Called every frame. Returns a list of the pickups grabbed this frame.
  // canCollect = false while the bobber is respawning or the game is over.
  function update(dt, time, bobber, isClear, canSpawn, canCollect) {
    // Keep trails laid out ahead of the bobber, up to just before the portal.
    const finishZ = getLevel().finishZ;
    while (canSpawn && nextTrailZ > bobber.position.z - COINS.aheadDistance && nextTrailZ > finishZ + 15) {
      const endZ = layTrail(nextTrailZ, isClear);
      const gap = rand(COINS.gapMin, COINS.gapMax);
      // Sometimes a Zap Pack floats in the gap before the next trail.
      if (Math.random() < COINS.zapPackChance) {
        const pz = endZ - gap / 2;
        addPickup('zapPack', laneToX(rand(-0.6, 0.6), pz), pz, isOverLake(pz, 2) ? 0 : COINS.skyHeight);
      }
      nextTrailZ = endZ - gap;
    }

    const picked = [];
    const b = bobber.mesh.position;
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      // Spin and bob (on the waves, or floating in the sky).
      c.spin += dt * 3;
      c.group.rotation.y = c.spin;
      const bob = Math.sin(time * 3 + c.spin) * 0.15;
      const homeY = c.airHeight > 0 ? c.airHeight + 0.9 + bob : getWaveHeight(c.x, c.z, time) + COINS.hoverHeight + bob;

      // How far from the bobber: a 3D distance (Pythagoras with x, y and z), so a coin in
      // the sky can only be grabbed by flying. (Up/down counts a bit less, ×0.6, to make
      // grabbing easier.)
      const dist = Math.hypot(c.x - b.x, (homeY - b.y) * 0.6, c.z - b.z);
      // The magnet: once you're close, the coin zooms over to you.
      if (canCollect && (c.pull > 0 || dist < COINS.magnetRadius)) c.pull = Math.min(1, c.pull + dt * 8);
      // Draw it part of the way from its spot to the bobber (pull² = slow start, fast finish).
      const k = c.pull * c.pull;
      c.group.position.set(c.x + (b.x - c.x) * k, homeY + (b.y - homeY) * k, c.z + (b.z - c.z) * k);

      if (canCollect && (c.pull >= 1 || dist < COINS.pickupRadius + bobber.radius)) {
        const p = c.group.position;
        let perfect = false;
        if (c.trail) {
          c.trail.got++;
          perfect = c.trail.got === c.trail.total && !c.trail.missed && c.trail.total >= COINS.trailMin - 2;
        }
        picked.push({ kind: c.kind, golden: c.golden, x: p.x, y: p.y, z: p.z, perfect });
        remove(i);
      } else if (c.z > bobber.position.z + 6 && c.pull === 0) {
        if (c.trail) c.trail.missed = true; // went past it: no perfect trail this time
        if (c.z > bobber.position.z + 30) remove(i); // far behind: you'll never get it now
      }
    }
    return picked;
  }

  function clear() {
    while (coins.length) remove(coins.length - 1);
    nextTrailZ = -18;
  }

  // The ring gates on this level, so some trails can line up through them.
  function setRingSpots(spots) {
    ringSpots = spots;
  }

  return { update, clear, setRingSpots, get list() { return coins; } };
}
