// course.js
// The course for each level: the optional ring gates along the way, and the finish portal.
//
// Ring gates are glowing hoops facing down the course. Some sit on the water, some float
// up in the sky (you have to fly through those). Going through one gives points, a combo
// boost and a free zap. Missing one is fine: there's always another ring ahead.
// Flying into the portal at the end finishes the level.

import * as THREE from 'three';
import { RINGS, PORTAL, FLY, BOBBER, COLORS } from './config.js';
import { getWaveHeight, lakeCenterX, getLakeEdges, getLevel, getLakeAt } from './world.js';

const ringGeo = new THREE.TorusGeometry(RINGS.radius, 0.32, 10, 36);
const sparkleGeo = new THREE.OctahedronGeometry(0.22);

export function createCourse(scene) {
  let rings = [];

  // Builds a fresh set of rings for the current level, in new random spots.
  function reset() {
    for (const r of rings) {
      scene.remove(r.group);
      r.group.traverse((o) => o.material && o.material.dispose()); // free their memory
    }
    rings = [];
    const level = getLevel();
    // Lake by lake, a ring every RINGS.spacing or so (never near a lake's ends, never over
    // a gap, and not right at the start or the portal).
    const spots = [];
    for (const lake of level.lakes) {
      const from = Math.min(lake.start - 15, -40);
      const to = Math.max(lake.end + 12, level.finishZ + 30);
      for (let z = from; z > to; z -= RINGS.spacing * THREE.MathUtils.randFloat(0.8, 1.2)) spots.push(z);
    }
    for (const z of spots) {
      const edges = getLakeEdges(z);
      const x = THREE.MathUtils.randFloat(edges.minX + 8, edges.maxX - 8);
      const inAir = Math.random() < RINGS.airChance;
      // A water ring's bottom just touches the water, so a floating bobber goes through
      // its lower half. A sky ring is centered at flying height.
      const height = inAir ? FLY.hoverHeight + 0.5 : RINGS.radius - 0.4;
      const color = inAir ? COLORS.ringSky : COLORS.ringWater;
      const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.3 });
      const group = new THREE.Group();
      group.add(new THREE.Mesh(ringGeo, material));
      // Little sparkles circling the ring so it catches your eye
      const sparkles = [];
      for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(sparkleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
        group.add(s);
        sparkles.push(s);
      }
      group.position.set(x, height, z);
      scene.add(group);
      rings.push({ group, material, sparkles, x, z, height, inAir, passed: false, fade: 0 });
    }
  }

  // Did the bobber go through a ring this frame? We check if it crossed the ring's Z
  // since last frame, and if it was inside the hole: the distance from the ring's center
  // (sideways and up/down, using Pythagoras) is less than the hole's radius.
  // canPass = false on menus (the rings still animate, but nothing counts).
  function update(dt, time, prev, now, bobberY, canPass = true) {
    const passedNow = [];
    for (const r of rings) {
      // Water rings ride the waves; every ring gently pulses and its sparkles circle around.
      const baseY = r.inAir ? r.height : r.height + getWaveHeight(r.x, r.z, time);
      r.group.position.y = baseY + Math.sin(time * 2 + r.z) * 0.15;
      r.sparkles.forEach((s, i) => {
        const a = time * 1.5 + (i / r.sparkles.length) * Math.PI * 2;
        s.position.set(Math.cos(a) * (RINGS.radius + 0.6), Math.sin(a) * (RINGS.radius + 0.6), 0);
      });
      if (r.passed) {
        // Passed rings grow, fade and disappear.
        r.fade += dt * 2.5;
        r.group.scale.setScalar(1 + r.fade);
        r.material.opacity = Math.max(0, 1 - r.fade);
        if (r.fade >= 1) r.group.visible = false;
        continue;
      }
      const crossed = prev.z > r.z && now.z <= r.z;
      if (!crossed || !canPass) continue;
      const fromCenter = Math.hypot(now.x - r.x, bobberY - r.group.position.y);
      if (fromCenter < RINGS.radius - 0.2) {
        r.passed = true;
        r.material.transparent = true;
        r.material.emissiveIntensity = 1.5;
        passedNow.push({ x: r.x, y: r.group.position.y, z: r.z, inAir: r.inAir });
      }
    }
    return passedNow;
  }

  // Did the bobber fly into the finish portal this frame?
  // The portal faces straight down the lake, so: did we cross its Z, close enough to
  // its middle to be inside the ring?
  function reachedPortal(prev, now) {
    const fz = getLevel().finishZ;
    const crossed = prev.z > fz && now.z <= fz;
    return crossed && Math.abs(now.x - lakeCenterX(fz)) <= PORTAL.radius;
  }

  // Where to put the bobber back after losing a life: a little behind where it happened,
  // in the middle of the lake. Over a gap, it goes back to the end of the lake before it.
  function respawnPoint(z) {
    let rz = Math.min(z + 8, BOBBER.startZ);
    if (!getLakeAt(rz)) {
      const lakeBehind = getLevel().lakes.filter((lake) => lake.end >= rz).pop();
      rz = lakeBehind ? lakeBehind.end + 10 : BOBBER.startZ;
    }
    return { x: lakeCenterX(rz), z: rz };
  }

  // Ring spots (so obstacles can stay away from them) and how many there are.
  function getRingSpots() {
    return rings.map((r) => ({ x: r.x, z: r.z }));
  }

  // For the progress bar: how far along each ring is (0 = start, 1 = portal), and
  // whether you've been through it.
  function progressTicks() {
    const finishZ = getLevel().finishZ;
    return rings.map((r) => ({ fraction: r.z / finishZ, passed: r.passed }));
  }

  return {
    reset,
    update,
    reachedPortal,
    respawnPoint,
    getRingSpots,
    progressTicks,
    get total() {
      return rings.length;
    },
    get passedCount() {
      return rings.filter((r) => r.passed).length;
    },
  };
}
