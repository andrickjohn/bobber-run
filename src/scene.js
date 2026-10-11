// scene.js
// Sets up the basic 3D stage: the renderer (draws to the canvas),
// the scene (holds every object), the camera, the lights, the sky color and fog.

import * as THREE from 'three';
import { SCENE, CAMERA, COLORS } from './config.js';
import { lakeCenterX } from './world.js';

export function createScene(canvas) {
  // The renderer turns our 3D scene into pixels on the canvas.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // High-DPI screens look sharper with a higher pixel ratio, but we cap it
  // so Chromebooks don't have to draw too many pixels.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, SCENE.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // smooth-edged shadows

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);
  // Fog fades far-away things into the sky color, so the far shore "fades in".
  scene.fog = new THREE.Fog(COLORS.sky, SCENE.fogNear, SCENE.fogFar);

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
  const hemi = new THREE.HemisphereLight(COLORS.hemiSky, COLORS.hemiGround, SCENE.hemiIntensity);
  scene.add(hemi);

  // The sun: one directional light that casts shadows.
  const sun = new THREE.DirectionalLight(COLORS.sun, SCENE.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SCENE.shadowMapSize, SCENE.shadowMapSize);
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

  // Keep everything the right size when the window is resized.
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, sun, followWithSun };
}

// Where the chase camera wants to be for a bobber at position p, and the point it looks at.
// It stays behind and above the bobber and looks ahead toward the finish.
// Sideways it only follows part of the way (CAMERA.sideFollow), staying near the
// middle of the lake. Used by main.js (the real camera) and bobber.js (steering math).
export function getChaseCameraPose(p, outPosition, outLookAt) {
  const middle = lakeCenterX(p.z);
  const x = middle + (p.x - middle) * CAMERA.sideFollow;
  outPosition.set(x, CAMERA.height, p.z + CAMERA.distance);
  outLookAt.set(x, 0, p.z - CAMERA.lookAhead);
}
