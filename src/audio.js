// audio.js
// Simple sound effects made with the Web Audio API (no sound files).
// Each sound is built from "oscillators": tiny tone generators that make a beep
// at a chosen pitch. We change the volume over time so the beep fades out nicely.
//
// The background lake sounds are a mix of small, quiet sounds that play at random
// times: little waves lapping, water "bloops", birds chirping and the odd frog.
// (The birds and frogs are triggered by wildlife.js when one appears on screen.)
// Random timing keeps it from sounding like a loop.
//
// Browsers only allow sound after the player clicks or presses a key,
// so the audio system starts on the first click/keypress.

import { AUDIO } from './config.js';

let ctx = null;
let master = null;     // the main volume knob: every sound goes through it (mute sets it to 0)
let muted = false;
let ambientOut = null; // volume knob for all the lake sounds
let ambientTheme = 'lake'; // 'lake' = water and frogs, 'space' = a soft cosmic hum
let spaceHum = null;     // the hum's volume knob (made the first time it's needed)
let noise = null;      // a couple of seconds of random hiss, reused for splashy sounds

function unlock() {
  if (!ctx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    ctx = new AudioContextClass();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(master);
    noise = makeNoise(3);
    startLakeSounds();
  }
  if (ctx.state === 'suspended') ctx.resume();
}
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
// iPhones and iPads only allow sound to start from a finished tap, so listen for that too.
window.addEventListener('touchend', unlock);
window.addEventListener('click', unlock);

// Mute / unmute everything (the lake sounds keep running silently underneath).
export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : 1;
}

// Random number between min and max.
function rand(min, max) {
  return min + Math.random() * (max - min);
}

// White noise: every sample is a random number. Sounds like "shhhh".
function makeNoise(seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// Runs playSound() again and again, waiting a random time (minWait–maxWait seconds)
// in between. Skips playing while the browser tab is hidden.
function repeatRandomly(playSound, minWait, maxWait) {
  function next() {
    if (ctx.state === 'running' && !document.hidden && ambientTheme === 'lake') playSound();
    setTimeout(next, rand(minWait, maxWait) * 1000);
  }
  setTimeout(next, rand(minWait, maxWait) * 1000);
}

// A small wave lapping against the dock or shore: a short, soft "shhh" that swells and fades.
function playLap() {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = rand(500, 900);
  filter.Q.value = 1.2;
  const gain = ctx.createGain();
  const length = rand(0.5, 0.9);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(rand(0.05, 0.09), t + length * 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  src.connect(filter).connect(gain).connect(ambientOut);
  src.start(t, rand(0, noise.duration - 1), length + 0.1);
}

// A playful water "bloop": a quick note that slides UP in pitch, like a drop or a fish
// nibbling at the surface. Sometimes two in a row.
function playBloop() {
  const count = Math.random() < 0.3 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const t = ctx.currentTime + i * rand(0.08, 0.15);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const f = rand(350, 700);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.07);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(gain).connect(ambientOut);
    osc.start(t);
    osc.stop(t + 0.15);
  }
}

// Is the lake sound system running? (Not until the first click, and not if turned off.)
function ambientReady() {
  return ctx && ambientOut && ctx.state === 'running';
}

// Sends a sound to the left or right speaker. pan: -1 = left, 0 = middle, 1 = right.
// Used so a frog on the left shore sounds like it's on the left.
function pannedOutput(pan) {
  if (!ctx.createStereoPanner) return ambientOut; // very old browsers
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  panner.connect(ambientOut);
  return panner;
}

// A bird: a few fast high "tweet"s that each slide upward.
// wildlife.js calls this when a bird flies past, so you see AND hear it.
export function playBird(pan = 0) {
  if (!ambientReady()) return;
  const out = pannedOutput(pan);
  const chirps = Math.floor(rand(2, 6));
  const pitch = rand(2200, 3400); // every bird sounds a bit different
  const gap = rand(0.09, 0.16);
  for (let i = 0; i < chirps; i++) {
    const t = ctx.currentTime + i * gap;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.4, t + 0.06);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.03, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.1);
  }
}

// A frog: "rib-bit". Two short low buzzes. A buzzy "sawtooth" wave, softened by a filter,
// with the volume wobbling fast so it sounds croaky.
// wildlife.js calls this when a frog on the shore croaks and hops.
export function playFrog(pan = 0) {
  if (!ambientReady()) return;
  const out = pannedOutput(pan);
  const pitch = rand(100, 150);
  [0, 0.18].forEach((delay, i) => {
    const t = ctx.currentTime + delay;
    const length = i === 0 ? 0.1 : 0.14;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = pitch * (i === 0 ? 1 : 0.9);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    // Croak wobble: a fast oscillator shaking the volume up and down.
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 30;
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = 0.02;
    wobble.connect(wobbleDepth).connect(gain.gain);
    osc.connect(filter).connect(gain).connect(out);
    osc.start(t);
    wobble.start(t);
    osc.stop(t + length + 0.05);
    wobble.stop(t + length + 0.05);
  });
}

function startLakeSounds() {
  if (AUDIO.lakeVolume <= 0) return;
  ambientOut = ctx.createGain();
  ambientOut.gain.value = AUDIO.lakeVolume;
  ambientOut.connect(master);

  // Each sound repeats at its own random pace (seconds between plays).
  // (Birds and frogs are started by wildlife.js, so they match what you see.)
  repeatRandomly(playLap, 1.2, 3.5);
  repeatRandomly(playBloop, 1.5, 5);
  setAmbientTheme(ambientTheme);
}

// A deep, slowly shimmering hum for space: two low notes slightly out of tune with
// each other (that makes a gentle "wah-wah" beat), softened by a filter.
function startSpaceHum() {
  spaceHum = ctx.createGain();
  spaceHum.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  // A very slow oscillator moves the filter up and down, so the hum shimmers.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 250;
  lfo.connect(lfoDepth).connect(filter.frequency);
  lfo.start();
  for (const freq of [55, 55.7, 110.3]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.connect(filter);
    osc.start();
  }
  filter.connect(spaceHum).connect(ambientOut);
}

// Switch the background sounds to match the level: 'lake' or 'space'.
export function setAmbientTheme(theme) {
  ambientTheme = theme;
  if (!ctx || !ambientOut) return; // sound hasn't started yet; it'll use this theme when it does
  if (theme === 'space' && !spaceHum) startSpaceHum();
  if (spaceHum) spaceHum.gain.setTargetAtTime(theme === 'space' ? 0.08 : 0, ctx.currentTime, 0.5);
}

// Plays one note.
// freq = pitch in Hz, start = seconds from now, length = seconds, type = wave shape.
function tone(freq, start, length, type = 'sine', volume = 0.2) {
  if (!ctx || ctx.state !== 'running') return;
  volume *= AUDIO.effectsVolume;
  if (volume <= 0) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // Start silent, jump up quickly, then fade away (sounds like a bell or pluck).
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

// Checkpoint chime: two quick rising notes.
export function playChime() {
  tone(880, 0, 0.35, 'triangle');
  tone(1320, 0.1, 0.45, 'triangle');
}

// Victory fanfare: a short happy arpeggio (C, E, G, high C).
export function playFanfare() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.5, 'triangle', 0.22));
}

// Soft "nope" buzz.
export function playBuzz() {
  tone(180, 0, 0.3, 'square', 0.08);
}

// Splash when the bobber gets hit: a burst of "shhh" that gets duller as it fades,
// plus a low "bloomp".
export function playSplash() {
  if (!ctx || ctx.state !== 'running' || !noise) return;
  const t = ctx.currentTime;
  const v = AUDIO.effectsVolume;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3000, t);
  filter.frequency.exponentialRampToValueAtTime(300, t + 0.5);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.35 * v + 0.0001, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  src.connect(filter).connect(gain).connect(master);
  src.start(t, 0, 0.7);

  const osc = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.3);
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(0.3 * v + 0.0001, t + 0.01);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  osc.connect(g2).connect(master);
  osc.start(t);
  osc.stop(t + 0.4);
}

// Game over: three sad notes going down.
export function playGameOver() {
  [392, 330, 262].forEach((f, i) => tone(f, i * 0.28, 0.6, 'triangle', 0.2));
}

// Coin "ding": two quick bright notes.
export function playDing() {
  tone(1568, 0, 0.18, 'sine', 0.15);
  tone(2093, 0.06, 0.3, 'sine', 0.15);
}

// Golden Lure: a fast sparkly run up the scale.
export function playGoldenDing() {
  [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, i * 0.06, 0.35, 'sine', 0.14));
}

// ----- Flying "whoosh" -----
// A looping soft noise whose volume follows how hard the bobber is flying.
let thrustGain = null;
function startThrustSound() {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 700;
  filter.Q.value = 0.8;
  thrustGain = ctx.createGain();
  thrustGain.gain.value = 0;
  src.connect(filter).connect(thrustGain).connect(master);
  src.start();
}

// level: 0 = silent, 1 = full whoosh. Changes smoothly so it never clicks.
export function setThrust(level) {
  if (!ctx || ctx.state !== 'running') return;
  if (!thrustGain) startThrustSound();
  thrustGain.gain.setTargetAtTime(level * 0.12 * AUDIO.effectsVolume, ctx.currentTime, 0.08);
}

// Splashing down after a flight: a short "ploop".
export function playPlop() {
  tone(300, 0, 0.18, 'sine', 0.18);
  tone(160, 0.04, 0.25, 'sine', 0.15);
}

// Zap: a quick "pew" that slides down in pitch.
export function playZap() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1400, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.15);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.07 * AUDIO.effectsVolume + 0.0001, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.2);
}

// Poof: an obstacle got zapped. A burst of noise plus a happy little "bloop" up.
export function playPoof() {
  if (!ctx || ctx.state !== 'running' || !noise) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.25 * AUDIO.effectsVolume + 0.0001, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  src.connect(filter).connect(gain).connect(master);
  src.start(t, 0, 0.35);
  tone(500, 0.05, 0.2, 'sine', 0.15);
  tone(900, 0.12, 0.25, 'sine', 0.12);
}

// Falling into space: a whistle sliding down, like a cartoon fall.
export function playFall() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, t);
  osc.frequency.exponentialRampToValueAtTime(150, t + 1.0);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.15 * AUDIO.effectsVolume + 0.0001, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 1.2);
}

// Warping through the portal: a sweep rising up and up, with a sparkly shimmer.
export function playWarp() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(1800, t + 0.9);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.18 * AUDIO.effectsVolume + 0.0001, t + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 1.1);
  [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.4 + i * 0.08, 0.3, 'sine', 0.08));
}

// Picking up a Zap Pack: three quick rising electric blips.
export function playReload() {
  [660, 990, 1480].forEach((f, i) => tone(f, i * 0.07, 0.15, 'square', 0.06));
}

// ----- Portal hum -----
// A shimmering chord that fades in as you get close to the portal.
let portalGain = null;
function startPortalHum() {
  portalGain = ctx.createGain();
  portalGain.gain.value = 0;
  // A wobble on the volume makes it shimmer.
  const tremolo = ctx.createOscillator();
  tremolo.frequency.value = 5;
  const tremoloDepth = ctx.createGain();
  tremoloDepth.gain.value = 0.3;
  const shimmer = ctx.createGain();
  shimmer.gain.value = 0.7;
  tremolo.connect(tremoloDepth).connect(shimmer.gain);
  tremolo.start();
  for (const freq of [261.6, 392, 523.3]) { // C, G and high C
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(shimmer);
    osc.start();
  }
  shimmer.connect(portalGain).connect(master);
}

// closeness: 0 = far away (silent), 1 = right at the portal.
export function setPortalHum(closeness) {
  if (!ctx || ctx.state !== 'running') return;
  if (!portalGain) startPortalHum();
  portalGain.gain.setTargetAtTime(closeness * 0.06 * AUDIO.effectsVolume, ctx.currentTime, 0.2);
}
