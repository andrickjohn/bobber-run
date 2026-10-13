// coins.js
// Gold coins (plus the rare Golden Lure and the ⚡ Zap Pack) that pop up on the lake
// ahead of the player.
// They spin, bob on the waves, and fade away if nobody grabs them in time.
// Touching one collects it. This file only reports pickups; game.js adds the points.

import * as THREE from 'three';
import { COINS, COLORS } from './config.js';
import { getWaveHeight, getLakeEdges, getWaterBounds, getLevel, isOverLake } from './world.js';

const rand = THREE.MathUtils.randFloat;

// Shapes are shared by every coin; each coin gets its own material so it can fade alone.
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
    transparent: true,
  });
}

function makeCoinModel() {
  const material = makeCoinMaterial(COLORS.coin);
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
  let spawnTimer = 0;

  // Try to put a new coin somewhere ahead of the player, on open water.
  // isClear(x, z, clearance) comes from obstacles.js and says if a spot is free.
  function spawn(playerZ, isClear) {
    for (let tries = 0; tries < 15; tries++) {
      const z = playerZ - rand(COINS.spawnAheadMin, COINS.spawnAheadMax);
      // Stay on the course (before the far shore and the finish portal), away from the shore.
      if (z < getWaterBounds().minZ + 5 || z < getLevel().finishZ - 10) return;
      const edges = getLakeEdges(z);
      const x = rand(edges.minX + 3, edges.maxX - 3);
      if (!isClear(x, z, COINS.obstacleClearance)) continue;

      // What kind of pickup? Mostly coins, sometimes a Golden Lure or a Zap Pack.
      const roll = Math.random();
      const kind = roll < COINS.goldenChance ? 'golden' : roll < COINS.goldenChance + COINS.zapPackChance ? 'zapPack' : 'coin';
      const golden = kind === 'golden';
      // Some coins float high in the sky, where only a flying bobber can reach them.
      // Over a gap between space lakes there's no water, so those coins always float,
      // a little lower: a trail to grab while flying across.
      let airHeight = Math.random() < COINS.airChance ? rand(COINS.airMinHeight, COINS.airMaxHeight) : 0;
      if (!isOverLake(z, 2)) airHeight = rand(3, 5.5);
      const model = kind === 'golden' ? makeGoldenLureModel() : kind === 'zapPack' ? makeZapPackModel() : makeCoinModel();
      model.group.position.set(x, 0, z);
      scene.add(model.group);
      coins.push({ ...model, x, z, kind, golden, airHeight, age: 0, spin: Math.random() * Math.PI * 2 });
      return;
    }
  }

  function remove(index) {
    const c = coins[index];
    scene.remove(c.group);
    c.materials.forEach((m) => m.dispose());
    coins.splice(index, 1);
  }

  // Called every frame. Returns a list of the coins picked up this frame.
  // canCollect = false while the bobber is respawning or the game is over.
  function update(dt, time, bobber, isClear, canSpawn, canCollect) {
    // Spawn new coins at random intervals, up to the maximum.
    spawnTimer -= dt;
    if (canSpawn && spawnTimer <= 0) {
      if (coins.length < COINS.maxOnScreen) spawn(bobber.position.z, isClear);
      spawnTimer = rand(COINS.spawnMin, COINS.spawnMax);
    }

    const picked = [];
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.age += dt;

      // Spin and bob on the waves.
      c.spin += dt * 3;
      c.group.rotation.y = c.spin;
      const bob = Math.sin(time * 3 + c.spin) * 0.15;
      const y = c.airHeight > 0 ? c.airHeight + bob : getWaveHeight(c.x, c.z, time) + COINS.hoverHeight + bob;
      c.group.position.y = y;

      // Fade out near the end of its life, then disappear.
      const timeLeft = COINS.lifetime - c.age;
      const opacity = Math.min(1, timeLeft / COINS.fadeTime);
      c.materials.forEach((m) => (m.opacity = opacity));
      if (timeLeft <= 0) {
        remove(i);
        continue;
      }

      // Picked up? A 3D distance check (Pythagoras with x, y and z), so a coin in the
      // sky can only be grabbed by flying up to it. (Up/down counts a bit less, ×0.7,
      // to make grabbing easier.)
      // Coins far behind the player are removed too, since they'd never be reached.
      const dist = Math.hypot(c.x - bobber.position.x, (y - bobber.mesh.position.y) * 0.7, c.z - bobber.position.z);
      if (canCollect && dist < COINS.pickupRadius + bobber.radius) {
        picked.push({ kind: c.kind, golden: c.golden, x: c.x, y, z: c.z });
        remove(i);
      } else if (c.z > bobber.position.z + 40) {
        remove(i);
      }
    }
    return picked;
  }

  function clear() {
    while (coins.length) remove(coins.length - 1);
    spawnTimer = 0;
  }

  return { update, clear, get list() { return coins; } };
}
