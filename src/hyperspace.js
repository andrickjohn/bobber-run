// hyperspace.js
// The "jump to hyperspace" effect when you fly through a portal: hundreds of star
// streaks rushing past, getting longer and faster, then slowing down again on arrival.
//
// The streaks live in their own little scene with their own camera, drawn on top of
// the game. That way they look the same no matter where the game camera is.

import * as THREE from 'three';

const STREAKS = 600;

export function createHyperspace() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);

  // Each streak is a short line (2 points). They're placed in a tunnel around the camera:
  // a random angle around, a random distance from the middle, and a random depth ahead.
  const positions = new Float32Array(STREAKS * 2 * 3);
  const streaks = [];
  for (let i = 0; i < STREAKS; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 2 + Math.random() * 14;
    streaks.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: -Math.random() * 300,
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Some streaks white, some blue: a color per point.
  const colors = new Float32Array(STREAKS * 2 * 3);
  const c = new THREE.Color();
  for (let i = 0; i < STREAKS; i++) {
    c.set(Math.random() < 0.6 ? 0xffffff : 0x7df9ff);
    for (let k = 0; k < 2; k++) colors.set([c.r, c.g, c.b], (i * 2 + k) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending, // overlapping streaks glow brighter
    depthTest: false,
  });
  scene.add(new THREE.LineSegments(geometry, material));

  let intensity = 0; // 0 = invisible, 1 = full speed hyperspace

  // Moves every streak toward the camera. Faster = longer streaks.
  function update(dt) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    material.opacity = intensity;
    const speed = 30 + intensity * intensity * 500; // speeds up a LOT as intensity grows
    const length = 0.5 + intensity * 25;
    const p = geometry.attributes.position.array;
    for (let i = 0; i < STREAKS; i++) {
      const s = streaks[i];
      s.z += speed * dt;
      if (s.z > 2) s.z -= 300; // passed the camera: start again far ahead
      p.set([s.x, s.y, s.z, s.x, s.y, s.z - length], i * 6);
    }
    geometry.attributes.position.needsUpdate = true;
  }

  return {
    scene,
    camera,
    update,
    get intensity() {
      return intensity;
    },
    set intensity(value) {
      intensity = Math.max(0, Math.min(1, value));
    },
    get active() {
      return intensity > 0.001;
    },
  };
}
