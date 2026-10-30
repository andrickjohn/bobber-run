// surprises.js
// Every world has one crazy surprise that shows up out of nowhere, once per visit,
// somewhere in the middle of the course. They're harmless: just for fun.
//   duck    (Home Lake)    – a giant rubber duck floats across the lake
//   ufo     (Space Lakes)  – a UFO swoops down, shines its beam, and zooms off
//   dragon  (Lava Lagoon)  – a dragon flies across the sky breathing fire
//   penguin (Aurora Fjord) – a penguin belly-slides across your path
//   pirate  (Sunset Reef)  – a pirate ship sails past firing its cannons
//   disco   (Neon Canal)   – a giant disco ball drops from the sky with spinning lights
//
// Each surprise is built from simple shapes. While it plays, it's placed relative to
// the bobber (a little way ahead), so it stays in view even though you keep moving.

import * as THREE from 'three';
import { SURPRISES } from './config.js';
import { lakeCenterX, getWaveHeight } from './world.js';

const glossy = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, ...extra });
const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
const mesh = (geometry, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
};
const ease = (t) => t * t * (3 - 2 * t); // smoothstep: slow start, slow end
const clamp01 = (t) => Math.min(1, Math.max(0, t));

// ---------------------------------------------------------------------------
// The surprises. Each make...() returns { group, update(t, dt, here) }, where t is
// seconds since it started and here = { x, z } is the middle of the lake just ahead of
// the bobber. update() places everything for that moment.
// ---------------------------------------------------------------------------
function makeDuck() {
  const group = new THREE.Group();
  const yellow = glossy(0xffd21f, { roughness: 0.25 });
  const body = mesh(new THREE.SphereGeometry(1, 24, 16), yellow);
  body.scale.set(1.3, 0.9, 1.7);
  const head = mesh(new THREE.SphereGeometry(0.7, 24, 16), yellow, 0, 1.15, 0.9);
  const beak = mesh(new THREE.SphereGeometry(0.4, 16, 10), glossy(0xff7a1a), 0, 1.05, 1.55);
  beak.scale.set(1.1, 0.45, 1);
  const eyeMat = glossy(0x111111, { roughness: 0.1 });
  const tail = mesh(new THREE.ConeGeometry(0.35, 0.8, 12), yellow, 0, 0.55, -1.7);
  tail.rotation.x = -0.9;
  group.add(body, head, beak, tail, mesh(new THREE.SphereGeometry(0.11, 8, 6), eyeMat, 0.32, 1.35, 1.45), mesh(new THREE.SphereGeometry(0.11, 8, 6), eyeMat, -0.32, 1.35, 1.45));
  group.scale.setScalar(5);
  return {
    group,
    update(t, dt, here, time) {
      // Floats across the lake from right to left, rocking on the waves.
      const p = clamp01(t / SURPRISES.duration);
      const x = here.x + 32 - 64 * p;
      const z = here.z - 55 + 15 * p;
      group.position.set(x, getWaveHeight(x, z, time) + 1.5, z);
      group.rotation.set(Math.sin(t * 2.2) * 0.12, -Math.PI / 2 + Math.sin(t * 1.3) * 0.2, Math.sin(t * 1.7) * 0.1);
    },
  };
}

function makeUfo() {
  const group = new THREE.Group();
  const saucer = mesh(new THREE.SphereGeometry(4, 32, 16), glossy(0xb8c0cc, { metalness: 0.8, roughness: 0.25 }));
  saucer.scale.y = 0.22;
  const dome = mesh(new THREE.SphereGeometry(1.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x8ff6ff, transmission: 0.6, roughness: 0.05, transparent: true, opacity: 0.7 }), 0, 0.6, 0);
  group.add(saucer, dome);
  const lights = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const light = mesh(new THREE.SphereGeometry(0.28, 8, 6), glow(i % 2 ? 0xff4fd8 : 0x7dff8a), Math.cos(a) * 3.6, -0.1, Math.sin(a) * 3.6);
    lights.push(light);
    group.add(light);
  }
  // The tractor beam: an open, glowing cone pointing down.
  const beam = mesh(new THREE.CylinderGeometry(1.2, 6, 14, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x9dff9d, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), 0, -7, 0);
  group.add(beam);
  // Something getting beamed up (a little cow, of course).
  const cow = new THREE.Group();
  const cowBody = mesh(new THREE.BoxGeometry(1.4, 0.8, 0.8), glossy(0xffffff));
  const spot = mesh(new THREE.BoxGeometry(0.5, 0.82, 0.5), glossy(0x222222), 0.2, 0, 0.16);
  const cowHead = mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), glossy(0xffffff), 0.85, 0.25, 0);
  cow.add(cowBody, spot, cowHead);
  group.add(cow);
  return {
    group,
    update(t, dt, here) {
      const D = SURPRISES.duration;
      let x, y;
      if (t < 1.2) {
        // Swoop down from the sky
        const p = ease(t / 1.2);
        x = here.x + 60 * (1 - p);
        y = 60 - 46 * p;
      } else if (t < D - 1.2) {
        // Hover and wobble, beam on
        x = here.x + Math.sin(t * 1.5) * 4;
        y = 14 + Math.sin(t * 3) * 0.6;
      } else {
        // Zoom away, up and to the left
        const p = (t - (D - 1.2)) / 1.2;
        x = here.x - 90 * p * p;
        y = 14 + 80 * p * p;
      }
      group.position.set(x, y, here.z - 50);
      group.rotation.y = t * 2;
      beam.visible = t > 1.2 && t < D - 1.2;
      cow.visible = beam.visible;
      // The cow floats up the beam, tumbling
      const lift = clamp01((t - 1.2) / (D - 2.6));
      cow.position.set(0, -13 + 12 * lift, 0);
      cow.rotation.set(t * 1.3, t * 0.7, t);
      lights.forEach((l, i) => (l.visible = Math.floor(t * 8 + i) % 2 === 0)); // blinking
    },
  };
}

function makeDragon() {
  const group = new THREE.Group();
  const scales = glossy(0xb3261e, { roughness: 0.5 });
  const belly = glossy(0xf2b84b);
  const body = mesh(new THREE.SphereGeometry(1, 20, 12), scales);
  body.scale.set(1.1, 1, 3);
  const neck = mesh(new THREE.CylinderGeometry(0.45, 0.7, 2.6, 12), scales, 0, 0.9, 2.8);
  neck.rotation.x = 0.9;
  const head = mesh(new THREE.SphereGeometry(0.75, 16, 12), scales, 0, 1.9, 4.0);
  head.scale.set(1, 0.8, 1.5);
  const tail = mesh(new THREE.ConeGeometry(0.7, 5, 12), scales, 0, -0.2, -5);
  tail.rotation.x = -Math.PI / 2;
  const tummy = mesh(new THREE.SphereGeometry(0.9, 16, 10), belly, 0, -0.35, 0.3);
  tummy.scale.set(1, 0.7, 2.6);
  group.add(body, neck, head, tail, tummy);
  // Wings: big flat triangles that flap
  const wingShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(6, 1.5), new THREE.Vector2(5, -1), new THREE.Vector2(2.5, -2.2)]);
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  const wingMat = glossy(0x7a1712, { side: THREE.DoubleSide });
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.8, 0.6, 0.6);
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.rotation.x = -Math.PI / 2;
    wing.scale.x = side;
    pivot.add(wing);
    wings.push({ pivot, side });
    group.add(pivot);
  }
  group.scale.setScalar(2.2);
  // Fire: little glowing balls shooting out of the mouth, growing and fading.
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const fireGeo = new THREE.SphereGeometry(1, 10, 8);
  const flames = [];
  let fireTimer = 0;
  return {
    group,
    update(t, dt, here) {
      const p = clamp01(t / SURPRISES.duration);
      // Fly across the sky from left to right, swooping up and down
      const x = here.x - 110 + 220 * p;
      const y = 15 + Math.sin(t * 1.4) * 3;
      group.position.set(x, y, here.z - 55);
      group.rotation.set(0, Math.PI / 2, Math.sin(t * 1.4) * 0.15);
      for (const w of wings) w.pivot.rotation.z = w.side * Math.sin(t * 7) * 0.7;
      // Breathe fire in the middle of the flight
      fireTimer -= dt;
      if (t > 1.5 && t < SURPRISES.duration - 1.5 && fireTimer <= 0) {
        fireTimer = 0.04;
        const flame = new THREE.Mesh(fireGeo, fireMat.clone());
        const mouth = new THREE.Vector3(0, 1.9, 5).applyMatrix4(group.matrixWorld);
        flame.position.copy(mouth);
        flame.userData.velocity = new THREE.Vector3(30 + Math.random() * 8, -6 - Math.random() * 6, (Math.random() - 0.5) * 6);
        flame.userData.age = 0;
        flame.userData.extra = true;
        group.parent.add(flame);
        flames.push(flame);
      }
      for (let i = flames.length - 1; i >= 0; i--) {
        const f = flames[i];
        f.userData.age += dt;
        f.position.addScaledVector(f.userData.velocity, dt);
        f.scale.setScalar(0.6 + f.userData.age * 4);
        f.material.opacity = Math.max(0, 1 - f.userData.age / 0.7);
        f.material.color.setHSL(0.08 - f.userData.age * 0.1, 1, 0.55);
        if (f.userData.age > 0.7) {
          f.parent.remove(f);
          f.material.dispose();
          flames.splice(i, 1);
        }
      }
    },
  };
}

function makePenguin() {
  const group = new THREE.Group();
  const black = glossy(0x1b1d24);
  const white = glossy(0xf4f4f0);
  const orange = glossy(0xff9a1a);
  const body = mesh(new THREE.SphereGeometry(1, 24, 16), black);
  body.scale.set(0.9, 1.3, 0.85);
  const tummy = mesh(new THREE.SphereGeometry(0.85, 24, 16), white, 0, -0.1, 0.25);
  tummy.scale.set(0.8, 1.1, 0.75);
  const head = mesh(new THREE.SphereGeometry(0.62, 20, 14), black, 0, 1.45, 0);
  const face = mesh(new THREE.SphereGeometry(0.5, 20, 14), white, 0, 1.4, 0.2);
  const beak = mesh(new THREE.ConeGeometry(0.16, 0.5, 10), orange, 0, 1.35, 0.75);
  beak.rotation.x = Math.PI / 2;
  const eyeMat = glossy(0x111111, { roughness: 0.1 });
  group.add(body, tummy, head, face, beak, mesh(new THREE.SphereGeometry(0.08, 8, 6), eyeMat, 0.2, 1.55, 0.6), mesh(new THREE.SphereGeometry(0.08, 8, 6), eyeMat, -0.2, 1.55, 0.6));
  for (const side of [-1, 1]) {
    const flipper = mesh(new THREE.SphereGeometry(0.5, 12, 8), black, side * 0.95, 0.2, 0);
    flipper.scale.set(0.2, 1, 0.5);
    flipper.rotation.z = side * 0.4;
    const foot = mesh(new THREE.SphereGeometry(0.3, 12, 8), orange, side * 0.35, -1.25, 0.3);
    foot.scale.set(1, 0.3, 1.5);
    group.add(flipper, foot);
  }
  const inner = new THREE.Group(); // tips the penguin onto its belly to slide
  inner.add(...group.children.splice(0));
  group.add(inner);
  group.scale.setScalar(3);
  return {
    group,
    update(t, dt, here, time) {
      const D = SURPRISES.duration;
      const p = clamp01(t / (D - 1.2));
      // Belly-slide across the lake, spinning a little...
      const x = here.x + 30 - 60 * ease(p);
      const z = here.z - 34;
      group.position.set(x, getWaveHeight(x, z, time) + 1.4, z);
      if (t < D - 1.2) {
        inner.rotation.set(Math.PI / 2 - 0.2, 0, 0);
        group.rotation.y = -Math.PI / 2 + Math.sin(t * 3) * 0.3;
      } else {
        // ...then pop up, stand, and do a happy jump
        const q = (t - (D - 1.2)) / 1.2;
        inner.rotation.set(Math.PI / 2 * (1 - ease(clamp01(q * 3))), 0, 0);
        group.rotation.y = 0;
        group.position.y += Math.max(0, Math.sin(q * Math.PI) * 4);
      }
    },
  };
}

function makePirateShip(effects) {
  const group = new THREE.Group();
  const wood = glossy(0x6b4423, { roughness: 0.8 });
  const darkWood = glossy(0x3e2614, { roughness: 0.8 });
  const sailMat = glossy(0xf2e8d0, { side: THREE.DoubleSide, roughness: 0.9 });
  // The hull: a box squeezed narrower at the bottom
  const hullGeo = new THREE.BoxGeometry(14, 3, 4.5, 6, 2, 2);
  const hp = hullGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const squeeze = hp.getY(i) < 0 ? 0.6 : 1;
    hp.setZ(i, hp.getZ(i) * squeeze);
    if (Math.abs(hp.getX(i)) > 6) hp.setY(i, hp.getY(i) + 0.8); // raised front and back
  }
  hullGeo.computeVertexNormals();
  const hull = mesh(hullGeo, wood, 0, 1, 0);
  const deck = mesh(new THREE.BoxGeometry(13, 0.3, 4.2), darkWood, 0, 2.5, 0);
  group.add(hull, deck);
  for (const [mx, h] of [[-3, 11], [3, 13]]) {
    group.add(mesh(new THREE.CylinderGeometry(0.2, 0.25, h, 8), darkWood, mx, 2.5 + h / 2, 0));
    // Sails: slightly bulging planes
    const sailGeo = new THREE.PlaneGeometry(5, h * 0.55, 6, 6);
    const sp = sailGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setZ(i, Math.cos(sp.getX(i) / 2.5 * Math.PI / 2) * 0.8);
    sailGeo.computeVertexNormals();
    const sail = mesh(sailGeo, sailMat, mx, 3 + h * 0.5, 0.3);
    sail.rotation.y = Math.PI / 2 - 0.7; // angled to catch the wind (and so we can see them)
    group.add(sail);
  }
  const flag = mesh(new THREE.PlaneGeometry(2, 1.2), glossy(0x111111, { side: THREE.DoubleSide }), 4, 16, 0);
  const skull = mesh(new THREE.CircleGeometry(0.3, 12), glow(0xffffff), 4, 16, 0.02);
  group.add(flag, skull);
  group.scale.setScalar(1.4);
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
  const puffs = [];
  const balls = [];
  const ballGeo = new THREE.SphereGeometry(0.5, 10, 8);
  let shots = 0;
  return {
    group,
    update(t, dt, here, time) {
      const p = clamp01(t / SURPRISES.duration);
      const x = here.x - 40 + 80 * p;
      const z = here.z - 60;
      group.position.set(x, getWaveHeight(x, z, time) - 0.3, z);
      group.rotation.set(Math.sin(t * 1.5) * 0.06, 0, Math.sin(t * 1.1) * 0.05);
      flag.position.y = 16 + Math.sin(t * 6) * 0.1;
      // BOOM! Fire a cannon now and then: a puff of smoke and a cannonball that splashes down.
      if ((shots === 0 && t > 1.8) || (shots === 1 && t > 3.2) || (shots === 2 && t > 4.2)) {
        shots++;
        const muzzle = new THREE.Vector3(x + (shots - 2) * 3, 2, z + 2.6);
        const puff = mesh(new THREE.SphereGeometry(1, 12, 8), puffMat.clone());
        puff.position.copy(muzzle);
        puff.userData.age = 0;
        puff.userData.extra = true;
        group.parent.add(puff);
        puffs.push(puff);
        const ball = mesh(ballGeo, glossy(0x222222));
        ball.position.copy(muzzle);
        ball.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 8, 10, 28);
        ball.userData.extra = true;
        group.parent.add(ball);
        balls.push(ball);
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const f = puffs[i];
        f.userData.age += dt;
        f.scale.setScalar(1 + f.userData.age * 5);
        f.material.opacity = Math.max(0, 0.9 - f.userData.age);
        if (f.userData.age > 0.9) {
          f.parent.remove(f);
          f.material.dispose();
          puffs.splice(i, 1);
        }
      }
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        b.userData.velocity.y -= 20 * dt;
        b.position.addScaledVector(b.userData.velocity, dt);
        if (b.position.y < 0) {
          effects.splash(b.position.x, 0, b.position.z, 1.6);
          b.parent.remove(b);
          balls.splice(i, 1);
        }
      }
    },
  };
}

function makeDisco() {
  const group = new THREE.Group();
  // A mirror ball: lots of flat faces (flatShading) on a shiny, metallic ball, so each
  // face catches the light separately and sparkles.
  // Each little mirror tile (triangle) gets its own color: mostly silver, some catching
  // pink, cyan or gold light, so the ball looks like it's sparkling.
  const ballGeo = new THREE.IcosahedronGeometry(5, 3).toNonIndexed();
  const tileColors = [];
  const tints = [0xffffff, 0xd8d8e8, 0xb0b0c8, 0xff7ad9, 0x7df9ff, 0xffe14a];
  const c = new THREE.Color();
  for (let i = 0; i < ballGeo.attributes.position.count; i += 3) {
    c.setHex(tints[Math.random() < 0.7 ? Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 3)]);
    for (let k = 0; k < 3; k++) tileColors.push(c.r, c.g, c.b);
  }
  ballGeo.setAttribute('color', new THREE.Float32BufferAttribute(tileColors, 3));
  const ballMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.15, flatShading: true, emissive: 0x6a5a8a, emissiveIntensity: 0.6 });
  const ball = mesh(ballGeo, ballMat);
  const rope = mesh(new THREE.CylinderGeometry(0.1, 0.1, 60, 6), glossy(0x888888), 0, 35, 0);
  group.add(ball, rope);
  // Colored spotlight beams sweeping around below the ball
  const beams = [];
  const colors = [0xff3fd0, 0x00f0ff, 0xffe14a, 0x7dff8a, 0x9d5cff, 0xff6b4a];
  colors.forEach((c, i) => {
    const pivot = new THREE.Group();
    const beam = mesh(new THREE.CylinderGeometry(0.3, 4, 40, 16, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), 0, -20, 0);
    pivot.add(beam);
    pivot.rotation.z = 0.6;
    pivot.rotation.y = (i / colors.length) * Math.PI * 2;
    beams.push(pivot);
    group.add(pivot);
  });
  return {
    group,
    update(t, dt, here) {
      const D = SURPRISES.duration;
      // Drop down from the sky, party, then go back up
      const down = ease(clamp01(t / 1.2)) * (1 - ease(clamp01((t - (D - 1.2)) / 1.2)));
      group.position.set(here.x, 90 - 76 * down, here.z - 55);
      ball.rotation.y = t * 1.5;
      ballMat.emissiveIntensity = 0.5 + 0.4 * Math.abs(Math.sin(t * 8)); // pulsing to the beat
      beams.forEach((b, i) => {
        b.rotation.y = t * 1.8 + (i / beams.length) * Math.PI * 2;
        b.rotation.z = 0.5 + Math.sin(t * 2 + i) * 0.3;
      });
    },
  };
}

const MAKERS = { duck: makeDuck, ufo: makeUfo, dragon: makeDragon, penguin: makePenguin, pirate: makePirateShip, disco: makeDisco };

export function createSurprises(scene, effects) {
  let kind = null;      // this world's surprise
  let triggerZ = 0;     // it shows up when the bobber passes this point
  let active = null;    // the surprise that's playing right now
  let t = 0;
  let time = 0;

  // A new visit to a world: pick when its surprise will show up.
  function start(surpriseKind, finishZ) {
    clear();
    kind = surpriseKind;
    triggerZ = finishZ * (SURPRISES.earliest + Math.random() * (SURPRISES.latest - SURPRISES.earliest));
  }

  // Returns the surprise's name on the frame it starts (so main.js can make a fuss),
  // otherwise null.
  function update(dt, bobber, playing) {
    time += dt;
    let started = null;
    if (!active && kind && playing && bobber.position.z < triggerZ) {
      active = MAKERS[kind](effects);
      scene.add(active.group);
      t = 0;
      started = kind;
      kind = null; // only once per visit
    }
    if (active) {
      t += dt;
      const z = bobber.position.z;
      const here = { x: lakeCenterX(z - 40), z };
      active.update(t, dt, here, time);
      if (t > SURPRISES.duration) clear();
    }
    return started;
  }

  function clear() {
    if (!active) return;
    scene.remove(active.group);
    // Flames, smoke puffs and cannonballs still flying around go too.
    for (const o of scene.children.filter((c) => c.userData.extra)) scene.remove(o);
    active = null;
  }

  return { start, update, clear };
}
