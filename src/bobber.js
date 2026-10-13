// bobber.js
// The player: a red-and-white fishing bobber.
// It floats on the waves and glides toward wherever the mouse is pointing on the water.
// The arrow keys (or W/A/S/D) can steer it too.
// Holding Space (or the mouse button) makes it FLY: it climbs to hover height and stays
// there until you let go or run out of energy, then glides back down to the water.

import * as THREE from 'three';
import { BOBBER, FLY, SHOOT, COLORS } from './config.js';
import { getChaseCameraPose } from './scene.js';
import { getWaveHeight, getLakeEdges, WATER_BOUNDS } from './world.js';

export function createBobber(scene, camera, canvas) {
  // ----- The 3D model -----
  const r = BOBBER.radius;
  const mesh = new THREE.Group();

  // Top half (red) and bottom half (white). thetaLength = how much of the sphere
  // to draw from the top down: PI/2 is exactly half.
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: COLORS.bobberTop, roughness: 0.4 })
  );
  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: COLORS.bobberBottom, roughness: 0.4 })
  );
  // The thin stick poking out of the top, with a yellow tip
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  stick.position.y = r + 0.4;
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: COLORS.bobberStick })
  );
  tip.position.y = r + 0.9;
  for (const part of [top, bottom, stick, tip]) {
    part.castShadow = true;
    mesh.add(part);
  }
  scene.add(mesh);

  // A faint ring on the water that shows where the bobber is heading.
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.9, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  // A soft dark spot on the water under the bobber while it flies,
  // so you can tell how high it is and where it will land.
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(r * 1.1, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.visible = false;
  scene.add(blob);

  // ----- Movement state -----
  const position = new THREE.Vector3(0, 0, BOBBER.startZ); // only X and Z matter for steering
  const velocity = new THREE.Vector3();
  // Flying: height above the water, up/down speed, and energy (1 = full, 0 = empty).
  // mustLetGo: after running out of energy, you have to let go of Fly before flying again
  // (otherwise holding the button would make it hop up and down as energy trickles back).
  const flight = { height: 0, vy: 0, energy: 1, flying: false, mustLetGo: false };
  let speedSetting = BOBBER.speedSetting;
  let controlsEnabled = true; // turned off when the game is over or won

  // ----- Mouse -----
  // We store the mouse in "normalized device coordinates": -1 to +1 across the screen.
  const mouse = new THREE.Vector2();
  let hasMouse = false; // don't move until the player has moved the mouse at least once
  // Listen on the whole window (not just the canvas), so moving over the HUD still counts.
  window.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    hasMouse = true;
  });
  // If the mouse leaves the window, stop following it (otherwise the bobber would keep
  // heading for the last spot the mouse was seen, forever). It glides to a stop instead.
  document.addEventListener('mouseleave', () => (hasMouse = false));
  window.addEventListener('blur', () => (hasMouse = false));

  // ----- Fly button -----
  // Fly while Space is held, or while the left mouse button is held down on the game.
  let flyKeyDown = false;
  let flyMouseDown = false;
  let flyButtonDown = false; // the on-screen Fly button (for touchscreens)
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) flyMouseDown = true;
  });
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) flyMouseDown = false;
  });

  // ----- Keyboard -----
  // Arrow keys or W/A/S/D also steer. We remember which keys are held down right now.
  const KEY_DIRECTIONS = {
    ArrowUp: 'forward', KeyW: 'forward',
    ArrowDown: 'back', KeyS: 'back',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };
  const held = { forward: false, back: false, left: false, right: false };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      flyKeyDown = true;
      e.preventDefault(); // stop Space from scrolling the page or "clicking" a button
      return;
    }
    const dir = KEY_DIRECTIONS[e.code];
    if (!dir) return;
    held[dir] = true;
    hasMouse = false; // keyboard takes over until the mouse moves again
    e.preventDefault(); // stop arrow keys from scrolling the page
  });
  function releaseAllKeys() {
    for (const k in held) held[k] = false;
    flyKeyDown = false;
    flyMouseDown = false;
  }
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') flyKeyDown = false;
    const dir = KEY_DIRECTIONS[e.code];
    if (dir) held[dir] = false;
    // On a Mac, keys let go while ⌘ is held never send "keyup", so let go of everything.
    if (e.key === 'Meta') releaseAllKeys();
  });
  // If the window loses focus while a key is held, we'd never see the keyup. Let go of all.
  window.addEventListener('blur', releaseAllKeys);
  document.addEventListener('visibilitychange', releaseAllKeys);

  const raycaster = new THREE.Raycaster();
  const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // flat plane at Y = 0
  const target = new THREE.Vector3();

  // Raycasting: shoot an invisible line from the camera through the mouse pointer
  // and find where it hits the flat water plane. That spot is the target.
  // We do this every frame (not just when the mouse moves) because the camera moves too.
  function findTarget() {
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.ray.intersectPlane(waterPlane, target);
    if (!hit) {
      // The pointer is above the horizon (pointing at the sky). Use a point far
      // ahead in that direction instead, flattened onto the water.
      target.copy(raycaster.ray.direction).multiplyScalar(200).add(raycaster.ray.origin);
      target.y = 0;
    }
    return target;
  }

  // How far the mouse is from the bobber on the screen.
  // We "project" the bobber's 3D position onto the screen, which gives coordinates from
  // -1 to +1 like the mouse. Multiplying X by the aspect ratio makes left/right and
  // up/down distances count the same. 1.0 = half the screen's height.
  //
  // The real camera trails a little behind while it follows, which would make the
  // bobber drift toward the bottom of the screen when backing up (weaker pull).
  // So we use a pretend camera that is always exactly where the chase camera WANTS
  // to be. Then forward and backward feel the same.
  const onScreen = new THREE.Vector3();
  const idealCamera = camera.clone();
  const idealLookAt = new THREE.Vector3();
  function screenDistance() {
    idealCamera.aspect = camera.aspect;
    idealCamera.updateProjectionMatrix();
    getChaseCameraPose(position, idealCamera.position, idealLookAt, flight.height);
    idealCamera.lookAt(idealLookAt);
    idealCamera.updateMatrixWorld();
    onScreen.set(position.x, flight.height, position.z).project(idealCamera);
    const dx = (mouse.x - onScreen.x) * camera.aspect;
    const dy = mouse.y - onScreen.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // The speed slider (1–10) scales top speed and acceleration.
  // Setting 5 = 1.0x, setting 1 = 0.52x, setting 10 = 1.6x.
  function speedFactor() {
    return 0.4 + 0.12 * speedSetting;
  }

  // ----- Flying -----
  // Returns the landing speed on the frame the bobber touches down (for a splash), else 0.
  function updateFlight(dt) {
    const wantsToFly = controlsEnabled && (flyKeyDown || flyMouseDown || flyButtonDown);
    if (!wantsToFly) flight.mustLetGo = false;
    if (flight.energy <= 0) flight.mustLetGo = true;
    // Take off only with enough energy; once flying, keep going until it runs out.
    const canFly = flight.flying ? flight.energy > 0 : flight.energy >= FLY.minEnergyToFly && !flight.mustLetGo;
    if (wantsToFly && canFly) {
      flight.flying = true;
      // Steer the up/down speed toward "the speed that gets us to hover height".
      // Far below → climb at full speed. At hover height → speed 0, so it hovers.
      const wantedVy = THREE.MathUtils.clamp((FLY.hoverHeight - flight.height) * 3, -FLY.climbSpeed, FLY.climbSpeed);
      flight.vy += (wantedVy - flight.vy) * Math.min(1, 6 * dt);
      flight.energy = Math.max(0, flight.energy - FLY.energyDrain * dt);
    } else {
      flight.flying = false;
      flight.vy -= FLY.gravity * dt; // let go (or out of energy): glide back down
    }

    flight.height += flight.vy * dt;
    let landingSpeed = 0;
    if (flight.height <= 0) {
      if (flight.vy < 0 && flight.height < 0) landingSpeed = -flight.vy;
      flight.height = 0;
      flight.vy = 0;
    }
    // Recharge while floating on the water.
    if (flight.height === 0 && !flight.flying) {
      flight.energy = Math.min(1, flight.energy + FLY.energyRecharge * dt);
    }
    return landingSpeed;
  }

  // ----- Called every frame -----
  // dt = seconds since the last frame, time = seconds since the game started.
  // Returns { landed: speed } on the frame it splashes down from a flight, otherwise null.
  function update(dt, time) {
    const landingSpeed = updateFlight(dt);
    const factor = speedFactor();
    const maxSpeed = BOBBER.maxSpeed * factor;

    marker.visible = false;

    // Keyboard steering: add up the held keys into a direction.
    // The camera always looks toward −Z (the finish), so "forward" on screen is −Z.
    const keyX = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const keyZ = (held.back ? 1 : 0) - (held.forward ? 1 : 0);
    if (controlsEnabled && (keyX !== 0 || keyZ !== 0)) {
      const push = new THREE.Vector3(keyX, 0, keyZ).normalize(); // diagonal isn't faster
      velocity.addScaledVector(push, BOBBER.acceleration * factor * dt);
    } else if (hasMouse && controlsEnabled) {
      findTarget();
      marker.visible = true;
      marker.position.set(target.x, getWaveHeight(target.x, target.z, time) + 0.05, target.z);

      // Steering: the arrow from the bobber to the target, flat on the water.
      const toTarget = new THREE.Vector3(target.x - position.x, 0, target.z - position.z);
      const dist = toTarget.length();
      if (dist > BOBBER.deadZone) {
        // Farther cursor = stronger pull, up to the full acceleration.
        // We measure "farther" ON THE SCREEN, not on the water. Because the camera looks
        // ahead, the water behind the bobber is squeezed into the bottom of the screen;
        // measuring on the water would make backing up much weaker than going forward.
        const pull = Math.min(screenDistance() / BOBBER.pullScreenDistance, 1) * BOBBER.acceleration * factor;
        toTarget.normalize(); // make it length 1 so it's only a direction
        velocity.addScaledVector(toTarget, pull * dt);
      }
    }

    // Water drag: lose a fraction of speed every second, so it glides to a stop.
    // Math.exp makes this work the same no matter the frame rate.
    velocity.multiplyScalar(Math.exp(-BOBBER.drag * dt));

    // Never go faster than the top speed.
    if (velocity.length() > maxSpeed) velocity.setLength(maxSpeed);

    // Move: new position = old position + velocity × time.
    position.addScaledVector(velocity, dt);

    keepInsideLake();

    // Float on the waves and bob a little on top of that. The waves matter less the
    // higher it flies ("onWater" goes from 1 on the water down to 0 at 2 units up).
    const wave = getWaveHeight(position.x, position.z, time);
    const bob = Math.sin(time * BOBBER.bobSpeed) * BOBBER.bobHeight;
    const onWater = Math.max(0, 1 - flight.height / 2);
    mesh.position.set(position.x, (wave + bob) * onWater + BOBBER.floatOffset + flight.height, position.z);

    // Lean in the direction it's moving.
    mesh.rotation.x = velocity.z * BOBBER.tiltAmount;
    mesh.rotation.z = -velocity.x * BOBBER.tiltAmount;

    // The shadow spot: bigger and fainter the higher we are.
    blob.visible = mesh.visible && flight.height > 0.3;
    blob.position.set(position.x, wave + 0.05, position.z);
    blob.scale.setScalar(1 + flight.height * 0.08);
    blob.material.opacity = Math.max(0.08, 0.35 - flight.height * 0.03);

    return landingSpeed > FLY.landSplashSpeed ? { landed: landingSpeed } : null;
  }

  // If the bobber goes past the shore, put it back on the edge and
  // reverse its speed in that direction (made smaller, so it's a soft bump).
  function keepInsideLake() {
    const edges = getLakeEdges(position.z);
    const minX = edges.minX + r;
    const maxX = edges.maxX - r;
    if (position.x < minX) {
      position.x = minX;
      if (velocity.x < 0) velocity.x = -velocity.x * BOBBER.bounce;
    } else if (position.x > maxX) {
      position.x = maxX;
      if (velocity.x > 0) velocity.x = -velocity.x * BOBBER.bounce;
    }

    const minZ = WATER_BOUNDS.minZ + r;
    const maxZ = BOBBER.startZ + 2; // can't go back under the dock
    if (position.z < minZ) {
      position.z = minZ;
      if (velocity.z < 0) velocity.z = -velocity.z * BOBBER.bounce;
    } else if (position.z > maxZ) {
      position.z = maxZ;
      if (velocity.z > 0) velocity.z = -velocity.z * BOBBER.bounce;
    }
  }

  // Put the bobber at a spot on the water, stopped, with full energy.
  function reset(x, z) {
    position.set(x, 0, z);
    velocity.set(0, 0, 0);
    flight.height = 0;
    flight.vy = 0;
    flight.energy = 1;
    flight.flying = false;
    flight.mustLetGo = false;
  }

  // Which way to shoot (a direction of length 1, written into "out").
  // With the mouse: toward the spot on the water you're pointing at.
  // Without it (or if that spot is very close): at the water a little ahead of
  // the way you're moving. When flying, this aims downward at the water, so zaps
  // can still hit fish and logs below you.
  function getAim(out) {
    let tx = target.x;
    let tz = target.z;
    const usingMouse = hasMouse && Math.hypot(tx - position.x, tz - position.z) > 4;
    if (!usingMouse) {
      const speed = Math.hypot(velocity.x, velocity.z);
      const fx = speed > 1 ? velocity.x / speed : 0; // moving: aim that way
      const fz = speed > 1 ? velocity.z / speed : -1; // standing still: aim at the finish
      tx = position.x + fx * SHOOT.aimAhead;
      tz = position.z + fz * SHOOT.aimAhead;
    }
    // Aim at about the height of things floating on the water.
    out.set(tx - mesh.position.x, 0.4 - mesh.position.y, tz - mesh.position.z);
    // When floating on the water, shoot straight out (not into the water right ahead).
    if (flight.height < 0.5) out.y = 0;
    return out.normalize();
  }

  // The on-screen Fly button (touchscreens) calls this.
  function setFlyButton(down) {
    flyButtonDown = down;
  }

  function setSpeedSetting(value) {
    speedSetting = value;
  }

  function setControlsEnabled(on) {
    controlsEnabled = on;
  }

  // Used for the blinking after a respawn.
  function setVisible(on) {
    mesh.visible = on;
    if (!on) blob.visible = false;
  }

  return {
    mesh, position, velocity, flight, radius: r,
    update, reset, setSpeedSetting, setControlsEnabled, setVisible, setFlyButton, getAim,
    // Height above the water and whether it's floating (handy for other files).
    get height() { return flight.height; },
    get onWater() { return flight.height < 0.05; },
  };
}
