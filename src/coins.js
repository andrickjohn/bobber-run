// coins.js
// Gold coins laid out in TRAILS ahead of the player: straight lines, waves, zigzags,
// circles, arches and spirals that climb into the sky. Swoop through a whole trail to
// build up your combo! Some trails end with a Golden Lure, and ⚡ Zap Packs float in
// the gaps between trails.
// Touching one collects it. This file only reports pickups; game.js adds the points.

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

export function createCoins(scene) {
  const coins = [];
  let nextTrailZ = -18; // where the next trail starts (trails are laid out ahead of you)

  // One shared material for all plain coins (there are a lot of them).
  const coinMaterial = makeCoinMaterial(COLORS.coin);

  function addPickup(kind, x, z, airHeight) {
    const model =
      kind === 'golden' ? makeGoldenLureModel() : kind === 'zapPack' ? makeZapPackModel() : makeCoinModel(coinMaterial);
    model.group.position.set(x, 0, z);
    cartoon(model.group, 0.12);
    scene.add(model.group);
    coins.push({ ...model, x, z, kind, golden: kind === 'golden', airHeight, spin: Math.random() * Math.PI * 2 });
  }

  // The trail shapes. Each takes the coin's number in the trail (i, from 0 to n-1) and
  // returns how far sideways it is from the trail's center line (dx) and how high it
  // floats (y; 0 = on the water).
  const SHAPES = {
    line: () => ({ dx: 0, y: 0 }),
    wave: (i) => ({ dx: Math.sin(i * 0.7) * 6, y: 0 }),
    // A zigzag: |((i / 2) mod 2) − 1| goes 1, 0.5, 0, 0.5, 1, ... (a triangle shape)
    zigzag: (i) => ({ dx: (Math.abs(((i / 2) % 2) - 1) * 2 - 1) * 6, y: 0 }),
    // An arch over the water, like a rainbow: highest in the middle
    arch: (i, n) => ({ dx: 0, y: Math.sin((Math.PI * i) / (n - 1)) * COINS.skyHeight }),
    // A spiral (helix) that climbs up into the sky, circling around as it goes
    spiral: (i, n) => ({ dx: Math.cos(i * 0.9) * 4, y: (i / (n - 1)) * COINS.skyHeight }),
    // A whole trail up at flying height
    sky: (i) => ({ dx: Math.sin(i * 0.5) * 3, y: COINS.skyHeight }),
  };
  const shapeNames = Object.keys(SHAPES);

  // Lays out one trail starting at Z = startZ. Returns the Z where it ends.
  function layTrail(startZ, isClear) {
    const n = THREE.MathUtils.randInt(7, 11);
    const edges = getLakeEdges(startZ);
    const centerX = rand(edges.minX + 10, edges.maxX - 10);

    // Sometimes a circle of coins instead of a trail.
    if (Math.random() < 0.12 && isOverLake(startZ - 5, 6)) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        addPickup('coin', centerX + Math.cos(a) * 5, startZ - 5 + Math.sin(a) * 5, 0);
      }
      return startZ - 10;
    }

    const shape = SHAPES[shapeNames[Math.floor(Math.random() * shapeNames.length)]];
    const goldenEnd = Math.random() < COINS.goldenChance;
    let z = startZ;
    for (let i = 0; i < n; i++) {
      z = startZ - i * COINS.spacing;
      const { dx, y } = shape(i, n);
      const e = getLakeEdges(z);
      const x = THREE.MathUtils.clamp(centerX + dx, e.minX + 3, e.maxX - 3);
      // Over a gap between lakes there's no water, so coins float there.
      const height = isOverLake(z, 2) ? y : Math.max(y, 3.5);
      // Skip coins that would sit inside an obstacle on the water.
      if (height < 2 && !isClear(x, z, 2)) continue;
      addPickup(goldenEnd && i === n - 1 ? 'golden' : 'coin', x, z, height);
    }
    return z;
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
        const e = getLakeEdges(pz);
        addPickup('zapPack', rand(e.minX + 8, e.maxX - 8), pz, isOverLake(pz, 2) ? 0 : 4);
      }
      nextTrailZ = endZ - gap;
    }

    const picked = [];
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      // Spin and bob (on the waves, or floating in the sky).
      c.spin += dt * 3;
      c.group.rotation.y = c.spin;
      const bob = Math.sin(time * 3 + c.spin) * 0.15;
      const y = c.airHeight > 0 ? c.airHeight + 0.9 + bob : getWaveHeight(c.x, c.z, time) + COINS.hoverHeight + bob;
      c.group.position.y = y;

      // Picked up? A 3D distance check (Pythagoras with x, y and z), so a coin in the
      // sky can only be grabbed by flying up to it. (Up/down counts a bit less, ×0.7,
      // to make grabbing easier.)
      const dist = Math.hypot(c.x - bobber.position.x, (y - bobber.mesh.position.y) * 0.7, c.z - bobber.position.z);
      if (canCollect && dist < COINS.pickupRadius + bobber.radius) {
        picked.push({ kind: c.kind, golden: c.golden, x: c.x, y, z: c.z });
        remove(i);
      } else if (c.z > bobber.position.z + 30) {
        remove(i); // far behind: you'll never get it now
      }
    }
    return picked;
  }

  function clear() {
    while (coins.length) remove(coins.length - 1);
    nextTrailZ = -18;
  }

  return { update, clear, get list() { return coins; } };
}
