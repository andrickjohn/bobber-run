// hyperspace.js
// The "jump to hyperspace" effect when you fly through a portal: hundreds of star
// streaks rushing past, getting longer and faster, then slowing down again on arrival.
// At top speed you're inside a glowing, spinning TUNNEL with a light at the far end.
//
// The streaks live in their own little scene with their own camera, drawn on top of
// the game. That way they look the same no matter where the game camera is.

import * as THREE from 'three';
import { HYPERSPACE } from './config.js';

const STREAKS = 900;

// The tunnel's wallpaper, drawn on a small canvas: glowing colored bands (they become
// rings around the tube) plus thin lines running along it (they show the speed).
function makeTunnelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#070a2a';
  g.fillRect(0, 0, 128, 256);
  const colors = ['#7df9ff', '#ff6bd6', '#8b5cff', '#ffe066'];
  for (let i = 0; i < 8; i++) {
    const y = i * 32 + 16;
    // A soft glowing band: bright in the middle, fading out above and below.
    const band = g.createLinearGradient(0, y - 14, 0, y + 14);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(0.5, colors[i % colors.length]);
    band.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = band;
    g.fillRect(0, y - 14, 128, 28);
  }
  g.fillStyle = 'rgba(255,255,255,0.5)';
  for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 2, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 10); // 4 times around, 10 times along the tube
  return texture;
}

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

  // The tunnel: the INSIDE of a long open tube around the camera (BackSide = we see the
  // inside faces). It's drawn first, so it covers the game picture behind it.
  const tunnelTexture = makeTunnelTexture();
  const tunnelMaterial = new THREE.MeshBasicMaterial({
    map: tunnelTexture,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 320, 40, 1, true), tunnelMaterial);
  tunnel.rotation.x = Math.PI / 2; // a cylinder stands up along Y; tip it to run along Z
  tunnel.position.z = -150;
  tunnel.renderOrder = -2;
  scene.add(tunnel);
  // The light at the end of the tunnel: a glowing disc that grows as you get closer.
  const endLight = new THREE.Mesh(
    new THREE.CircleGeometry(18, 40),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
  );
  endLight.position.z = -305;
  endLight.renderOrder = -1;
  scene.add(endLight);

  let intensity = 0; // 0 = invisible, 1 = full speed hyperspace
  let tunnelAmount = 0; // 0 = no tunnel, 1 = fully inside it
  let endGlow = 0;      // 0..1: how bright the light at the end is (it also hides the open end)
  let spin = 0;         // how far the view has rolled around (radians)
  let time = 0;

  // Moves every streak toward the camera. Faster = longer streaks.
  function update(dt) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    time += dt;
    material.opacity = intensity;
    const speed = 30 + intensity * intensity * 700; // speeds up a LOT as intensity grows

    // Tunnel: slide the wallpaper toward the camera so the rings rush past, slowly shift
    // its colors, and roll the whole view around (like a barrel roll).
    tunnelMaterial.opacity = tunnelAmount;
    tunnelTexture.offset.y -= dt * (0.4 + intensity * 2.5);
    tunnelMaterial.color.setHSL((time * 0.15) % 1, 0.6, 0.75);
    endLight.material.opacity = endGlow;
    spin += dt * HYPERSPACE.spin * tunnelAmount;
    camera.rotation.z = spin;
    // A little rumble at top speed
    const shake = HYPERSPACE.shake * tunnelAmount * 0.15;
    camera.position.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0);
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
    get tunnel() {
      return tunnelAmount;
    },
    set tunnel(value) {
      tunnelAmount = Math.max(0, Math.min(1, value));
    },
    set endGlow(value) {
      endGlow = Math.max(0, Math.min(1, value));
    },
    get active() {
      return intensity > 0.001 || tunnelAmount > 0.001;
    },
  };
}
