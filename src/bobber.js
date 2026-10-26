// bobber.js
// The player: a red-and-white fishing bobber.
// It cruises forward down the course by itself, like in a runner game. You steer only
// LEFT and RIGHT: it slides over to line up with wherever the mouse (or your finger)
// points. The arrow keys (or A/D) steer too; Up/W is a speed boost and Down/S brakes.
// Holding Space (or the mouse button) makes it FLY: it climbs up to the "sky lane" and
// stays there until you let go or run out of energy, then drops back down to the water.
// So there are just two heights, water and sky, which makes coin trails easy to line up.
// Over a gap between space lakes there's no water to land on: it falls into space!

import * as THREE from 'three';
import { BOBBER, FLY, SHOOT, COLORS, RUNNER } from './config.js';
import { cartoon } from './style.js';
import { getWaveHeight, getLakeEdges, getWaterBounds, isOverLake, getLakeAt, getLevel } from './world.js';

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
  cartoon(mesh); // toon shading + outlines
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
  // falling: dropped below the lakes into a gap (no way back up, you lose a life).
  const flight = { height: 0, vy: 0, energy: 1, flying: false, mustLetGo: false, falling: false };
  // Squash and stretch: a springy height (1 = normal, more = tall and thin, less = squashed).
  const squash = { y: 1, speed: 0 };
  let speedSetting = BOBBER.speedSetting;
  // Where across the lake the keyboard is steering to: -1 = left shore, 0 = middle, 1 = right.
  let keyLane = 0;
  let usingKeys = false;
  // "Rush": extra speed from grabbing coins one after another (0 = none).
  let rush = 0;
  let controlsEnabled = true; // turned off when the game is over or won

  // ----- Mouse and finger -----
  // We store the pointer in "normalized device coordinates": -1 to +1 across the screen.
  // On a touchscreen, the finger that touches the game steers the same way the mouse
  // does. Fingers pressing the Fly/Zap buttons are ignored here.
  const mouse = new THREE.Vector2();
  let hasMouse = false; // don't move until the player has pointed somewhere at least once
  let steeringFinger = null; // which finger is steering (each touch has its own id)

  function pointAt(e) {
    usingKeys = false;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    hasMouse = true;
  }
  // Listen on the whole window (not just the canvas), so moving over the HUD still counts.
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerId !== steeringFinger) return;
    pointAt(e);
  });
  // Letting go with the steering finger: stop steering and glide to a stop.
  function fingerUp(e) {
    if (e.pointerId === steeringFinger) {
      steeringFinger = null;
      hasMouse = false;
    }
  }
  window.addEventListener('pointerup', fingerUp);
  window.addEventListener('pointercancel', fingerUp);
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
    if (e.pointerType === 'mouse') {
      if (e.button === 0) flyMouseDown = true;
    } else if (steeringFinger === null) {
      // The first finger to touch the game becomes the steering finger.
      steeringFinger = e.pointerId;
      pointAt(e);
    }
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
    if (dir === 'left' || dir === 'right') {
      // Keyboard takes over steering until the mouse moves again. Start from where we are.
      if (!usingKeys) keyLane = laneOf(position.x, position.z);
      usingKeys = true;
      hasMouse = false;
    }
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

  // Where across the lake a point is: -1 = left shore, 0 = middle, 1 = right shore.
  function laneOf(x, z) {
    const e = getLakeEdges(z);
    const half = (e.maxX - e.minX) / 2;
    return (x - (e.minX + half)) / half;
  }

  // The speed slider (1–10) scales top speed and acceleration.
  // Setting 5 = 1.0x, setting 1 = 0.52x, setting 10 = 1.6x.
  function speedFactor() {
    return 0.4 + 0.12 * speedSetting;
  }

  // ----- Flying -----
  // Returns the landing speed on the frame the bobber touches down (for a splash), else 0.
  function updateFlight(dt) {
    if (flight.falling) {
      // Tumbling down into space: gravity only, faster and faster.
      flight.flying = false;
      flight.vy -= FLY.gravity * 2 * dt;
      flight.height += flight.vy * dt;
      return 0;
    }
    const wantsToFly = controlsEnabled && (flyKeyDown || flyMouseDown || flyButtonDown);
    if (!wantsToFly) flight.mustLetGo = false;
    if (flight.energy <= 0) flight.mustLetGo = true;
    // Take off only with enough energy; once flying, keep going until it runs out.
    const canFly = flight.flying ? flight.energy > 0 : flight.energy >= FLY.minEnergyToFly && !flight.mustLetGo;
    if (wantsToFly && canFly) {
      flight.flying = true;
      // Steer the up/down speed toward "the speed that gets us to hover height".
      // Far below → climb at full speed. At hover height → speed 0, so it hovers.
      const wantedVy = THREE.MathUtils.clamp((FLY.hoverHeight - flight.height) * 5, -FLY.climbSpeed, FLY.climbSpeed);
      flight.vy += (wantedVy - flight.vy) * Math.min(1, 10 * dt);
      flight.energy = Math.max(0, flight.energy - FLY.energyDrain * dt);
    } else {
      flight.flying = false;
      flight.vy -= FLY.gravity * dt; // let go (or out of energy): glide back down
    }

    flight.height += flight.vy * dt;
    let landingSpeed = 0;
    const overLake = isOverLake(position.z);
    if (flight.height <= 0) {
      if (!overLake) {
        // No water down here, just empty space...
        flight.falling = true;
        return 0;
      }
      if (flight.vy < 0 && flight.height < 0) landingSpeed = -flight.vy;
      flight.height = 0;
      flight.vy = 0;
    }
    // Recharge while floating on the water.
    if (flight.height === 0 && !flight.flying && overLake) {
      flight.energy = Math.min(1, flight.energy + FLY.energyRecharge * dt);
    }
    return landingSpeed;
  }

  // ----- Called every frame -----
  // dt = seconds since the last frame, time = seconds since the game started.
  // Returns { landed: speed } on the frame it splashes down from a flight,
  // { fell: true } once it has fallen far down into space, otherwise null.
  function update(dt, time) {
    const landingSpeed = updateFlight(dt);
    const factor = speedFactor();

    marker.visible = false;

    // ----- Forward: cruise down the course by itself -----
    // The camera looks toward −Z (the finish), so forward is −Z.
    let wantedSpeed = 0;
    if (controlsEnabled) {
      wantedSpeed = RUNNER.cruiseSpeed * factor * (1 + rush);
      if (held.forward) wantedSpeed *= RUNNER.boost;
      if (held.back) wantedSpeed *= RUNNER.brake;
    }
    // "1 − e^(−grip × dt)" = the fraction of the gap to close this frame (smooth at any fps).
    velocity.z += (-wantedSpeed - velocity.z) * (1 - Math.exp(-RUNNER.forwardGrip * dt));
    rush = Math.max(0, rush - RUNNER.rushDecay * dt);

    // ----- Sideways: slide over to line up with the spot you're pointing at -----
    // Icy levels have less drag, which also makes sideways sliding slippery.
    const slippery = (getLevel().drag ?? BOBBER.drag) / BOBBER.drag;
    let targetX = null;
    const edges = getLakeEdges(position.z - 6);
    const middle = (edges.minX + edges.maxX) / 2;
    const half = (edges.maxX - edges.minX) / 2;
    if (controlsEnabled && usingKeys) {
      const keyX = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      keyLane = THREE.MathUtils.clamp(keyLane + keyX * RUNNER.keySteer * dt, -0.9, 0.9);
      targetX = middle + keyLane * half;
    } else if (controlsEnabled && hasMouse) {
      // Raycast: the spot on the water under the pointer. We only use its X (left/right).
      targetX = THREE.MathUtils.clamp(findTarget().x, edges.minX + r, edges.maxX - r);
    }
    let wantedSide = 0;
    if (targetX !== null) {
      // Farther away = slide faster (up to sideSpeed); right there = stop.
      wantedSide = THREE.MathUtils.clamp((targetX - position.x) * RUNNER.sideGain, -RUNNER.sideSpeed, RUNNER.sideSpeed);
      // A little ring on the water ahead shows the line you're steering to.
      marker.visible = true;
      marker.position.set(targetX, getWaveHeight(targetX, position.z - 6, time) + 0.05, position.z - 6);
    }
    velocity.x += (wantedSide - velocity.x) * (1 - Math.exp(-RUNNER.sideGrip * slippery * dt));

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

    // Squash and stretch, like a cartoon: stretch tall while shooting up, splat flat on
    // landing, then wobble back. It's a spring: it pulls toward the target height,
    // overshoots a little and settles.
    if (landingSpeed > 2) squash.y = Math.max(0.5, 1 - landingSpeed * 0.05);
    // (Named "stretchGoal", not "target": "target" is already the spot the mouse points at.)
    const stretchGoal = 1 + THREE.MathUtils.clamp(flight.vy * 0.03, -0.15, 0.3);
    squash.speed += (stretchGoal - squash.y) * 220 * dt; // pull toward the goal
    squash.speed *= Math.exp(-9 * dt); // and slow down, so it settles
    squash.y += squash.speed * dt;
    // Keep the same "amount" of bobber: taller means thinner (1 ÷ √height sideways).
    const thin = 1 / Math.sqrt(Math.max(0.3, squash.y));
    mesh.scale.set(thin, squash.y, thin);

    // The shadow spot: bigger and fainter the higher we are. (None over empty space.)
    blob.visible = mesh.visible && flight.height > 0.3 && isOverLake(position.z);
    blob.position.set(position.x, wave + 0.05, position.z);
    blob.scale.setScalar(1 + flight.height * 0.08);
    blob.material.opacity = Math.max(0.08, 0.35 - flight.height * 0.03);

    if (flight.falling && flight.height < -12) return { fell: true };
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

    let minZ = getWaterBounds().minZ + r;
    let maxZ = BOBBER.startZ + 2; // can't go back under the dock
    // Floating on the water, the ends of the lake are shore too: to cross a gap to the
    // next lake you have to FLY.
    const lake = getLakeAt(position.z);
    if (lake && flight.height === 0 && !flight.falling) {
      minZ = Math.max(minZ, lake.end + r);
      maxZ = Math.min(maxZ, lake.start - r);
    }
    // (No bounce at the ends: it would bounce over and over, since it always cruises forward.)
    if (position.z < minZ) {
      position.z = minZ;
      if (velocity.z < 0) velocity.z = 0;
    } else if (position.z > maxZ) {
      position.z = maxZ;
      if (velocity.z > 0) velocity.z = 0;
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
    flight.falling = false;
    mesh.scale.setScalar(1); // (a black hole may have shrunk it)
    squash.y = 1;
    squash.speed = 0;
    rush = 0;
    keyLane = laneOf(x, z);
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

  // Grabbing a coin gives a little burst of extra speed. Keep grabbing and it builds up.
  function addRush(amount = RUNNER.rushPerCoin) {
    rush = Math.min(RUNNER.rushMax, rush + amount);
  }

  // A quick "boing!" (when grabbing coins and rings): a little springy bounce.
  function boing(amount = 1) {
    squash.speed += 6 * amount;
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
    update, reset, setSpeedSetting, setControlsEnabled, setVisible, setFlyButton, getAim, boing, addRush,
    get rush() { return rush; },
    // Height above the water and whether it's floating (handy for other files).
    get height() { return flight.height; },
    get onWater() { return !flight.falling && flight.height < 0.05; },
  };
}
