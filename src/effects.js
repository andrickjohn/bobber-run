// effects.js
// Short-lived visual effects:
//   splash   – a ring on the water plus droplets (getting hit, fish jumping in and out)
//   sparkle  – little stars bursting outward (coins, ring gates)
//   confetti – colorful pieces flying up and fluttering down (the finish line)
//   wake     – foamy puffs left behind the bobber when it moves fast, spreading in a "V"

import * as THREE from 'three';
import { COLORS, EFFECTS } from './config.js';
import { getWaveHeight } from './world.js';

const ringGeo = new THREE.RingGeometry(0.6, 0.9, 24);
const dropGeo = new THREE.SphereGeometry(0.15, 6, 4);
const starGeo = new THREE.OctahedronGeometry(0.18); // a pointy little diamond = a sparkle
const confettiGeo = new THREE.PlaneGeometry(0.35, 0.2);
const wakeGeo = new THREE.CircleGeometry(0.26, 10);

const WAKE_POOL_SIZE = 64;

export function createEffects(scene) {
  const active = []; // every effect that is still playing

  // Every burst of particles shares one material (so they all fade together).
  function addParticle(kind, mesh, velocity, life) {
    scene.add(mesh);
    active.push({ kind, mesh, velocity, age: 0, life });
  }

  // size: 1 = a normal splash, smaller for little fish splashes.
  function splash(x, y, z, size = 1) {
    // The ring lies flat on the water, grows and fades out.
    const ringMat = new THREE.MeshBasicMaterial({ color: COLORS.splash, transparent: true, opacity: 0.9, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.05, z);
    ring.scale.setScalar(size);
    ring.userData.size = size;
    addParticle('ring', ring, null, 0.8);

    // Droplets shoot up and outward, then gravity pulls them down.
    const dropMat = new THREE.MeshBasicMaterial({ color: COLORS.splash, transparent: true, opacity: 0.95 });
    const count = Math.round(16 * size);
    for (let i = 0; i < count; i++) {
      const drop = new THREE.Mesh(dropGeo, dropMat);
      drop.position.set(x, y + 0.3, z);
      drop.scale.setScalar(0.5 + size * 0.5);
      const angle = Math.random() * Math.PI * 2;
      const outward = (2 + Math.random() * 4) * size;
      const velocity = new THREE.Vector3(Math.cos(angle) * outward, (5 + Math.random() * 5) * Math.sqrt(size), Math.sin(angle) * outward);
      addParticle('drop', drop, velocity, 1.2);
    }
  }

  // Little stars burst outward and fade. "big" = more stars, flying further.
  function sparkle(x, y, z, big = false) {
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.sparkle, transparent: true, opacity: 1 });
    const count = big ? 30 : 14;
    for (let i = 0; i < count; i++) {
      const star = new THREE.Mesh(starGeo, mat);
      star.position.set(x, y, z);
      // A random direction in 3D: pick random x/y/z, then make it length 1.
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize();
      const velocity = dir.multiplyScalar(3 + Math.random() * (big ? 6 : 3));
      addParticle('star', star, velocity, 0.7);
    }
  }

  // Colorful paper pieces shoot up, then flutter down slowly while spinning.
  function confetti(x, y, z) {
    COLORS.confetti.forEach((color, c) => {
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true });
      for (let i = 0; i < 14; i++) {
        const piece = new THREE.Mesh(confettiGeo, mat);
        piece.position.set(x, y, z);
        piece.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        const velocity = new THREE.Vector3((Math.random() - 0.5) * 14, 8 + Math.random() * 10, (Math.random() - 0.5) * 14);
        addParticle('confetti', piece, velocity, 3);
      }
    });
  }

  // ----- Wake -----
  // The wake uses a fixed "pool" of foam puffs that get reused over and over,
  // instead of making new ones all the time (that's faster on slow computers).
  const wakePool = [];
  for (let i = 0; i < WAKE_POOL_SIZE; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.wake, transparent: true, opacity: 0, depthWrite: false });
    const puff = new THREE.Mesh(wakeGeo, mat);
    puff.rotation.x = -Math.PI / 2;
    puff.visible = false;
    scene.add(puff);
    wakePool.push({ mesh: puff, age: 0, drift: new THREE.Vector3() });
  }
  let nextPuff = 0;
  let wakeTimer = 0;

  // Called every frame with the bobber. Drops two foam puffs behind it (left and right),
  // which drift apart sideways. Over time that draws a "V" shape like a real boat wake.
  function updateWake(dt, bobber, on) {
    wakeTimer -= dt;
    const speed = bobber.velocity.length();
    if (!on || speed < EFFECTS.wakeMinSpeed || wakeTimer > 0) return;
    wakeTimer = EFFECTS.wakeInterval;

    // Direction of travel (length 1), and the direction at right angles to it ("side").
    const dirX = bobber.velocity.x / speed;
    const dirZ = bobber.velocity.z / speed;
    const sideX = -dirZ;
    const sideZ = dirX;
    for (const side of [-1, 1]) {
      const p = wakePool[nextPuff];
      nextPuff = (nextPuff + 1) % WAKE_POOL_SIZE;
      p.age = 0;
      p.mesh.visible = true;
      p.mesh.position.set(
        bobber.position.x - dirX * 0.8 + sideX * side * 0.5,
        0,
        bobber.position.z - dirZ * 0.8 + sideZ * side * 0.5
      );
      p.drift.set(sideX * side * EFFECTS.wakeSpread, 0, sideZ * side * EFFECTS.wakeSpread);
    }
  }

  // ----- Update everything -----
  function update(dt, time, bobber, wakeActive) {
    updateWake(dt, bobber, wakeActive);
    for (const p of wakePool) {
      if (!p.mesh.visible) continue;
      p.age += dt;
      const t = p.age / EFFECTS.wakeLife;
      if (t >= 1) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.addScaledVector(p.drift, dt);
      p.mesh.position.y = getWaveHeight(p.mesh.position.x, p.mesh.position.z, time) + 0.06;
      p.mesh.scale.setScalar(1 + t * 1.5); // foam spreads out...
      p.mesh.material.opacity = 0.5 * (1 - t); // ...and fades
    }

    for (let i = active.length - 1; i >= 0; i--) {
      const e = active[i];
      e.age += dt;
      const t = e.age / e.life; // 0 at the start, 1 at the end
      if (e.kind === 'ring') {
        e.mesh.scale.setScalar(e.mesh.userData.size * (1 + t * 5));
        e.mesh.material.opacity = 0.9 * (1 - t);
      } else if (e.kind === 'star') {
        e.velocity.multiplyScalar(Math.exp(-3 * dt)); // slow down quickly
        e.mesh.position.addScaledVector(e.velocity, dt);
        e.mesh.rotation.y += dt * 8;
        e.mesh.scale.setScalar(1 - t * 0.7);
        e.mesh.material.opacity = 1 - t;
      } else if (e.kind === 'confetti') {
        // Air slows the paper a lot, and it falls gently (like paper does).
        e.velocity.multiplyScalar(Math.exp(-1.5 * dt));
        e.velocity.y -= 6 * dt;
        e.mesh.position.addScaledVector(e.velocity, dt);
        e.mesh.rotation.x += dt * 5;
        e.mesh.rotation.z += dt * 3;
        e.mesh.material.opacity = Math.min(1, (1 - t) * 3);
      } else {
        e.velocity.y -= 25 * dt; // gravity
        e.mesh.position.addScaledVector(e.velocity, dt);
        e.mesh.material.opacity = 0.95 * (1 - t);
      }
      if (t >= 1 || (e.kind === 'drop' && e.mesh.position.y < -0.5)) {
        scene.remove(e.mesh);
        active.splice(i, 1);
        // If no other particle uses this material any more, free its memory.
        if (!active.some((o) => o.mesh.material === e.mesh.material)) e.mesh.material.dispose();
      }
    }
  }

  return { splash, sparkle, confetti, update };
}
