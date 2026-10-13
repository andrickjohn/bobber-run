// checkpoints.js
// The checkpoint gates across the lake, and keeping track of the player's progress.
// Each gate is two orange buoys with a numbered flag and a faint glowing line between them.
// Passing between the buoys (in order!) turns the gate green.
// Gates are shifted left/right and turned at an angle (new random layout every game),
// so you can't just drive in a straight line.
// Crossing a gate's line OUTSIDE the buoys counts as a miss: the gate flashes red
// until you go back and pass through it properly.
// This file also checks whether the player has crossed the finish line.

import * as THREE from 'three';
import { COURSE, PORTAL, BOBBER, COLORS } from './config.js';
import { getWaveHeight, lakeCenterX, getLakeEdges, getLevel, isOverLake } from './world.js';

// Draws a number on a hidden canvas and turns it into a texture for the flags.
// It uses the computer's built-in font, so no font files are needed.
function makeNumberTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#e65100';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Builds one buoy (with a flag on top) and returns it.
function makeBuoy(buoyMaterial, flagTexture) {
  const r = COURSE.buoyRadius;
  const buoy = new THREE.Group();

  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), buoyMaterial);
  body.castShadow = true;
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.98, 0.15, 6, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  band.rotation.x = Math.PI / 2;

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 3, 6),
    new THREE.MeshStandardMaterial({ color: 0xdddddd })
  );
  pole.position.y = r + 1.3;

  // The flag is a thin box; the number texture goes on its front and back.
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.2, 0.05),
    new THREE.MeshStandardMaterial({ map: flagTexture })
  );
  flag.position.set(0.85, r + 2.2, 0);
  flag.castShadow = true;

  buoy.add(body, band, pole, flag);
  return buoy;
}

export function createCheckpoints(scene) {
  const gates = [];
  const count = COURSE.checkpointCount;
  const half = COURSE.gateWidth / 2;

  // Build the gate objects once. placeGates() moves them to random spots.
  for (let i = 0; i < count; i++) {
    // Each gate gets its own materials so we can recolor just this one.
    const buoyMaterial = new THREE.MeshStandardMaterial({ color: COLORS.buoy, roughness: 0.5 });
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.gateLine,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const flagTexture = makeNumberTexture(String(i + 1));

    // The two buoys and the line live in one group, so we can turn the whole gate
    // at once. Inside the group the gate runs along the X axis.
    const group = new THREE.Group();
    const left = makeBuoy(buoyMaterial, flagTexture);
    const right = makeBuoy(buoyMaterial, flagTexture);
    left.position.x = -half;
    right.position.x = half;
    const line = new THREE.Mesh(new THREE.BoxGeometry(COURSE.gateWidth, 0.25, 0.25), lineMaterial);
    line.position.y = 0.4;
    group.add(left, right, line);
    scene.add(group);

    gates.push({
      index: i,
      group, left, right, line, buoyMaterial, lineMaterial,
      center: new THREE.Vector3(),
      across: new THREE.Vector3(),  // direction along the gate line (buoy to buoy)
      forward: new THREE.Vector3(), // direction through the gate, toward the finish
      active: false,
      missed: false,
    });
  }

  // Puts every gate at a random spot and angle, staying inside the lake.
  function placeGates() {
    for (const g of gates) {
      // Where the level says (space lakes put one gate on each island), or evenly spaced
      // (1/5, 2/5, 3/5, 4/5 of the way for 4 gates). Then nudged forward/back, shifted
      // sideways and turned a little.
      const level = getLevel();
      const baseZ = level.checkpointZ ? level.checkpointZ[g.index] : level.finishZ * ((g.index + 1) / (count + 1));
      let placed = false;
      for (let tries = 0; tries < 30 && !placed; tries++) {
        const z = baseZ + THREE.MathUtils.randFloatSpread(COURSE.gateZJitter * 2);
        const x = lakeCenterX(z) + THREE.MathUtils.randFloatSpread(COURSE.gateShiftMax * 2);
        const angle = THREE.MathUtils.randFloatSpread(COURSE.gateAngleMax * 2);
        if (gateFits(x, z, angle)) {
          setGate(g, x, z, angle);
          placed = true;
        }
      }
      // If no random spot fit, fall back to straight across the middle.
      if (!placed) setGate(g, lakeCenterX(baseZ), baseZ, 0);
    }
  }

  // Direction vectors for a gate turned by "angle" (radians) around the vertical axis.
  // across  = (cos a, 0, -sin a)  -> the gate's own X axis after turning
  // forward = (-sin a, 0, -cos a) -> at right angles to that, pointing toward the finish
  function directions(angle) {
    return {
      across: new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle)),
      forward: new THREE.Vector3(-Math.sin(angle), 0, -Math.cos(angle)),
    };
  }

  // Are both buoys comfortably inside the water (and not near the end of a lake)?
  function gateFits(x, z, angle) {
    const { across } = directions(angle);
    const margin = COURSE.buoyRadius + 3;
    for (const side of [-1, 1]) {
      const bx = x + across.x * half * side;
      const bz = z + across.z * half * side;
      if (!isOverLake(bz, 10)) return false;
      const edges = getLakeEdges(bz);
      if (bx < edges.minX + margin || bx > edges.maxX - margin) return false;
    }
    return true;
  }

  function setGate(g, x, z, angle) {
    const dirs = directions(angle);
    g.center.set(x, 0, z);
    g.across.copy(dirs.across);
    g.forward.copy(dirs.forward);
    g.group.position.set(x, 0, z);
    g.group.rotation.y = angle;
  }

  let nextGate = 0; // index of the next gate the player needs to pass

  // Recolor a gate: green when passed, orange when waiting.
  function setGateLook(gate) {
    gate.buoyMaterial.color.set(gate.active ? COLORS.buoyActive : COLORS.buoy);
    gate.lineMaterial.color.set(gate.active ? COLORS.gateLineActive : COLORS.gateLine);
    gate.lineMaterial.opacity = gate.active ? 0.6 : 0.35;
  }

  // Checks how the bobber moved relative to a gate this frame.
  // We measure the bobber's position in the gate's own directions:
  //   along  = how far past the gate line it is (negative = before, positive = after)
  //   side   = how far left/right of the gate's center it is
  // If "along" changed from negative to positive, it crossed the line this frame.
  // Then "side" tells us if it went between the buoys or around them.
  // Returns 'through', 'around' or null (didn't cross).
  const offset = new THREE.Vector3();
  function crossing(g, prev, now) {
    const prevAlong = offset.subVectors(prev, g.center).setY(0).dot(g.forward);
    const nowAlong = offset.subVectors(now, g.center).setY(0).dot(g.forward);
    if (!(prevAlong < 0 && nowAlong >= 0)) return null;
    const side = offset.dot(g.across);
    return Math.abs(side) <= half ? 'through' : 'around';
  }

  // Called every frame. Returns what happened this frame:
  //   { checkpoint: n }        a new gate was activated
  //   { missed: n }            the player went around gate n
  //   { wrongGate: n, need: m } the player went through gate n but still needs gate m
  //   { finished: true }       crossed the finish after all gates
  //   { missedCheckpoints: n } reached the finish but gate n is still missing
  //   null                     nothing happened
  function update(prev, now, time) {
    // Make the gates bob on the waves, and make a missed gate flash red.
    const flashOn = Math.sin(time * 10) > 0;
    for (const g of gates) {
      g.group.position.y = getWaveHeight(g.center.x, g.center.z, time);
      if (g.missed && !g.active) {
        g.buoyMaterial.color.set(flashOn ? COLORS.gateMissed : COLORS.buoy);
        g.lineMaterial.color.set(COLORS.gateMissed);
        g.lineMaterial.opacity = flashOn ? 0.8 : 0.3;
      }
    }

    if (nextGate < gates.length) {
      // The next gate: through = success, around = missed.
      const g = gates[nextGate];
      const result = crossing(g, prev, now);
      if (result === 'through') {
        g.active = true;
        g.missed = false;
        setGateLook(g);
        nextGate++;
        return { checkpoint: nextGate };
      }
      if (result === 'around') {
        g.missed = true;
        return { missed: nextGate + 1 };
      }
      // Driving through a LATER gate while an earlier one is still missing.
      for (let i = nextGate + 1; i < gates.length; i++) {
        if (crossing(gates[i], prev, now) === 'through') {
          g.missed = true;
          return { wrongGate: i + 1, need: nextGate + 1 };
        }
      }
    }

    // The finish portal faces straight down the lake, so a simple Z check works here:
    // did we cross its Z this frame, close enough to its middle to be inside the ring?
    const fz = getLevel().finishZ;
    const crossedFinish = prev.z > fz && now.z <= fz;
    if (crossedFinish && Math.abs(now.x - lakeCenterX(fz)) <= PORTAL.radius) {
      if (nextGate === gates.length) return { finished: true };
      gates[nextGate].missed = true;
      return { missedCheckpoints: nextGate + 1 };
    }
    return null;
  }

  // Where to put the player after a hit: just past the last gate they passed,
  // or at the dock if they haven't passed any yet.
  function getRespawnPoint() {
    if (nextGate === 0) return { x: 0, z: BOBBER.startZ };
    const g = gates[nextGate - 1];
    return { x: g.center.x + g.forward.x * 3, z: g.center.z + g.forward.z * 3 };
  }

  // New game: new random gate layout, all gates back to orange.
  function reset() {
    nextGate = 0;
    for (const g of gates) {
      g.active = false;
      g.missed = false;
      setGateLook(g);
    }
    placeGates();
  }

  reset();

  // The centers of all gates (obstacles use this to stay away from them).
  function getGateCenters() {
    return gates.map((g) => g.center.clone());
  }

  return {
    update,
    reset,
    getRespawnPoint,
    getGateCenters,
    total: count,
    get passed() {
      return nextGate;
    },
  };
}
