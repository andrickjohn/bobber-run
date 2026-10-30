// coins.js
// Gold coins, Golden Lures and ⚡ Zap Packs on the course. Where they go is decided by
// the course plan (setpieces.js): coins come in trails you can line up with and zoom
// through. Grab EVERY coin in a trail for a bonus!
// Coins close to you fly to you by themselves (a "magnet"), so lined up = you get them.
// This file only reports pickups; game.js adds the points.

import * as THREE from 'three';
import { COINS, COLORS } from './config.js';
import { getWaveHeight } from './world.js';
import { cartoon } from './style.js';

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

  // One shared material for all plain coins (there are a lot of them).
  const coinMaterial = makeCoinMaterial(COLORS.coin);

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

  // Puts out the coins from the course plan. trails = lists of { x, z, height, golden };
  // pickups = extra things like Zap Packs: { kind, x, z, height }.
  function lay(trails, pickups) {
    clear();
    for (const coinsInTrail of trails) {
      // Every coin in a trail shares this, to find out if you got them ALL.
      const trail = { total: 0, got: 0, missed: false };
      for (const c of coinsInTrail) addPickup(c.golden ? 'golden' : 'coin', c.x, c.z, c.height, trail);
    }
    for (const p of pickups) addPickup(p.kind, p.x, p.z, p.height);
  }

  function remove(index) {
    const c = coins[index];
    scene.remove(c.group);
    c.materials.forEach((m) => m !== coinMaterial && m.dispose());
    coins.splice(index, 1);
  }

  // Called every frame. Returns a list of the pickups grabbed this frame.
  // canCollect = false on menus, while respawning or once the game is over.
  function update(dt, time, bobber, canCollect) {
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
          perfect = c.trail.got === c.trail.total && !c.trail.missed && c.trail.total >= 6;
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
  }

  return { lay, update, clear, get list() { return coins; } };
}
