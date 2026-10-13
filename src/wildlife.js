// wildlife.js
// Frogs sitting on the beach and birds flying overhead.
// Every so often a frog near the player puffs its throat, croaks and hops,
// and a bird flies across the sky chirping. The sound plays at the same moment
// (and from the same side), so what you hear matches what you see.

import * as THREE from 'three';
import { WILDLIFE, COLORS } from './config.js';
import { getLakeEdges, getTerrainHeight, getLevel } from './world.js';
import { playFrog, playBird } from './audio.js';

const rand = THREE.MathUtils.randFloat;
const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
const M = {
  frog: mat(COLORS.frog),
  belly: mat(COLORS.frogBelly),
  eye: mat(0x111111),
  bird: mat(COLORS.bird),
  wing: mat(COLORS.birdWing),
  beak: mat(COLORS.birdBeak),
};

// ---------------------------------------------------------------------------
// Frog model (faces +Z)
// ---------------------------------------------------------------------------
function makeFrogModel() {
  const frog = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), M.frog);
  body.scale.set(1, 0.6, 1.2);
  body.position.y = 0.3;
  // Eyes are bumps on top of the head
  for (const side of [-1, 1]) {
    const bump = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4), M.frog);
    bump.position.set(side * 0.22, 0.55, 0.35);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), M.eye);
    eye.position.set(side * 0.25, 0.6, 0.45);
    // Folded back legs
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), M.frog);
    leg.scale.set(0.8, 0.6, 1.4);
    leg.position.set(side * 0.42, 0.15, -0.3);
    frog.add(bump, eye, leg);
  }
  // Throat pouch: puffs up when the frog croaks
  const throat = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), M.belly);
  throat.position.set(0, 0.2, 0.45);
  throat.scale.setScalar(0.3);
  frog.add(body, throat);
  frog.scale.setScalar(1.5); // big enough to spot from the lake
  frog.traverse((o) => (o.castShadow = true));
  return { frog, throat };
}

// Finds a spot on the beach at this Z on one side (-1 = left, 1 = right).
// Starts at the water's edge and steps outward until it's on dry sand.
function beachSpot(z, side) {
  const e = getLakeEdges(z);
  const edgeX = side < 0 ? e.minX : e.maxX;
  for (let d = 2; d < 12; d += 0.5) {
    const x = edgeX + side * d;
    const y = getTerrainHeight(x, z);
    if (y > 0.15) return { x, y };
  }
  return { x: edgeX + side * 6, y: 0.5 };
}

// ---------------------------------------------------------------------------
// Bird model (faces +Z)
// ---------------------------------------------------------------------------
function makeBirdModel() {
  const bird = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), M.bird);
  body.scale.set(0.8, 0.8, 1.6);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M.bird);
  head.position.set(0, 0.12, 0.55);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 4), M.beak);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.1, 0.8);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.4), M.wing);
  tail.position.set(0, 0.05, -0.65);
  // Each wing hangs from a "shoulder" group so it flaps from the body, not its middle.
  const wings = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.2, 0.1, 0);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.5), M.wing);
    wing.position.x = side * 0.5;
    shoulder.add(wing);
    bird.add(shoulder);
    wings.push({ shoulder, side });
  }
  bird.add(body, head, beak, tail);
  bird.scale.setScalar(1.6);
  return { bird, wings };
}

export function createWildlife(scene) {
  // ----- Frogs: placed along both beaches for the whole lake -----
  const frogs = [];
  for (let z = -10; z > getLevel().finishZ - 20; z -= WILDLIFE.frogSpacing) {
    for (const side of [-1, 1]) {
      const fz = z + rand(-8, 8);
      const spot = beachSpot(fz, side);
      const { frog, throat } = makeFrogModel();
      frog.position.set(spot.x, spot.y, fz);
      // Face roughly toward the water
      frog.rotation.y = side < 0 ? Math.PI / 2 + rand(-0.6, 0.6) : -Math.PI / 2 + rand(-0.6, 0.6);
      scene.add(frog);
      frogs.push({ frog, throat, side, baseY: spot.y, croakTime: -1, hops: 0, hopT: 0, hopDir: 1 });
    }
  }

  // ----- Birds: created when needed, removed after they fly off -----
  const birds = [];

  let frogTimer = rand(2, WILDLIFE.frogWaitMax);
  let birdTimer = rand(2, WILDLIFE.birdWaitMax);

  // Makes a frog near the player croak (and plays the croak sound from its side).
  function croakNearby(playerZ) {
    // Frogs a little ahead of the player are the ones on screen.
    const visible = frogs.filter((f) => f.frog.position.z < playerZ - 6 && f.frog.position.z > playerZ - 45);
    if (visible.length === 0) return;
    const f = visible[Math.floor(Math.random() * visible.length)];
    f.croakTime = 0;
    f.hops = 2;
    f.hopT = 0;
    f.hopDir = Math.random() < 0.5 ? -1 : 1;
    playFrog(f.side * 0.7);
  }

  // Sends a bird across the sky in front of the player, chirping.
  function launchBird(playerX, playerZ) {
    const fromSide = Math.random() < 0.5 ? -1 : 1;
    const z = playerZ - rand(18, 40);
    const startX = playerX + fromSide * 45;
    const { bird, wings } = makeBirdModel();
    bird.position.set(startX, rand(8, 14), z);
    bird.rotation.y = fromSide < 0 ? Math.PI / 2 : -Math.PI / 2; // face the way it's flying
    scene.add(bird);
    birds.push({ bird, wings, dir: -fromSide, startX, distance: 90, travelled: 0, chirpedAgain: false, flap: rand(0, 6) });
    playBird(fromSide * 0.8);
  }

  // Called every frame (not while paused).
  function update(dt, playerPosition) {
    // Timers for the next frog and the next bird
    frogTimer -= dt;
    if (frogTimer <= 0) {
      croakNearby(playerPosition.z);
      frogTimer = rand(WILDLIFE.frogWaitMin, WILDLIFE.frogWaitMax);
    }
    birdTimer -= dt;
    if (birdTimer <= 0) {
      launchBird(playerPosition.x, playerPosition.z);
      birdTimer = rand(WILDLIFE.birdWaitMin, WILDLIFE.birdWaitMax);
    }

    // Animate croaking / hopping frogs
    for (const f of frogs) {
      if (f.croakTime < 0) continue;
      f.croakTime += dt;
      // Throat puffs up twice in the first 0.35 s, matching the "rib-bit" sound.
      const puff = f.croakTime < 0.35 ? Math.abs(Math.sin(f.croakTime * Math.PI / 0.175)) : 0;
      f.throat.scale.setScalar(0.3 + puff * 0.9);
      // Then hop a couple of times along the beach.
      if (f.croakTime > 0.4 && f.hops > 0) {
        // Turn to face along the beach in the hop direction (+Z = 0, −Z = half a turn).
        f.frog.rotation.y = f.hopDir > 0 ? 0 : Math.PI;
        const hopTime = 0.35;
        f.hopT += dt / hopTime;
        // Same arc as the jumping bass: height = 4 × h × t × (1 − t)
        f.frog.position.y = f.baseY + 4 * 0.6 * f.hopT * (1 - f.hopT);
        f.frog.position.z += f.hopDir * (1.4 / hopTime) * dt;
        if (f.hopT >= 1) {
          f.hopT = 0;
          f.hops--;
          f.frog.position.y = f.baseY;
        }
      }
      if (f.hops === 0 && f.croakTime > 0.4) f.croakTime = -1; // done
    }

    // Fly birds across, flapping. A second chirp halfway across.
    for (let i = birds.length - 1; i >= 0; i--) {
      const b = birds[i];
      const step = WILDLIFE.birdSpeed * dt;
      b.travelled += step;
      b.bird.position.x += b.dir * step;
      b.flap += dt * 14;
      b.bird.position.y += Math.sin(b.flap * 0.3) * 0.02; // gentle up-and-down
      for (const w of b.wings) w.shoulder.rotation.z = w.side * Math.sin(b.flap) * 0.7;
      if (!b.chirpedAgain && b.travelled > b.distance / 2) {
        b.chirpedAgain = true;
        playBird(0);
      }
      if (b.travelled > b.distance) {
        scene.remove(b.bird);
        b.bird.traverse((o) => o.geometry && o.geometry.dispose()); // free its memory
        birds.splice(i, 1);
      }
    }
  }

  // Remove all frogs and birds (when switching to another level).
  function dispose() {
    for (const f of frogs) {
      scene.remove(f.frog);
      f.frog.traverse((o) => o.geometry && o.geometry.dispose());
    }
    for (const b of birds) scene.remove(b.bird);
    frogs.length = 0;
    birds.length = 0;
  }

  return { update, dispose };
}
