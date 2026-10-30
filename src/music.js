// music.js
// Background music, made entirely in code (no music files), that reacts to how you play.
//
// It's a little "step sequencer", like a drum machine: every bar is cut into 16 steps,
// and on each step it decides which notes to play. There are four layers:
//   pad   – soft chords that are always playing
//   drums – kick, snare and hi-hat        (fade in at a ×2 combo)
//   bass  – a bouncy bass line             (fade in at ×3)
//   lead  – a sparkly melody               (fade in at ×4 and up)
// Lose your combo and the extra layers fade back out. Each world has its own key,
// speed (tempo), chords and instrument sounds (see MUSIC in config.js).
//
// Timing trick: JavaScript timers are a bit wobbly, but Web Audio can start a sound at an
// exact time. So every 25 ms we look a little way ahead and book any notes due soon,
// each at its exact start time. That keeps the beat perfectly steady.

import { AUDIO, MUSIC } from './config.js';
import { getAudioParts } from './audio.js';

let ctx = null;
let noise = null;
let out = null;        // the music's own volume knob (goes into the main volume)
const layers = {};     // a volume knob per layer: pad, drums, bass, lead
let leadDelay = null;  // an echo on the melody
let theme = MUSIC.themes.lake;
let intensity = 0;     // 0 = just the pad ... 3 = everything
let ducked = false;    // quieter while paused
let step = 0;          // which 16th-note step we're on
let nextTime = 0;      // when (in audio time) the next step starts
let timer = null;

// MIDI note number → frequency. Note 69 is the A above middle C (440 Hz), and every
// 12 notes up doubles the frequency (one octave), so each note is 2^(1/12) higher.
const freq = (note) => 440 * Math.pow(2, (note - 69) / 12);

// The note for a step of the scale ("degree"): 0 = the root, 1 = the next note up, ...
// Going past the top of the scale wraps around into the next octave.
function scaleNote(degree, octave = 0) {
  const s = theme.scale;
  const wrapped = ((degree % s.length) + s.length) % s.length;
  const octaves = Math.floor(degree / s.length) + octave;
  return theme.root + s[wrapped] + 12 * octaves;
}

function setUp() {
  out = ctx.createGain();
  out.gain.value = AUDIO.musicVolume;
  out.connect(getAudioParts().master);
  for (const name of ['pad', 'drums', 'bass', 'lead']) {
    layers[name] = ctx.createGain();
    layers[name].gain.value = name === 'pad' ? 1 : 0;
  }
  // The pad goes through a "lowpass" filter: it cuts the buzzy high sounds, so it's soft.
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 1400;
  layers.pad.connect(padFilter).connect(out);
  layers.drums.connect(out);
  layers.bass.connect(out);
  // The melody gets an echo: a copy delayed by 3 steps, fed back into itself (quieter
  // each time), so each note repeats a few times and fades.
  leadDelay = ctx.createDelay(1);
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  layers.lead.connect(out);
  layers.lead.connect(leadDelay);
  leadDelay.connect(feedback).connect(leadDelay);
  leadDelay.connect(wet).connect(out);
}

// One note: an oscillator with a quick fade-in ("attack") and a fade-out ("release").
function note(layer, wave, frequency, start, length, volume, attack = 0.01) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(layers[layer]);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

// Drum sounds
function kick(t) {
  // A low "boom": a sine wave that drops quickly in pitch.
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  gain.gain.setValueAtTime(0.9, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(gain).connect(layers.drums);
  osc.start(t);
  osc.stop(t + 0.32);
}
function noiseHit(t, type, frequency, length, volume) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  src.connect(filter).connect(gain).connect(layers.drums);
  src.start(t, Math.random() * 2); // start somewhere random in the hiss
  src.stop(t + length + 0.02);
}
const snare = (t) => noiseHit(t, 'bandpass', 1800, 0.18, 0.5);
const hat = (t, open) => noiseHit(t, 'highpass', 7000, open ? 0.12 : 0.04, open ? 0.18 : 0.12);

// Plays whatever belongs on step "i" (counting 16 steps per bar) at time t.
function playStep(i, t) {
  const stepLength = 60 / theme.tempo / 4; // a 16th note, in seconds
  const s = i % 16;
  const bar = Math.floor(i / 16);
  const chord = theme.chords[bar % theme.chords.length]; // the scale degree the chord is built on

  // Pad: a three-note chord at the start of each bar, held for the whole bar.
  if (s === 0) {
    for (const d of [0, 2, 4]) {
      note('pad', theme.padWave, freq(scaleNote(chord + d, 0)), t, stepLength * 16, 0.07, 0.4);
    }
  }
  // Only book notes for layers you can hear (saves work for the computer).
  if (intensity >= 1) {
    if (theme.kick.includes(s)) kick(t);
    if (theme.snare.includes(s)) snare(t);
    if (theme.hats.includes(s)) hat(t, s % 8 === 6);
  }
  if (intensity >= 2 && theme.bass.includes(s)) {
    const bassNote = scaleNote(chord, -1) + (s === 14 ? 7 : 0); // a little jump up on the last one
    note('bass', theme.bassWave, freq(bassNote), t, stepLength * 1.6, 0.22);
  }
  if (intensity >= 3 && s % 2 === 0) {
    // Melody: walk around the chord's notes in a pattern that changes every bar. Some
    // steps are rests, so it has room to breathe.
    const pattern = [0, 2, 4, 2, 7, 4, 2, 4];
    const index = (s / 2 + bar * 3) % pattern.length;
    const rest = (s / 2 + bar) % 5 === 4;
    if (!rest) note('lead', theme.leadWave, freq(scaleNote(chord + pattern[index], 1)), t, stepLength * 1.8, 0.07);
  }
}

// Every 25 ms: book every step that starts in the next 0.15 seconds.
function schedule() {
  const parts = getAudioParts();
  if (!parts) return; // sound hasn't started yet (waiting for the first click)
  if (!ctx) {
    ctx = parts.ctx;
    noise = parts.noise;
    setUp();
  }
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05; // (after a pause in the tab)
  while (nextTime < ctx.currentTime + 0.15) {
    playStep(step, nextTime);
    nextTime += 60 / theme.tempo / 4;
    step = (step + 1) % (16 * theme.chords.length * 4);
  }
}

// Starts the music (if it isn't running) and switches to a world's style.
export function setMusicTheme(name) {
  const next = MUSIC.themes[name] || MUSIC.themes.lake;
  if (next !== theme) {
    theme = next;
    step = 0; // start the new tune from the top
  }
  if (!timer) timer = setInterval(schedule, 25);
}

// level: 0 = pad only, 1 = + drums, 2 = + bass, 3 = + melody. Layers fade in and out.
let appliedIntensity = -1; // the level the layer volumes were last set for
export function setMusicIntensity(level) {
  intensity = Math.max(0, Math.min(3, level));
  if (!ctx || intensity === appliedIntensity) return; // (called every frame: only act on changes)
  appliedIntensity = intensity;
  const t = ctx.currentTime;
  layers.drums.gain.setTargetAtTime(intensity >= 1 ? 1 : 0, t, 0.3);
  layers.bass.gain.setTargetAtTime(intensity >= 2 ? 1 : 0, t, 0.3);
  layers.lead.gain.setTargetAtTime(intensity >= 3 ? 1 : 0, t, 0.3);
  leadDelay.delayTime.setValueAtTime((60 / theme.tempo / 4) * 3, t); // the echo follows the beat
}

// Quieter while paused (or on a menu).
export function setMusicDucked(on) {
  if (on === ducked) return;
  ducked = on;
  if (out) out.gain.setTargetAtTime(AUDIO.musicVolume * (on ? 0.35 : 1), ctx.currentTime, 0.2);
}
