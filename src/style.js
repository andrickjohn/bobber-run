// style.js
// The cartoon look: "toon" shading and thick dark outlines.
//
// Toon shading: instead of smooth shading, light falls in a few flat bands (light, mid,
// dark), like in a cartoon. We make that with a tiny 3-pixel "gradient map".
//
// Outlines use the "inverted hull" trick: draw a slightly bigger copy of a shape in solid
// dark color, but only its BACK faces. The normal shape covers the middle, so only a thin
// dark rim peeks out around the edges, which looks like an outline.

import * as THREE from 'three';
import { STYLE } from './config.js';

// The 3 shades of light for toon shading: dark, middle, bright.
const gradient = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
gradient.minFilter = THREE.NearestFilter;
gradient.magFilter = THREE.NearestFilter; // no blending between the bands = hard cartoon edges
gradient.needsUpdate = true;

const outlineMaterial = new THREE.MeshBasicMaterial({ color: STYLE.outlineColor, side: THREE.BackSide });
const toonCache = new WeakMap(); // so meshes that shared a material still share the toon version

// Swaps every regular material inside "object" for a cartoon (toon) one with the same colors.
// (Only if STYLE.toon is on; otherwise things keep their smooth, modern shading.)
export function toonify(object) {
  if (!STYLE.toon) return object;
  object.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    const old = o.material;
    if (!old || !old.isMeshStandardMaterial) return;
    if (!toonCache.has(old)) {
      toonCache.set(
        old,
        new THREE.MeshToonMaterial({
          color: old.color,
          emissive: old.emissive,
          emissiveIntensity: old.emissiveIntensity,
          map: old.map,
          transparent: old.transparent,
          opacity: old.opacity,
          gradientMap: gradient,
        })
      );
    }
    o.material = toonCache.get(old);
  });
  return object;
}

// Makes a cartoon (toon) material directly, for things that change their material later
// (like rings that fade away).
export function toonMaterial(params) {
  if (!STYLE.toon) return new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2, ...params });
  return new THREE.MeshToonMaterial({ ...params, gradientMap: gradient });
}

// Adds a dark outline around every mesh inside "object".
// thickness = how much bigger the outline copy is (0.08 = 8% bigger).
// The outline copy is attached INSIDE each mesh, so it moves, turns and stretches with it.
export function outline(object, thickness = STYLE.outlineThickness) {
  if (!STYLE.outlines) return object;
  const meshes = [];
  object.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline && !o.userData.noOutline) meshes.push(o);
  });
  for (const m of meshes) {
    const hull = new THREE.Mesh(m.geometry, outlineMaterial);
    hull.userData.isOutline = true;
    hull.scale.setScalar(1 + thickness);
    m.add(hull);
  }
  return object;
}

// Both at once: the full cartoon treatment.
export function cartoon(object, thickness) {
  return outline(toonify(object), thickness);
}
