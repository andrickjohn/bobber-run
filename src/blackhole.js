// blackhole.js
// The black hole far below Space Lakes. You can see it swirling through the gaps
// between the islands... and if you fall into a gap, you get pulled in: the bobber
// spirals down faster and faster, along with rocks, satellites, crystals and little
// planets, until everything disappears into the darkness.

import * as THREE from 'three';
import { BLACK_HOLE } from './config.js';

// Draws the glowing disk of gas around the black hole on a hidden canvas:
// bright white-yellow near the middle, through orange and pink, to purple at the edge,
// with darker spiral lanes, so it looks like it's swirling in.
function makeDiskTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const mid = size / 2;
  const glow = ctx.createRadialGradient(mid, mid, size * 0.08, mid, mid, mid);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.2, 'rgba(255,220,140,1)');
  glow.addColorStop(0.45, 'rgba(255,110,60,0.9)');
  glow.addColorStop(0.7, 'rgba(200,60,200,0.6)');
  glow.addColorStop(1, 'rgba(60,20,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  // Dark spiral lanes: lines that wind inward as they go around.
  ctx.strokeStyle = 'rgba(20,0,30,0.45)';
  ctx.lineWidth = 14;
  for (let arm = 0; arm < 5; arm++) {
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.01) {
      const angle = arm * ((Math.PI * 2) / 5) + t * Math.PI * 2.5;
      const r = mid * (1 - t * 0.85);
      const x = mid + Math.cos(angle) * r;
      const y = mid + Math.sin(angle) * r;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Random space junk to swirl into the hole with you.
const junkMaterials = [0x8d7bb8, 0xb0b0c0, 0x7df9ff, 0xff9e6b, 0xffd54f, 0x9fb4ff].map(
  (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, emissive: color, emissiveIntensity: 0.25, fog: false })
);
function makeJunk() {
  const kind = Math.floor(Math.random() * 4);
  const mat = junkMaterials[Math.floor(Math.random() * junkMaterials.length)];
  const g = new THREE.Group();
  if (kind === 0) {
    // A lumpy asteroid
    g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), junkMaterials[0]));
    g.scale.setScalar(THREE.MathUtils.randFloat(1, 3.5));
  } else if (kind === 1) {
    // A satellite: a box body with two flat solar panels
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1.4), junkMaterials[1]));
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.9), junkMaterials[5]);
      panel.position.x = side * 1.7;
      g.add(panel);
    }
    g.scale.setScalar(1.5);
  } else if (kind === 2) {
    // A glowing crystal
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), junkMaterials[2]);
    c.scale.set(0.6, 1.6, 0.6);
    g.add(c);
    g.scale.setScalar(1.6);
  } else {
    // A tiny ringed planet
    g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.12, 4, 24), junkMaterials[4]);
    ring.rotation.x = Math.PI / 2.5;
    g.add(ring);
    g.scale.setScalar(THREE.MathUtils.randFloat(1.5, 3));
  }
  return g;
}

export function createBlackHole() {
  const group = new THREE.Group();
  const center = new THREE.Vector3(BLACK_HOLE.x, BLACK_HOLE.y, BLACK_HOLE.z);
  group.position.copy(center);

  // The hole itself: a perfectly black ball. ("fog: false" so it always shows.)
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(BLACK_HOLE.coreRadius, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })
  );
  group.add(core);

  // The glowing swirling disk around it (two layers spinning at different speeds).
  const texture = makeDiskTexture();
  const disks = [1, 0.6].map((opacity, i) => {
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(BLACK_HOLE.diskRadius * (i === 0 ? 1 : 0.8), 96),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    disk.rotation.x = -Math.PI / 2 + 0.15; // nearly flat, tilted a little
    disk.position.y = i * 0.5;
    group.add(disk);
    return disk;
  });

  // ----- The fall -----
  // Each falling thing (the bobber and every piece of junk) follows a spiral around the
  // hole: an angle that grows faster and faster, a radius that shrinks, and a height
  // that drops. cos(angle) and sin(angle) turn the angle into a spot on a circle.
  let junk = [];

  // Takes a piece of junk out of the scene and frees its memory.
  function removeJunk(j) {
    j.mesh.parent?.remove(j.mesh);
    j.mesh.traverse((o) => o.geometry && o.geometry.dispose());
  }

  function startFall(scene, bobberPosition) {
    // Junk appears all around the hole and starts swirling in.
    for (let i = 0; i < BLACK_HOLE.junkCount; i++) {
      const mesh = makeJunk();
      scene.add(mesh);
      junk.push({
        mesh,
        angle: Math.random() * Math.PI * 2,
        radius: THREE.MathUtils.randFloat(25, BLACK_HOLE.diskRadius * 1.2),
        height: THREE.MathUtils.randFloat(5, 120),
        spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(4),
        speed: THREE.MathUtils.randFloat(0.6, 1.4),
        size: mesh.scale.x,
      });
    }
    // Where the bobber starts its spiral, measured from the hole's center.
    const dx = bobberPosition.x - center.x;
    const dz = bobberPosition.z - center.z;
    return {
      angle: Math.atan2(dz, dx),
      radius: Math.hypot(dx, dz),
      height: bobberPosition.y - center.y,
    };
  }

  // Moves the bobber (start = what startFall returned) and the junk along their spirals.
  // p goes from 0 (just fell) to 1 (swallowed). Returns the bobber's position.
  const bobberSpot = new THREE.Vector3();
  function updateFall(dt, p, start) {
    // Angle speeds up the closer we get: p × p grows slowly at first, then fast.
    const angle = start.angle + BLACK_HOLE.turns * Math.PI * 2 * p * p;
    const radius = start.radius * Math.pow(1 - p, 1.4);
    const height = start.height * (1 - Math.pow(p, 0.8)) + BLACK_HOLE.coreRadius * 0.5;
    bobberSpot.set(center.x + Math.cos(angle) * radius, center.y + height, center.z + Math.sin(angle) * radius);

    for (let i = junk.length - 1; i >= 0; i--) {
      const j = junk[i];
      // Closer junk swirls faster (angle speed grows as radius shrinks).
      j.angle += dt * j.speed * (2 + 120 / (j.radius + 10));
      j.radius = Math.max(0, j.radius - dt * j.speed * (12 + 60 * p));
      j.height = Math.max(0, j.height - dt * j.speed * (20 + 60 * p));
      j.mesh.position.set(center.x + Math.cos(j.angle) * j.radius, center.y + j.height, center.z + Math.sin(j.angle) * j.radius);
      j.mesh.rotation.x += j.spin.x * dt;
      j.mesh.rotation.y += j.spin.y * dt;
      // Shrink away to nothing as it reaches the hole.
      const shrink = Math.min(1, (j.radius + j.height) / 30);
      j.mesh.scale.setScalar(j.size * shrink);
      if (shrink <= 0.02) {
        removeJunk(j);
        junk.splice(i, 1);
      }
    }
    return bobberSpot;
  }

  function endFall() {
    for (const j of junk) removeJunk(j);
    junk = [];
  }

  // Spin the two disk layers all the time, in opposite directions.
  function update(time) {
    disks[0].rotation.z = time * 0.25;
    disks[1].rotation.z = -time * 0.45;
  }

  return { group, center, update, startFall, updateFall, endFall };
}
