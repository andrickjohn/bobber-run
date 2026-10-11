// config.js
// Every tunable number and color in the game lives here.
// Change a value, save the file, and the browser reloads with the new value.
//
// Coordinate system used everywhere:
//   X = left / right across the lake
//   Y = up / down
//   Z = along the lake. The start line is at Z = 0 and the finish is at
//       Z = -LAKE.length (the course runs toward negative Z, "into the screen").

export const LAKE = {
  length: 400,        // distance from start line to finish
  width: 80,          // average distance from left shore to right shore
  extraBehindStart: 40, // water behind the start line (under the dock)
  extraPastFinish: 30,  // water past the finish before the far shore
  // Shape of the shoreline (makes the lake curvy instead of a straight "road")
  widthWiggle: 12,    // how much the lake gets wider and narrower along its length
  bendAmount: 12,     // how far the lake curves left and right
  shoreBumps: 3,      // small random bumps and coves along the edge
  straightStart: 60,  // the lake is straight and centered for this distance near the dock
  // Waves
  waveHeight: 0.50,   // how tall the waves are
  waveLength: 14,     // distance between wave crests
  waveSpeed: 1.2,     // how fast the waves travel
  waveRandomness: 0.12, // extra random "chop" added to every point of the water
  waterOpacity: 0.82, // 1 = solid, lower = you can see the sandy shallows
  waterCellSize: 3,   // size of each square in the water mesh (smaller = smoother, slower)
};

export const DOCK = {
  width: 64,         // most of the lake's width (the lake is LAKE.width wide)
  deckHeight: 1.2,   // height of the planks above the water
  plankWidth: 1.0,
  postSpacing: 5,
};

export const SHORE = {
  sandWidth: 6,      // width of the sand beach next to the water
  landSize: 130,     // how far the land reaches past the lake on every side
  terrainCellSize: 2.5, // size of each square in the land mesh
  hillHeight: 10,    // how tall the hills behind the beach get
  treeCount: 110,
  rockCount: 40,
  reedCount: 90,     // clumps of cattails along the water's edge
};

export const BOBBER = {
  radius: 0.8,
  speedSetting: 5,     // 1–10, the "Bobber Speed" slider (5 = normal)
  maxSpeed: 16,        // top speed at setting 5 (units per second)
  acceleration: 24,    // strongest pull toward the cursor at setting 5
  pullScreenDistance: 0.3, // cursor this far from the bobber ON SCREEN gives the full pull
                           // (1.0 = half the screen height), same forward and backward
  deadZone: 1.2,       // cursor closer than this does nothing (stops jitter)
  drag: 1.4,           // water drag: higher = stops sooner
  bounce: 0.4,         // how much speed is kept when bumping the shoreline
  bobHeight: 0.15,     // extra up/down bobbing on top of the waves
  bobSpeed: 3,
  floatOffset: 0.25,   // how high the center of the bobber sits above the water
  tiltAmount: 0.04,    // how much it leans when moving
  startZ: -3,          // where the bobber starts (just past the end of the dock)
};

export const COURSE = {
  checkpointCount: 4,  // gates spaced evenly between the start and the finish
  gateWidth: 26,       // distance between a gate's two buoys
  buoyRadius: 1.2,
  gateShiftMax: 20,    // gates are moved up to this far left or right of the lake's middle
  gateAngleMax: 0.6,   // and turned up to this much (radians; 0.6 is about 35 degrees)
  gateZJitter: 10,     // and nudged up to this far forward or back
  finishZ: -LAKE.length,
  finishWidth: 40,     // distance between the two finish posts
  finishHeight: 9,     // how tall the finish arch is
  startFlagX: -6,      // where the little flag on the start line stands
};

export const OBSTACLES = {
  count: 15,             // the "Number of Obstacles" slider (5–40)
  speedMultiplier: 1,    // all obstacles move this many times faster (difficulty changes it)
  includeWhirlpools: false, // whirlpools only appear on Hard (set by DIFFICULTY below)
  startSafeZone: 30,     // no obstacles closer than this to the start line
  checkpointSafeRadius: 12, // no obstacles placed this close to a checkpoint's center
  finishSafeZone: 15,    // no obstacles this close to the finish

  bass: {
    radius: 1.0,         // hit circle size
    jumpDistance: 12,    // how far sideways each leap goes
    jumpHeight: 5,
    jumpTime: 1.3,       // seconds in the air
    waitMin: 1.0,        // seconds under water between leaps
    waitMax: 2.5,
    dangerHeight: 2.0,   // only hits the bobber while lower than this (near the water)
  },
  pike: {
    radius: 1.6,
    speed: 7,            // units per second while patrolling
    edgeMargin: 4,       // turns around this far from the shore
  },
  turtle: {
    radius: 1.5,
    speed: 4.5,          // slower than the bobber, so you can escape
    chaseRadius: 12,     // starts chasing when the bobber is this close
    giveUpRadius: 20,    // goes home when the bobber gets this far away
  },
  lure: {
    radius: 0.9,
    lineLength: 18,      // length of the fishing line (longer = slower swing)
    swingAngle: 0.65,    // how far it swings each way (radians)
    dangerHeight: 2.2,   // only hits the bobber while lower than this
  },
  log: {
    length: 7,
    radius: 0.7,
    speed: 3,            // drift speed across the lake
  },
  lily: {
    patchRadius: 5,      // size of the lily pad patch
    padCount: 9,
    drag: 2.5,           // extra water drag inside the patch (higher = slower)
  },
  whirlpool: {
    radius: 9,           // pull reaches this far
    pull: 14,            // pull strength at the center (the bobber's own pull is 24)
    swirl: 6,            // sideways spinning push
    pikeChance: 0.6,     // chance a pike circles in the middle waiting for you
  },
};

export const WILDLIFE = {
  frogSpacing: 22,     // a frog sits on the beach about every this many units (each side)
  frogWaitMin: 7,      // seconds between frog croaks (random between min and max)
  frogWaitMax: 16,
  birdWaitMin: 5,      // seconds between birds flying past
  birdWaitMax: 12,
  birdSpeed: 9,        // how fast birds fly across
};

export const COINS = {
  maxOnScreen: 8,      // most coins on the lake at once
  lifetime: 14,        // seconds before a coin disappears
  fadeTime: 2,         // it fades out during its last this-many seconds
  spawnMin: 0.6,       // seconds between new coins (random between min and max)
  spawnMax: 1.6,
  spawnAheadMin: 15,   // coins appear this far ahead of the bobber...
  spawnAheadMax: 80,   // ...up to this far
  pickupRadius: 1.0,   // coin size for touching
  hoverHeight: 0.9,    // how high above the water coins float
  goldenChance: 1 / 15, // chance a spawn is a Golden Lure instead of a coin
  obstacleClearance: 3, // coins never appear this close to an obstacle
};

export const SCORING = {
  coin: 10,
  goldenLure: 50,
  checkpoint: 100,
  finish: 500,
  timeBonusSeconds: 300, // time bonus = max(0, timeBonusSeconds − your time) × timeBonusPerSecond
  timeBonusPerSecond: 2,
  perLifeLeft: 100,
  missedCheckpoint: -25, // going around a checkpoint costs points
  difficulty: 'normal',  // 'easy', 'normal' or 'hard' (default; the settings screen changes it)
  multiplier: { easy: 1, normal: 1.5, hard: 2 },
};

// What each difficulty changes. When a game starts, settings.js copies the chosen
// column into the values above (OBSTACLES, COINS, GAME), and the game reads those.
export const DIFFICULTY = {
  easy: {
    label: 'Easy',
    description: 'Slow fish, lazy turtles, lots of coins, 5 lives.',
    lives: 5,
    invincibleTime: 2.5,
    obstacleSpeed: 0.65,    // obstacles move at 65% speed
    turtleChaseRadius: 8,
    turtleGiveUpRadius: 14,
    coinsMax: 12,
    coinSpawnMin: 0.4,
    coinSpawnMax: 1.0,
    whirlpools: false,
  },
  normal: {
    label: 'Normal',
    description: 'The regular game. 3 lives.',
    lives: 3,
    invincibleTime: 2,
    obstacleSpeed: 1,
    turtleChaseRadius: 12,
    turtleGiveUpRadius: 20,
    coinsMax: 8,
    coinSpawnMin: 0.6,
    coinSpawnMax: 1.6,
    whirlpools: false,
  },
  hard: {
    label: 'Hard',
    description: 'Fast fish, hungry turtles, fewer coins, whirlpools! 3 lives.',
    lives: 3,
    invincibleTime: 1.2,
    obstacleSpeed: 1.45,
    turtleChaseRadius: 18,
    turtleGiveUpRadius: 28,
    coinsMax: 5,
    coinSpawnMin: 1.0,
    coinSpawnMax: 2.4,
    whirlpools: true,
  },
};

// Limits for the settings sliders
export const SETTINGS_LIMITS = {
  speedMin: 1,
  speedMax: 10,
  obstaclesMin: 5,
  obstaclesMax: 40,
};

export const GAME = {
  lives: 3,
  invincibleTime: 2,   // seconds of blinking safety after a respawn
  respawnDelay: 0.9,   // seconds to watch the splash before respawning
};

export const EFFECTS = {
  wakeMinSpeed: 7,     // the bobber leaves a foamy wake when faster than this
  wakeInterval: 0.045, // seconds between foam puffs
  wakeLife: 1.3,       // how long each puff lasts
  wakeSpread: 1.4,     // how fast the two sides of the wake spread apart (the "V")
  shakeTime: 0.35,     // camera shake when you get hit (seconds)
  shakeAmount: 0.5,    // how far the camera jolts
};

export const AUDIO = {
  lakeVolume: 0.5,     // background lake sounds: lapping water, drips, birds, frogs (0 = off)
  effectsVolume: 1.0,  // multiplier for chimes and other effects
};

export const CAMERA = {
  height: 11,          // how high above the bobber the chase camera sits
  distance: 18,        // how far behind the bobber
  lookAhead: 22,       // the camera looks at a point this far in front of the bobber
  followSpeed: 4,      // higher = camera catches up faster (it never snaps)
  sideFollow: 0.35,    // how much the camera slides left/right with the bobber (0–1).
                       // Less than 1 means a still cursor points at a fixed spot on the
                       // water, so the bobber goes there and stops (instead of drifting forever).
};

export const SCENE = {
  fogNear: 60,
  fogFar: 300,
  cameraFov: 60,
  maxPixelRatio: 2,
  sunOffset: { x: 60, y: 120, z: 40 }, // sun position relative to the bobber
  sunIntensity: 2.2,
  hemiIntensity: 1.0,
  shadowMapSize: 2048,
};

export const COLORS = {
  sky: 0x9fd4f0,
  water: 0x2f8f9d,
  sand: 0xe6d3a3,
  wetSand: 0xb9a676,
  grass: 0x6dbb4f,
  grassDark: 0x4f9a3a,
  wood: 0x8b5a2b,
  woodDark: 0x5e3a1a,
  trunk: 0x6b4423,
  leaves: 0x2f7d32,
  leavesLight: 0x3f9142,
  rock: 0x8a8d91,
  reed: 0x5c8a3a,
  cattail: 0x5a3b1e,
  tackleBox: 0x2e7d32,
  rod: 0x333333,
  bobberTop: 0xe53935,
  bobberBottom: 0xffffff,
  bobberStick: 0xfbc02d,
  startLine: 0xffffff,
  flag: 0xff5252,
  buoy: 0xff7a1a,
  buoyActive: 0x43d36b,
  gateLine: 0xffd180,
  gateLineActive: 0x7dffa0,
  gateMissed: 0xff2a2a,
  finishRed: 0xe53935,
  finishWhite: 0xffffff,
  bass: 0x4f8a3c,
  bassBelly: 0xd8e6a0,
  pike: 0x6f8f6a,
  pikeFin: 0x8a6d3b,
  turtleShell: 0x3e5e2e,
  turtleSkin: 0x7a8c45,
  lureMetal: 0xffd54f,
  hookMetal: 0xc0c0c0,
  fishingLine: 0xeeeeee,
  log: 0x6d4c2f,
  logEnd: 0xc49a6c,
  lilyPad: 0x4caf50,
  lilyFlower: 0xf48fb1,
  whirlpool: 0x1a3d7c,
  frog: 0x5fa83a,
  frogBelly: 0xd9e8a6,
  bird: 0x2b4a7a,
  birdWing: 0x1d3357,
  birdBeak: 0xffb300,
  splash: 0xffffff,
  coin: 0xffc107,
  coinEdge: 0xffa000,
  goldenLure: 0xffe066,
  sparkle: 0xfff59d,
  wake: 0xffffff,
  confetti: [0xff7a1a, 0x43d36b, 0x42a5f5, 0xffeb3b, 0xe53935, 0xffffff],
  sun: 0xfff1d6,
  hemiSky: 0xcfeeff,
  hemiGround: 0x4a7a3a,
};
