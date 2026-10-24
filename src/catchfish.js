// catchfish.js
// Little schools of colorful fish swimming in circles along the course.
// They're harmless: bump into one (or zap it) to CATCH it, and it goes into your cooler.
// Their colors matter: three of the same color in a row in the cooler pop for big points.

import * as THREE from 'three';
import { CATCH } from './config.js';
import { getWaveHeight, getLakeEdges, getLevel, isOverLake } from './world.js';
import { cartoon } from './style.js';

const rand = THREE.MathUtils.randFloat;
const bodyGeo = new THREE.SphereGeometry(0.55, 10, 8);
const tailGeo = new THREE.ConeGeometry(0.4, 0.6, 4);
const eyeGeo = new THREE.SphereGeometry(0.1, 6, 4);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
// One material per color, shared by every fish of that color.
const colorMats = CATCH.colors.map(
  (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, flatShading: true })
);

// A small round fish (faces +Z) in one of the catch colors.
function makeFish(colorIndex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, colorMats[colorIndex]);
  body.scale.set(0.8, 0.9, 1.3);
  const tail = new THREE.Mesh(tailGeo, colorMats[colorIndex]);
  tail.rotation.x = -Math.PI / 2;
  tail.scale.set(0.4, 1, 1);
  tail.position.z = -0.85;
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.35, 0.15, 0.45);
    g.add(eye);
  }
  g.add(body, tail);
  g.traverse((o) => (o.castShadow = true));
  g.scale.setScalar(1.8); // big enough to spot (and aim for) from the chase camera
  return cartoon(g);
}

export function createCatchFish(scene) {
  let fish = [];

  // New schools for the current level, spread along the course (only over lakes).
  function reset() {
    for (const f of fish) scene.remove(f.mesh);
    fish = [];
    const finishZ = getLevel().finishZ;
    for (let z = -30; z > finishZ + 20; z -= CATCH.schoolSpacing * rand(0.7, 1.3)) {
      if (!isOverLake(z, 8)) continue;
      const e = getLakeEdges(z);
      const cx = rand(e.minX + 8, e.maxX - 8);
      let color = Math.floor(Math.random() * CATCH.colors.length);
      for (let i = 0; i < CATCH.schoolSize; i++) {
        // Often the same color as the fish before it, so you can catch matching ones.
        if (i > 0 && Math.random() > CATCH.sameColorChance) color = Math.floor(Math.random() * CATCH.colors.length);
        const mesh = makeFish(color);
        scene.add(mesh);
        fish.push({
          mesh, color, cx, cz: z,
          angle: (i / CATCH.schoolSize) * Math.PI * 2,
          radius: rand(2, 3.5),
          speed: rand(0.8, 1.3),
        });
      }
    }
  }

  // Swim in circles around the school's center, wiggling and bobbing on the waves.
  // Returns the fish the bobber bumped into this frame (they're caught!).
  function update(dt, time, bobber, canCatch) {
    const caught = [];
    for (let i = fish.length - 1; i >= 0; i--) {
      const f = fish[i];
      f.angle += dt * f.speed;
      // cos and sin of the angle = a point on a circle around the school's center
      const x = f.cx + Math.cos(f.angle) * f.radius;
      const z = f.cz + Math.sin(f.angle) * f.radius;
      const y = getWaveHeight(x, z, time) + 0.25 + Math.abs(Math.sin(time * 3 + i)) * 0.3;
      f.mesh.position.set(x, y, z);
      // Face along the circle (the direction is at right angles to the radius).
      f.mesh.rotation.y = Math.atan2(-Math.sin(f.angle), Math.cos(f.angle));
      f.mesh.rotation.z = Math.sin(time * 8 + i) * 0.2;
      const near = Math.hypot(x - bobber.position.x, z - bobber.position.z) < CATCH.catchRadius;
      if (canCatch && near && bobber.height < 2) {
        caught.push({ color: f.color, x, y, z });
        scene.remove(f.mesh);
        fish.splice(i, 1);
      }
    }
    return caught;
  }

  // A zap at (x, y, z) catches a fish too. Returns { color, x, y, z } or null.
  function zap(x, y, z, r) {
    for (let i = 0; i < fish.length; i++) {
      const p = fish[i].mesh.position;
      if (Math.hypot(p.x - x, p.y - y, p.z - z) < r + 0.8) {
        const f = fish[i];
        scene.remove(f.mesh);
        fish.splice(i, 1);
        return { type: 'catch', color: f.color, x: p.x, y: p.y, z: p.z };
      }
    }
    return null;
  }

  return { reset, update, zap, get list() { return fish; } };
}
