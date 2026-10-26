// scene.js
// Sets up the basic 3D stage: the renderer (draws to the canvas),
// the scene (holds every object), the camera, the lights, the sky and fog.
// The sky is a giant ball around everything, painted with a smooth gradient (deep color
// overhead, hazy and pale at the horizon) and a soft glow around the sun.
// The same sky is also used as a reflection map, so water and shiny things reflect it.
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
  // "Tone mapping" squeezes very bright and very dark colors into a nicer, film-like
  // range (the way a camera does), so bright sunlight doesn't look flat or blown out.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SCENE.exposure;

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

  // ----- The sky dome -----
  // A huge ball seen from the inside (BackSide). A tiny "shader" program colors each
  // point on it by how high above the horizon it is, and adds a glow near the sun.
  const skyUniforms = {
    top: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    bottom: { value: new THREE.Color() },
    sunDirection: { value: new THREE.Vector3(SCENE.sunOffset.x, SCENE.sunOffset.y, SCENE.sunOffset.z).normalize() },
    sunGlow: { value: new THREE.Color() },
  };
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position); // which way this point is from the middle
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 bottom;
      uniform vec3 sunDirection;
      uniform vec3 sunGlow;
      varying vec3 vDirection;
      void main() {
        float up = max(vDirection.y, 0.0);       // 0 at the horizon, 1 straight up
        float down = max(-vDirection.y, 0.0);    // 0 at the horizon, 1 straight down
        vec3 color = mix(horizon, top, pow(up, 0.55)); // the pale haze fades quickly upward
        color = mix(color, bottom, pow(down, 0.5));
        float toSun = max(dot(vDirection, sunDirection), 0.0); // 1 when looking at the sun
        color += sunGlow * (pow(toSun, 8.0) * 0.35 + pow(toSun, 200.0) * 1.5);
        gl_FragColor = vec4(color, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyMaterial);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // The reflection map: take a "photo" of just the sky in every direction
  // (PMREM = a blurry version, for less shiny surfaces) and let materials reflect it.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene();
  const skyCopy = new THREE.Mesh(sky.geometry, skyMaterial);
  skyScene.add(skyCopy);
  let environment = null;

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
    sky.position.set(position.x, 0, position.z); // the sky always surrounds the player
  }
  followWithSun(new THREE.Vector3(0, 0, 0));

  // Keep everything the right size when the window is resized (or a phone is turned).
  // A tall, narrow screen gets a wider field of view so you can still see the lake.
  function fitToWindow() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = camera.aspect < 1 ? SCENE.portraitFov : SCENE.cameraFov;
    camera.userData.baseFov = camera.fov; // remembered, so hyperspace can stretch it and put it back
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', fitToWindow);
  fitToWindow();

  // Sets the sky, fog and light colors for a level's theme (from THEMES in config.js).
  function applyTheme(theme) {
    scene.background.set(theme.skyHorizon ?? theme.fog);
    skyUniforms.top.value.set(theme.skyTop ?? theme.sky);
    skyUniforms.horizon.value.set(theme.skyHorizon ?? theme.fog);
    skyUniforms.bottom.value.set(theme.skyBottom ?? theme.skyHorizon ?? theme.fog);
    skyUniforms.sunGlow.value.set(theme.sunGlow ?? 0x000000);
    if (environment) environment.dispose();
    environment = pmrem.fromScene(skyScene).texture;
    scene.environment = environment;
    scene.environmentIntensity = theme.reflections ?? SCENE.reflections;
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
