// scene.js
// Sets up the basic 3D stage: the renderer (draws to the canvas),
// the scene (holds every object), the camera, the lights, the sky color and fog.
// applyTheme() changes the sky, fog and lights when a new level loads.

import * as THREE from 'three';
import { SCENE, CAMERA, MOBILE } from './config.js';
import { isTouchDevice } from './device.js';
import { lakeCenterX } from './world.js';

export function createScene(canvas) {
  // The renderer turns our 3D scene into pixels on the canvas.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // High-DPI screens look sharper with a higher pixel ratio, but we cap it
  // so Chromebooks don't have to draw too many pixels.
  // (Phones get a lower cap, since they're slower.)
  const maxRatio = isTouchDevice ? MOBILE.maxPixelRatio : SCENE.maxPixelRatio;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // smooth-edged shadows

  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  // Fog fades far-away things into the sky color, so the far shore "fades in".
  scene.fog = new THREE.Fog(0xffffff, 60, 300);

  const camera = new THREE.PerspectiveCamera(
    SCENE.cameraFov,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  // Starting spot; the chase camera in main.js takes over from here.
  camera.position.set(0, 15, 30);
  camera.lookAt(0, 0, -20);

  // Soft light from the whole sky (blue-ish from above, green-ish from below).
  const hemi = new THREE.HemisphereLight();
  scene.add(hemi);

  // The sun: one directional light that casts shadows.
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  const shadowSize = isTouchDevice ? MOBILE.shadowMapSize : SCENE.shadowMapSize;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  // The shadow "box" covers the area around the sun's target.
  const s = 70;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  scene.add(sun);
  scene.add(sun.target);

  // The shadow box only covers the area near the sun's target, so we move the sun
  // along with the player. That way nearby things always have shadows.
  function followWithSun(position) {
    const o = SCENE.sunOffset;
    sun.target.position.copy(position);
    sun.position.set(position.x + o.x, position.y + o.y, position.z + o.z);
  }
  followWithSun(new THREE.Vector3(0, 0, 0));

  // Keep everything the right size when the window is resized (or a phone is turned).
  // A tall, narrow screen gets a wider field of view so you can still see the lake.
  function fitToWindow() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = camera.aspect < 1 ? SCENE.portraitFov : SCENE.cameraFov;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', fitToWindow);
  fitToWindow();

  // Sets the sky, fog and light colors for a level's theme (from THEMES in config.js).
  function applyTheme(theme) {
    scene.background.set(theme.sky);
    scene.fog.color.set(theme.fog);
    scene.fog.near = theme.fogNear;
    scene.fog.far = theme.fogFar;
    hemi.color.set(theme.hemiSky);
    hemi.groundColor.set(theme.hemiGround);
    hemi.intensity = theme.hemiIntensity;
    sun.color.set(theme.sun);
    sun.intensity = theme.sunIntensity;
  }

  return { renderer, scene, camera, sun, followWithSun, applyTheme };
}

// Where the chase camera wants to be for a bobber at position p, and the point it looks at.
// It stays behind and above the bobber and looks ahead toward the finish.
// Sideways it only follows part of the way (CAMERA.sideFollow), staying near the
// middle of the lake. Used by main.js (the real camera) and bobber.js (steering math).
// altitude = how high the bobber is flying; the camera rises with it.
export function getChaseCameraPose(p, outPosition, outLookAt, altitude = 0) {
  const middle = lakeCenterX(p.z);
  const x = middle + (p.x - middle) * CAMERA.sideFollow;
  outPosition.set(x, CAMERA.height + altitude * 0.7, p.z + CAMERA.distance);
  outLookAt.set(x, altitude * 0.6, p.z - CAMERA.lookAhead);
}
