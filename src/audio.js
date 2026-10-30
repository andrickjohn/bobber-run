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
let ambientTheme = 'lake'; // 'lake' = water and frogs, 'space' = cosmic hum, 'lava' = rumble
let lavaRumble = null;   // the lava rumble's volume knob
let iceWind = null;      // the icy wind's volume knob
let spaceHum = null;     // the hum's volume knob (made the first time it's needed)
let noise = null;      // a couple of seconds of random hiss, reused for splashy sounds

function unlock() {
  if (!ctx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    ctx = new AudioContextClass();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination); // ...and the main knob goes to the speakers
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

// For music.js: the audio context, main volume knob and noise, once sound has started.
export function getAudioParts() {
  return ctx && ctx.state === 'running' ? { ctx, master, noise } : null;
}

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
// in between. Only plays in the given world theme, and not while the tab is hidden.
function repeatRandomly(playSound, minWait, maxWait, theme) {
  function next() {
    if (ctx.state === 'running' && !document.hidden && ambientTheme === theme) playSound();
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
  repeatRandomly(playLap, 1.2, 3.5, 'lake');
  repeatRandomly(playBloop, 1.5, 5, 'lake');
  repeatRandomly(playCrackle, 0.3, 1.6, 'lava');
  repeatRandomly(playIceChime, 2, 6, 'ice');
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

// The lava world's deep rumble: noise with only the very lowest sounds let through,
// slowly swelling, like a volcano grumbling far away.
function startLavaRumble() {
  lavaRumble = ctx.createGain();
  lavaRumble.gain.value = 0;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 120;
  const swell = ctx.createGain();
  swell.gain.value = 1;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.15;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.5;
  lfo.connect(lfoDepth).connect(swell.gain);
  lfo.start();
  src.connect(filter).connect(swell).connect(lavaRumble).connect(ambientOut);
  src.start();
}

// Lava crackle: a tiny sharp pop of noise, like a bubble bursting or a rock cracking.
function playCrackle() {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = rand(1500, 4000);
  const gain = ctx.createGain();
  const length = rand(0.02, 0.06);
  gain.gain.setValueAtTime(rand(0.04, 0.12), t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  src.connect(filter).connect(gain).connect(ambientOut);
  src.start(t, rand(0, noise.duration - 0.2), length + 0.02);
}

// Icy wind: noise through a filter that slowly sweeps up and down, like wind howling
// over the snow.
function startIceWind() {
  iceWind = ctx.createGain();
  iceWind.gain.value = 0;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 3;
  filter.frequency.value = 500;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.1;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 300;
  lfo.connect(lfoDepth).connect(filter.frequency);
  lfo.start();
  src.connect(filter).connect(iceWind).connect(ambientOut);
  src.start();
}

// A tinkly ice chime: two high bell notes, like icicles bumping together.
function playIceChime() {
  const base = rand(1800, 2600);
  for (const [delay, mult] of [[0, 1], [rand(0.08, 0.2), 1.5]]) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = base * mult;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.03, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    osc.connect(gain).connect(ambientOut);
    osc.start(t);
    osc.stop(t + 0.9);
  }
}

// Switch the background sounds to match the level: 'lake', 'space', 'lava' or 'ice'.
export function setAmbientTheme(theme) {
  ambientTheme = theme;
  if (!ctx || !ambientOut) return; // sound hasn't started yet; it'll use this theme when it does
  if (theme === 'space' && !spaceHum) startSpaceHum();
  if (theme === 'lava' && !lavaRumble) startLavaRumble();
  if (theme === 'ice' && !iceWind) startIceWind();
  if (iceWind) iceWind.gain.setTargetAtTime(theme === 'ice' ? 0.6 : 0, ctx.currentTime, 0.5);
  if (spaceHum) spaceHum.gain.setTargetAtTime(theme === 'space' ? 0.08 : 0, ctx.currentTime, 0.5);
  if (lavaRumble) lavaRumble.gain.setTargetAtTime(theme === 'lava' ? 0.5 : 0, ctx.currentTime, 0.5);
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

// Ring chime: two quick rising notes.
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

// Coin "ding": two quick bright notes. Each coin in a combo is one step higher up the
// musical scale than the last (up to two octaves), so a long trail plays a rising tune!
// Multiplying by 2^(steps/12) moves a note up by that many semitones (piano keys).
export function playComboDing(count) {
  const steps = Math.min(Math.max(count - 1, 0), 24);
  const f = 1046.5 * Math.pow(2, steps / 12);
  tone(f, 0, 0.16, 'sine', 0.13);
  tone(f * 1.5, 0.05, 0.25, 'sine', 0.1);
}

// The combo multiplier went up: a quick happy run of notes (more notes for bigger ones).
export function playMultiplierUp(multiplier) {
  const notes = [784, 988, 1175, 1568, 1976, 2349];
  for (let i = 0; i < Math.min(multiplier + 1, notes.length); i++) tone(notes[i], i * 0.05, 0.22, 'square', 0.05);
}

// A big combo was lost: a sad "wah-wah" sliding down.
export function playComboBreak() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.5);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.15 * AUDIO.effectsVolume + 0.0001, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.6);
}

// Golden Lure: a fast sparkly run up the scale.
export function playGoldenDing() {
  [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, i * 0.06, 0.35, 'sine', 0.14));
}

// Jump: a quick springy "boing" that slides up.
export function playJump() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(260, t);
  osc.frequency.exponentialRampToValueAtTime(720, t + 0.15);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16 * AUDIO.effectsVolume + 0.0001, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.22);
}

// The big leap across a gap: a rising "whoosh" of noise plus a happy rising arpeggio.
export function playLeap() {
  if (!ctx || ctx.state !== 'running' || !noise) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(300, t);
  filter.frequency.exponentialRampToValueAtTime(2500, t + 0.7);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25 * AUDIO.effectsVolume + 0.0001, t + 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
  src.stop(t + 1.3);
  [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.25, 'triangle', 0.12));
}

// Splashing down after a jump: a short "ploop".
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

// The hyperspace jump: a roar that rises higher and louder for "seconds", then a deep
// BOOM as you burst through (the moment the screen flashes white).
export function playHyperspace(seconds) {
  if (!ctx || ctx.state !== 'running' || !noise) return;
  const t = ctx.currentTime;
  const v = AUDIO.effectsVolume;
  // Rising roar: noise through a filter that sweeps from low to high.
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.5;
  filter.frequency.setValueAtTime(150, t);
  filter.frequency.exponentialRampToValueAtTime(4000, t + seconds);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.35 * v + 0.0001, t + seconds);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.4);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
  src.stop(t + seconds + 0.5);
  // A rising tone on top.
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(900, t + seconds);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.06 * v + 0.0001, t + seconds * 0.9);
  og.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.1);
  osc.connect(og).connect(master);
  osc.start(t);
  osc.stop(t + seconds + 0.2);
  // BOOM: a deep note that drops and fades.
  const boom = ctx.createOscillator();
  const bg = ctx.createGain();
  boom.frequency.setValueAtTime(120, t + seconds);
  boom.frequency.exponentialRampToValueAtTime(35, t + seconds + 1.2);
  bg.gain.setValueAtTime(0.0001, t + seconds);
  bg.gain.exponentialRampToValueAtTime(0.5 * v + 0.0001, t + seconds + 0.03);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 1.4);
  boom.connect(bg).connect(master);
  boom.start(t + seconds);
  boom.stop(t + seconds + 1.5);
}

// Falling into the black hole: a deep drone that bends lower and lower, a swirling
// whoosh that speeds up, and a final "gulp" when you're swallowed.
export function playBlackHole(seconds) {
  if (!ctx || ctx.state !== 'running' || !noise) return;
  const t = ctx.currentTime;
  const v = AUDIO.effectsVolume;
  // Deep drone sliding down
  const drone = ctx.createOscillator();
  const dg = ctx.createGain();
  drone.type = 'sawtooth';
  drone.frequency.setValueAtTime(140, t);
  drone.frequency.exponentialRampToValueAtTime(30, t + seconds);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 500;
  dg.gain.setValueAtTime(0.0001, t);
  dg.gain.exponentialRampToValueAtTime(0.18 * v + 0.0001, t + 0.4);
  dg.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.3);
  drone.connect(lowpass).connect(dg).connect(master);
  drone.start(t);
  drone.stop(t + seconds + 0.4);
  // Swirling whoosh: noise whose volume wobbles faster and faster (like circling round)
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(1500, t);
  band.frequency.exponentialRampToValueAtTime(200, t + seconds);
  const wg = ctx.createGain();
  wg.gain.value = 0.12 * v;
  const wobble = ctx.createOscillator();
  wobble.frequency.setValueAtTime(1, t);
  wobble.frequency.exponentialRampToValueAtTime(14, t + seconds);
  const wobbleDepth = ctx.createGain();
  wobbleDepth.gain.value = 0.1 * v;
  wobble.connect(wobbleDepth).connect(wg.gain);
  src.connect(band).connect(wg).connect(master);
  src.start(t);
  wobble.start(t);
  src.stop(t + seconds);
  wobble.stop(t + seconds);
  // Gulp!
  tone(90, seconds, 0.5, 'sine', 0.4);
  tone(55, seconds + 0.08, 0.6, 'sine', 0.35);
}

// 3-2-1-GO! beeps: three short "boops", then a higher, longer "GO!" (like a race start).
export function playCountBeep(go) {
  if (go) {
    tone(1047, 0, 0.5, 'square', 0.1);
    tone(1568, 0, 0.5, 'triangle', 0.15);
  } else {
    tone(523, 0, 0.18, 'square', 0.1);
  }
}

// A soft "bloop" when a tip card slides in.
export function playTip() {
  tone(660, 0, 0.12, 'sine', 0.12);
  tone(990, 0.08, 0.18, 'sine', 0.1);
}
