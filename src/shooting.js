// shooting.js
// The bobber's zapper. Press F (or the right mouse button, or the on-screen Shoot button)
// to fire glowing zaps toward where you're aiming. A zap that hits a fish, turtle, lure or
// log knocks it out with a "poof". You carry a few zaps, and they reload over time.

import * as THREE from 'three';
import { SHOOT, COLORS } from './config.js';
import { getWaveHeight } from './world.js';

const coreGeo = new THREE.SphereGeometry(SHOOT.radius, 10, 8);
const glowGeo = new THREE.SphereGeometry(SHOOT.radius * 2, 10, 8);
const coreMat = new THREE.MeshBasicMaterial({ color: COLORS.zap });
// The glow is a bigger see-through ball around the core. "Additive" blending makes
// it brighten whatever is behind it, like light does.
const glowMat = new THREE.MeshBasicMaterial({
  color: COLORS.zapGlow,
  transparent: true,
  opacity: 0.45,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

export function createShooter(scene, canvas) {
  const zaps = []; // zaps flying right now
  let ammo = SHOOT.maxAmmo;
  let reloadTimer = 0;
  let cooldown = 0;

  // ----- Shoot button(s) -----
  let keyDown = false;
  let mouseDown = false;
  let buttonDown = false; // on-screen button (touchscreens)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') keyDown = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyF') keyDown = false;
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button === 2) mouseDown = true;
  });
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' && e.button === 2) mouseDown = false;
  });
  // Stop the right-click menu from popping up over the game.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => (keyDown = mouseDown = false));

  function fire(origin, direction) {
    const zap = new THREE.Group();
    zap.add(new THREE.Mesh(coreGeo, coreMat), new THREE.Mesh(glowGeo, glowMat));
    zap.position.copy(origin);
    scene.add(zap);
    zaps.push({ mesh: zap, velocity: direction.clone().multiplyScalar(SHOOT.speed), age: 0 });
  }

  function remove(i) {
    scene.remove(zaps[i].mesh);
    zaps.splice(i, 1);
  }

  const aim = new THREE.Vector3();
  const origin = new THREE.Vector3();

  // Called every frame.
  //   canShoot – false on menus, while respawning, etc.
  //   obstacles.zap(x, y, z, r) knocks out whatever obstacle is at that spot (if any).
  // Returns { fired, zapped: [...knocked-out obstacles], splashes: [...spots zaps hit water] }.
  function update(dt, time, bobber, obstacles, canShoot) {
    const result = { fired: false, zapped: [], splashes: [] };

    // Reload one zap at a time.
    if (ammo < SHOOT.maxAmmo) {
      reloadTimer += dt;
      if (reloadTimer >= SHOOT.reloadTime) {
        ammo++;
        reloadTimer = 0;
      }
    } else {
      reloadTimer = 0;
    }

    // Fire while the button is held, one zap per cooldown.
    cooldown -= dt;
    if (canShoot && (keyDown || mouseDown || buttonDown) && cooldown <= 0 && ammo > 0) {
      bobber.getAim(aim);
      origin.copy(bobber.mesh.position).addScaledVector(aim, 1.2); // start just in front
      fire(origin, aim);
      ammo--;
      cooldown = SHOOT.cooldown;
      result.fired = true;
    }

    // Move zaps and check what they hit.
    for (let i = zaps.length - 1; i >= 0; i--) {
      const z = zaps[i];
      z.age += dt;
      z.mesh.position.addScaledVector(z.velocity, dt);
      const p = z.mesh.position;
      z.mesh.scale.setScalar(1 + Math.sin(time * 40 + i) * 0.15); // flicker

      const hit = obstacles.zap(p.x, p.y, p.z, SHOOT.radius);
      if (hit) {
        result.zapped.push(hit);
        remove(i);
      } else if (p.y < getWaveHeight(p.x, p.z, time) - 0.2) {
        result.splashes.push({ x: p.x, y: getWaveHeight(p.x, p.z, time), z: p.z });
        remove(i);
      } else if (z.age > SHOOT.life) {
        remove(i);
      }
    }
    return result;
  }

  function clear() {
    while (zaps.length) remove(zaps.length - 1);
    ammo = SHOOT.maxAmmo;
    reloadTimer = 0;
  }

  return {
    update,
    clear,
    setButton(down) {
      buttonDown = down;
    },
    get ammo() {
      return ammo;
    },
  };
}
