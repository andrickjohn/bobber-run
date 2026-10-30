// setpieces.js
// Designs the course for each world before the race starts: where every coin trail,
// ring gate and obstacle goes.
//
// Instead of scattering things at random, the course is stitched together from short
// designed patterns called "set-pieces", one after another down the lake:
//   line / shift / curve – a coin trail straight down a lane, changing lanes, or curving
//   logHop    – a log lying across your lane, with a coin arc over it: jump to collect!
//   slalom    – weave between lily pads (or logs, later on) to stay on the trail
//   gateRun   – change lanes and finish through a ring gate
//   crossing  – a pike patrols across your trail: time it
//   lureSwing – a lure swings across your trail: time it
//   gauntlet  – the big finale before the portal: a zigzag through a row of logs
// Early in a world you only get the easy pieces. Harder ones unlock as you go, so each
// run has a rhythm: easy, then a challenge, then a big payoff. Over the gaps between
// lakes, coins follow the arc of the big leap.
//
// Everything random here uses "rng" instead of Math.random. Give it the same seed and
// you get the exact same course (that's how the daily course is the same for everyone).

import { COINS, OBSTACLES, SETPIECES } from './config.js';
import { getLevel, getLakeAt, isOverLake, getLeapAfter, getLeapHeight, laneToX } from './world.js';

// A random number generator you can "seed" (mulberry32). Same seed = same numbers.
// It scrambles a 32-bit number with multiplies and shifts; the details don't matter,
// only that the results look random and are always the same for a seed.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smoothstep: 0 → 1 smoothly as t goes from a to b.
function smooth(a, b, t) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

// The shape of a jump over something at Z = overZ: 0 far away, highest right over it.
// (A parabola: 1 − (distance ÷ half-width)², never below 0.)
function hopHeight(z, overZ) {
  const d = (z - overZ) / SETPIECES.hopHalfLength;
  return Math.max(0, SETPIECES.hopHeight * (1 - d * d));
}

// ---------------------------------------------------------------------------
// The set-pieces. Each has a length (along the course), a level (1 easy … 3 hard) and
// build(p, z0), which adds its coins, rings and obstacles starting at Z = z0.
// p has helper functions (see planCourse below).
// ---------------------------------------------------------------------------
const PIECES = {
  line: {
    level: 1, length: 36,
    build(p, z0) {
      const lane = p.lane();
      p.trail(z0, 11, () => lane);
      if (p.rng() < 0.5) p.ring(lane, z0 - 22); // often a ring gate right on the trail
      p.maybeHazard(z0 - 18, lane);
    },
  },
  shift: {
    level: 1, length: 40,
    build(p, z0) {
      const [a, b] = p.twoLanes();
      p.trail(z0, 12, (t) => a + (b - a) * smooth(0.15, 0.7, t));
      if (p.rng() < 0.4) p.ring(b, z0 - 33); // sometimes the lane change ends in a ring
      p.maybeHazard(z0 - 20, b);
    },
  },
  curve: {
    level: 1, length: 40,
    build(p, z0) {
      const lane = p.lane(0.45);
      p.trail(z0, 12, (t) => lane + Math.sin(t * Math.PI * 2) * 0.25);
      p.maybeHazard(z0 - 20, lane);
    },
  },
  miniHop: {
    level: 1, length: 26,
    build(p, z0) {
      // A short one that fits in small lakes: one log, one coin arc over it.
      const lane = p.lane(0.5);
      const logZ = z0 - 13;
      p.obstacle('log', lane, logZ, { still: true });
      p.trail(z0, 8, () => lane, (z) => hopHeight(z, logZ));
      p.maybeHazard(z0 - 6, lane);
    },
  },
  logHop: {
    level: 1, length: 40,
    build(p, z0) {
      const lane = p.lane(0.5);
      const logZ = z0 - 20;
      p.obstacle('log', lane, logZ, { still: true });
      p.trail(z0, 12, () => lane, (z) => hopHeight(z, logZ));
    },
  },
  doubleHop: {
    level: 2, length: 50,
    build(p, z0) {
      // Two logs: hop, land, scoop a few coins, hop again.
      const lane = p.lane(0.5);
      const logs = [z0 - 13, z0 - 35];
      for (const z of logs) p.obstacle('log', lane, z, { still: true });
      p.trail(z0, 15, () => lane, (z) => Math.max(...logs.map((lz) => hopHeight(z, lz))));
    },
  },
  gateRun: {
    level: 1, length: 44,
    build(p, z0) {
      // Change lanes, then straight through a ring gate (the trail goes right through it).
      const [a, b] = p.twoLanes();
      p.trail(z0, 13, (t) => a + (b - a) * smooth(0.05, 0.5, t));
      p.ring(b, z0 - 33);
    },
  },
  slalom: {
    level: 2, length: 56,
    build(p, z0) {
      // Things to weave around, on alternating sides; the trail curves around them.
      const side = p.rng() < 0.5 ? -1 : 1;
      const spots = [z0 - 12, z0 - 30, z0 - 48];
      spots.forEach((z, i) => {
        const s = i % 2 === 0 ? side : -side;
        if (p.level >= 3) p.obstacle('log', s * 0.55, z, { still: true });
        else p.obstacle('lily', s * 0.42, z);
      });
      // The trail goes the opposite way to whatever is at each spot: a cosine wave
      // that's at −side by the first spot, +side by the second, and so on.
      p.trail(z0, 16, (t, d) => -side * 0.42 * Math.cos(((d - 12) / 18) * Math.PI));
    },
  },
  crossing: {
    level: 2, length: 36,
    build(p, z0) {
      const lane = p.lane(0.45);
      p.obstacle('pike', lane + 0.3, z0 - 18);
      if (p.level >= 3) p.obstacle('bass', lane, z0 - 30);
      p.trail(z0, 11, () => lane);
    },
  },
  lureSwing: {
    level: 2, length: 36,
    build(p, z0) {
      const lane = p.lane(0.25);
      p.obstacle('lure', lane, z0 - 18);
      p.trail(z0, 11, () => lane);
      if (p.rng() < 0.5) p.ring(lane, z0 - 30);
    },
  },
  gauntlet: {
    level: 3, length: 72, finale: true,
    build(p, z0) {
      // A row of logs on alternating sides: zigzag through the gaps between them.
      // (22 apart: about a second and a half at full speed to slide across each time.)
      const side = p.rng() < 0.5 ? -1 : 1;
      const spots = [z0 - 10, z0 - 32, z0 - 54];
      spots.forEach((z, i) => p.obstacle('log', (i % 2 === 0 ? side : -side) * 0.55, z, { still: true }));
      p.trail(z0, 21, (t, d) => -side * 0.4 * Math.cos(((d - 10) / 22) * Math.PI), null, true);
    },
  },
};

// ---------------------------------------------------------------------------
// planCourse: lay out the whole course for the current level.
// Returns { trails: [[{ x, z, height, golden }]], pickups: [...], rings: [...], obstacles: [...] }
// ---------------------------------------------------------------------------
export function planCourse(rng, { hard = false, density = 1 } = {}) {
  const level = getLevel();
  const finishZ = level.finishZ;
  const plan = { trails: [], pickups: [], rings: [], obstacles: [] };

  // Helpers the set-pieces use. p.level is how hard the current stretch is (1–3).
  const p = {
    rng,
    level: 1,
    // A random lane, at most "spread" from the middle.
    lane: (spread = 0.6) => (rng() * 2 - 1) * spread,
    // Two lanes at least a third of the lake apart (for lane changes).
    twoLanes() {
      const a = (rng() * 2 - 1) * 0.6;
      const b = a > 0 ? -0.6 + rng() * (a - 0.35 + 0.6) : a + 0.35 + rng() * (0.6 - a - 0.35);
      return [a, b];
    },
    // A trail of n coins starting at z0. laneAt(t, d) gives the lane (t = 0 … 1 along the
    // trail, d = distance from its start); heightAt(z) gives how high the coin floats.
    trail(z0, n, laneAt, heightAt = null, golden = rng() < COINS.goldenChance) {
      const coins = [];
      for (let i = 0; i < n; i++) {
        const z = z0 - i * COINS.spacing;
        const lane = Math.min(0.8, Math.max(-0.8, laneAt(i / (n - 1), i * COINS.spacing)));
        coins.push({ x: laneToX(lane, z), z, height: heightAt ? heightAt(z) : 0, golden: golden && i === n - 1 });
      }
      plan.trails.push(coins);
    },
    obstacle(type, lane, z, opts) {
      plan.obstacles.push({ type, x: laneToX(lane, z), z, opts });
    },
    ring(lane, z) {
      plan.rings.push({ x: laneToX(lane, z), z });
    },
    // Sometimes (more often on harder stretches, and with more obstacles chosen) a
    // roaming hazard nearby: a pike, a jumping bass, a turtle or a swinging lure.
    maybeHazard(z, trailLane) {
      if (rng() > SETPIECES.hazardChance * p.level * density) return;
      const types = ['pike', 'bass', 'turtle', 'lure'];
      const type = types[Math.floor(rng() * types.length)];
      // Off to one side of the trail, so it's a threat you steer around, not a wall.
      const lane = trailLane > 0 ? trailLane - 0.4 : trailLane + 0.4;
      p.obstacle(type, lane, z);
    },
  };

  // Picks the next set-piece: only ones up to the current level, with the hardest
  // allowed ones twice as likely. Never the same piece twice in a row.
  let last = null;
  function pickPiece(maxLevel, room) {
    const choices = [];
    for (const [name, piece] of Object.entries(PIECES)) {
      if (piece.finale || piece.level > maxLevel || name === last || piece.length > room) continue;
      const weight = piece.level === maxLevel ? 2 : 1;
      for (let w = 0; w < weight; w++) choices.push(name);
    }
    if (choices.length === 0) return null;
    return choices[Math.floor(rng() * choices.length)];
  }

  // Walk down the course from the start to just before the portal.
  let z = -SETPIECES.firstZ;
  const endZ = finishZ + SETPIECES.endMargin;
  // Room for the finale (the gauntlet) at the end, on harder stretches.
  const finale = PIECES.gauntlet;
  const finaleZ = endZ + finale.length;
  let finaleDone = false;
  while (z > endZ) {
    const lake = getLakeAt(z);
    // Over a gap (or right at a lake's end): coins along the big leap, then carry on in
    // the next lake.
    if (!lake || !isOverLake(z, 6)) {
      const behind = level.lakes.filter((l) => l.end >= z - 6).pop();
      const leap = behind && getLeapAfter(behind);
      if (!leap) break;
      const coins = [];
      for (let lz = leap.fromZ - 2; lz > leap.toZ + 2; lz -= COINS.spacing * 1.4) {
        coins.push({ x: laneToX(0, lz), z: lz, height: getLeapHeight(lz), golden: false });
      }
      plan.trails.push(coins);
      z = leap.toZ - 3;
      continue;
    }
    // How hard this stretch is: harder further along (and on Hard difficulty).
    const progress = z / finishZ;
    p.level = Math.min(3, (progress < 0.3 ? 1 : progress < 0.62 ? 2 : 3) + (hard ? 1 : 0));
    // The finale goes in the last stretch of the last lake, if it fits.
    const lakeRoom = z - Math.max(lake.end + 6, endZ);
    if (!finaleDone && z <= finaleZ + 20 && lake === level.lakes[level.lakes.length - 1] && lakeRoom >= finale.length) {
      p.level = 3;
      finale.build(p, z);
      finaleDone = true;
      z -= finale.length + COINS.gapMin;
      continue;
    }
    const name = pickPiece(p.level, lakeRoom);
    if (!name) {
      // No piece fits before this lake ends: a short trail to fill the space, then the gap.
      if (lakeRoom > 12) {
        const lane = p.lane(0.4);
        p.trail(z, Math.floor(lakeRoom / COINS.spacing), () => lane);
      }
      z = lake.end + 5;
      continue;
    }
    PIECES[name].build(p, z);
    last = name;
    z -= PIECES[name].length;

    // A breather between pieces. Sometimes a Zap Pack floats here, and sometimes an
    // extra roaming obstacle (more often with the "Number of Obstacles" slider up).
    const gap = COINS.gapMin + rng() * (COINS.gapMax - COINS.gapMin);
    if (isOverLake(z - gap / 2, 4)) {
      if (rng() < SETPIECES.ringChance) {
        // A ring gate with a few coins leading into it.
        const lane = p.lane(0.5);
        p.trail(z - 2, 4, () => lane, null, false);
        p.ring(lane, z - 2 - 4 * COINS.spacing);
      } else if (rng() < COINS.zapPackChance * 2) {
        plan.pickups.push({ kind: 'zapPack', x: laneToX(p.lane(), z - gap / 2), z: z - gap / 2, height: 0 });
      }
      if (rng() < SETPIECES.fillerChance * density) {
        const types = ['bass', 'turtle', 'pike', 'whirlpool'];
        plan.obstacles.push({ type: types[Math.floor(rng() * types.length)], x: laneToX(p.lane(0.5), z - gap / 2), z: z - gap / 2 });
      }
    }
    z -= gap;
  }
  // (Keep obstacles away from the start line.)
  plan.obstacles = plan.obstacles.filter((o) => o.z < -OBSTACLES.startSafeZone + 8);
  return plan;
}

// The daily course: everyone gets the same seed on the same day (YYYYMMDD), plus the
// world number, so every world's daily course is different too.
export function dailySeed(levelIndex) {
  const d = new Date();
  return (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) * 10 + levelIndex;
}
