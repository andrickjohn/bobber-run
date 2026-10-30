// ghost.js
// The "ghost": a see-through bobber that replays your best run on a world, so you can
// race against yourself.
//
// While you play, we write down where the bobber is every tenth of a second (a
// "recording"). If you finish faster than your best time, that recording is saved in
// the browser (localStorage). Next time, the ghost plays it back: at each moment of
// the race it sits wherever you were at that moment last time.

import * as THREE from 'three';
import { GHOST } from './config.js';

const KEY = 'bobberRun.ghosts';

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch (e) {
    return {};
  }
}

export function createGhost(scene) {
  // A simple see-through bobber shape.
  const mesh = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: GHOST.color, emissive: GHOST.color, emissiveIntensity: 0.6,
    transparent: true, opacity: GHOST.opacity, depthWrite: false,
  });
  mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 12), material));
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), material);
  stick.position.y = 1.2;
  mesh.add(stick);
  mesh.visible = false;
  scene.add(mesh);

  let best = null;     // the saved run we're racing: { time, samples: [x, y, z, x, y, z, ...] }
  let recording = [];  // this run so far (same format)
  let nextSample = 0;  // the race time of the next sample to write down

  // Get ready for a new run on this world. key = which world (and daily or not).
  function start(key) {
    best = loadAll()[key] || null;
    recording = [];
    nextSample = 0;
    mesh.visible = false;
  }

  // Called every frame while racing. raceTime = seconds since leaving the dock.
  function update(raceTime, bobber, showGhost) {
    // Write down where we are, every GHOST.interval seconds.
    while (raceTime >= nextSample) {
      const p = bobber.mesh.position;
      recording.push(+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2));
      nextSample += GHOST.interval;
    }
    // Play back the best run: find the two samples around this moment and blend between
    // them ("interpolate"), so the ghost moves smoothly instead of jumping 10 times a second.
    const count = best ? best.samples.length / 3 : 0;
    if (!showGhost || count < 2 || raceTime <= 0) {
      mesh.visible = false;
      return;
    }
    const f = Math.min(raceTime / GHOST.interval, count - 1.001);
    const i = Math.floor(f);
    const t = f - i;
    const s = best.samples;
    mesh.position.set(
      s[i * 3] + (s[i * 3 + 3] - s[i * 3]) * t,
      s[i * 3 + 1] + (s[i * 3 + 4] - s[i * 3 + 1]) * t,
      s[i * 3 + 2] + (s[i * 3 + 5] - s[i * 3 + 2]) * t
    );
    mesh.visible = true;
  }

  // At the finish: save this run if it beat the best time. Returns true if it did.
  function finish(key, time) {
    mesh.visible = false;
    if (best && best.time <= time) return false;
    const all = loadAll();
    all[key] = { time: +time.toFixed(2), samples: recording };
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) {
      // Storage blocked or full: the ghost just isn't saved.
    }
    return true;
  }

  function hide() {
    mesh.visible = false;
  }

  return { start, update, finish, hide, get bestTime() { return best ? best.time : null; } };
}
