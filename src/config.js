// config.js
// Every tunable number and color in the game lives here.
// Change a value, save the file, and the browser reloads with the new value.
//
// Coordinate system used everywhere:
//   X = left / right across the lake
//   Y = up / down
//   Z = along the lake. The start line is at Z = 0 and each level's finish portal is at
//       its finishZ (about -400). The course runs toward negative Z, "into the screen".

export const LAKE = {
  // (Where each lake starts and ends is set per level, in LEVELS below.)
  width: 80,          // average distance from left shore to right shore
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
  islandRim: 10,     // space islands: width of the grassy rim around the beach
  crystalCount: 40,  // space islands: glowing crystals on the rims (across all islands)
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

export const FLY = {
  hoverHeight: 6,      // holding Fly climbs to this height and hovers there
  climbSpeed: 9,       // how fast it climbs (units per second)
  gravity: 9,          // how fast it falls/glides back down when you let go
  energyDrain: 0.22,   // energy used per second of flying (1 = full bar, so about 4.5 s)
  energyRecharge: 0.35, // energy gained per second while floating on the water
  minEnergyToFly: 0.15, // need at least this much energy to take off again
  landSplashSpeed: 5,  // landing faster than this makes a splash
};

export const SHOOT = {
  speed: 45,           // how fast zaps fly (units per second)
  life: 1.8,           // seconds before a zap fizzles out (1.8 s × 45 speed = about 80 units)
  cooldown: 0.25,      // seconds between shots while holding the button
  maxAmmo: 6,          // the automatic reload fills you up to this many zaps
  reloadTime: 2.5,     // seconds to get one zap back
  maxCarry: 12,        // with Zap Packs and ring gates you can carry up to this many
  packAmount: 3,       // zaps in a Zap Pack pickup
  // (Ring gates also give free zaps: see RINGS.zaps.)
  radius: 0.35,        // size of a zap (for hitting things)
  aimAhead: 15,        // without a mouse target, aim at the water this far ahead
};

export const COURSE = {
  startFlagX: -6,      // where the little flag on the start line stands
};

// Ring gates: optional glowing hoops along the course. Fly or float through one for
// points, a combo boost and a free zap.
export const RINGS = {
  spacing: 55,         // about this far apart along the course
  radius: 3.4,         // size of the hoop (the hole you go through)
  airChance: 0.4,      // chance a ring floats up high (you have to FLY through it)
  points: 50,          // points for going through (times your combo multiplier)
  comboBoost: 3,       // counts as this many coins for your combo
  zaps: 1,             // free zaps for going through
};

// Catch & stack: colorful fish you catch drop into the cooler on the side of the screen
// (a small grid). Three of the same color in a row (up/down or across) pop, and fish
// falling into the gaps can make more pops: a chain! Fill it with nothing to pop and it
// overflows: you lose your combo.
export const CATCH = {
  colors: ['#ff5a5f', '#4dabf7', '#69db7c', '#ffd43b'], // red, blue, green, yellow
  coolerColumns: 3,    // the cooler is 3 fish wide...
  coolerRows: 5,       // ...and 5 fish tall
  popComboBoost: 2,    // a pop also adds this much to your combo
  schoolSpacing: 60,   // a little school of catchable fish about this often along the course
  schoolSize: 3,       // fish in each school
  sameColorChance: 0.5, // chance a fish matches the one before it in its school
  catchRadius: 2.2,    // how close you have to bump a fish to catch it
};

// The combo: grab coins one after another without getting hit or waiting too long.
export const COMBO = {
  perStep: 5,          // every 5 in a row raises the multiplier by 1 (×2, ×3, ...)
  maxMultiplier: 10,
  window: 2.6,         // seconds you have to grab the next coin before the combo breaks
                       // (difficulty changes this)
  milestones: { 10: 'NICE!', 25: 'GREAT!', 50: 'AWESOME!', 100: 'LEGENDARY!' },
};

// The swirling portal at the end of every level
export const PORTAL = {
  radius: 9,           // size of the ring
  tube: 0.9,           // thickness of the ring
  centerHeight: 6,     // how high the middle of the ring is above the water
  spinSpeed: 1.6,      // how fast the swirl spins
  openAt: 0.7,         // the portal opens once you're this far along the course (0.7 = 70%)
};

// The "Tackle Box Drop" toy on the title screen
export const TACKLE_BOX = {
  gravity: 2.4,        // how fast fish fall (in box-heights per second, per second)
  dropCooldown: 0.45,  // seconds between drops
  mergePoints: 2,      // points for merging two minnows (each bigger fish doubles it)
  overflowSeconds: 2.5, // fish above the line this long = the box shakes empty
};

// The black hole below Space Lakes (fall into a gap and it swallows you!)
export const BLACK_HOLE = {
  x: 0,                // where it is: under the middle of the course, far below
  y: -230,
  z: -220,
  coreRadius: 22,      // the black ball in the middle
  diskRadius: 150,     // the glowing swirl around it
  fallTime: 3.8,       // seconds of spiraling in before you lose the life
  turns: 3,            // how many times you circle the hole on the way down
  junkCount: 40,       // pieces of space junk swirling in with you
};

// The hyperspace jump between worlds
export const HYPERSPACE = {
  countdown: 5,        // seconds the score screen shows before warping automatically
  diveTime: 1.6,       // seconds diving into the portal, speeding up
  arriveTime: 1.4,     // seconds slowing down in the new world
  fovBoost: 50,        // how much wider the view stretches at top speed (degrees)
};

// ---------------------------------------------------------------------------
// Levels ("scenes"). Finish one and its portal takes you to the next.
// Each level is made of one or more lakes, listed from the start (near) to the finish (far).
//   start / end   – where the lake begins and ends along Z
//   bend / widthWiggle – how curvy the lake is
//   width         – (optional) how wide the lakes are; LAKE.width if left out
//   drag          – (optional) water drag; lower = more slippery (BOBBER.drag if left out)
// Gaps between lakes have no water: you have to FLY across. Fall in and you lose a life!
// ---------------------------------------------------------------------------
export const LEVELS = [
  {
    name: 'Home Lake',
    theme: 'lake',
    lakes: [{ start: 40, end: -430 }],
    finishZ: -400,
    bend: 12,
    widthWiggle: 12,
  },
  {
    name: 'Space Lakes',
    theme: 'space',
    lakes: [
      { start: 25, end: -90 },
      { start: -130, end: -210 },
      { start: -250, end: -320 },
      { start: -360, end: -445 },
    ],
    finishZ: -420,
    bend: 6,
    widthWiggle: 8,
  },
  {
    name: 'Lava Lagoon',
    theme: 'lava',
    lakes: [
      { start: 25, end: -65 },
      { start: -105, end: -165 },
      { start: -205, end: -260 },
      { start: -300, end: -355 },
      { start: -395, end: -455 },
    ],
    finishZ: -430,
    width: 62,      // narrower pools, so steering matters more
    bend: 14,
    widthWiggle: 6,
  },
  {
    name: 'Aurora Fjord',
    theme: 'ice',
    lakes: [{ start: 40, end: -430 }],
    finishZ: -400,
    bend: 18,       // the curviest lake yet
    widthWiggle: 14,
    drag: 0.6,      // icy, slippery water: the bobber slides much farther (normal is BOBBER.drag)
  },
];

// How each kind of level looks. Lake = sunny day on Earth, space = floating islands
// among the stars.
export const THEMES = {
  lake: {
    sky: 0x8fd8ff,
    fog: 0x9fdcff,
    fogNear: 60,
    fogFar: 300,
    sun: 0xfff1d6,
    sunIntensity: 2.2,
    hemiSky: 0xcfeeff,
    hemiGround: 0x4a7a3a,
    hemiIntensity: 1.0,
    water: 0x1fb5c9,   // bright candy turquoise
    wetSand: 0xd8b878,
    sand: 0xffe2a8,
    grass: 0x7fdc5a,
    grassDark: 0x56c23d,
    portal: 0xff7a1a,
    portalGlow: 0xffd180,
    wildlife: true,    // frogs and birds
    islands: false,    // the lake sits in hills, not floating in space
    fallMessage: 'Splash!',
  },
  space: {
    sky: 0x05030f,
    fog: 0x120a2a,
    fogNear: 90,
    fogFar: 360,
    sun: 0xd6dcff,
    sunIntensity: 1.9,
    hemiSky: 0x9a8cff,
    hemiGround: 0x1a1033,
    hemiIntensity: 1.1,
    water: 0x2a46a0,
    wetSand: 0x4a3a6a,
    sand: 0xa898d4,
    grass: 0x5b3f9e,
    grassDark: 0x3a2470,
    rock: 0x3f3357,
    crystals: [0x7df9ff, 0xff6bd6, 0xb388ff],
    portal: 0xb388ff,
    portalGlow: 0x7df9ff,
    wildlife: false,
    islands: true,     // each lake is a floating island with rock underneath
    decor: 'space',    // stars, planets and drifting rocks
    fallMessage: 'Lost in space!',
  },
  lava: {
    sky: 0x1a0603,
    fog: 0x3d1208,
    fogNear: 70,
    fogFar: 300,
    sun: 0xffb27a,
    sunIntensity: 1.7,
    hemiSky: 0xff7a3a,
    hemiGround: 0x220500,
    hemiIntensity: 1.0,
    water: 0x1f9e9a,   // cool blue-green pools (the only safe spots!)
    wetSand: 0x3a2a24,
    sand: 0x5e4c45,    // ash
    grass: 0x2e2422,   // dark volcanic rock
    grassDark: 0x1c1513,
    rock: 0x2a1f1c,
    crystals: [0xff5a1a, 0xffae00, 0xff2a00], // glowing hot rocks
    portal: 0xff3d00,
    portalGlow: 0xffd54f,
    lava: 0xff4a00,    // the lava sea far below the islands
    undersideGlow: 0x5a1400, // the islands' rocky bottoms glow red from the lava
    wildlife: false,
    islands: true,
    decor: 'lava',     // lava sea, volcanoes and rising embers
    fallMessage: 'Into the lava!',
  },
  ice: {
    sky: 0x07102a,
    fog: 0x16264a,
    fogNear: 70,
    fogFar: 320,
    sun: 0xbcd4ff,     // cool moonlight
    sunIntensity: 1.4,
    hemiSky: 0x8fb6ff,
    hemiGround: 0x2a3550,
    hemiIntensity: 1.2,
    water: 0x1d4f7a,   // deep, icy blue
    wetSand: 0x6b7f8f,
    sand: 0xdde7f0,    // snowy shore
    grass: 0xf2f6fb,   // snow
    grassDark: 0xc4d3e6, // snow in blue shadow
    rock: 0x7d8a99,
    portal: 0x4dffb5,
    portalGlow: 0xc2a8ff,
    wildlife: false,
    islands: false,
    reeds: false,      // too cold for cattails
    snowyTrees: true,  // pines with snow on top
    decor: 'aurora',   // northern lights, stars, moon and falling snow
    fallMessage: 'Splash!',
  },
};

export const OBSTACLES = {
  count: 15,             // the "Number of Obstacles" slider (5–40)
  speedMultiplier: 1,    // all obstacles move this many times faster (difficulty changes it)
  includeWhirlpools: false, // whirlpools only appear on Hard (set by DIFFICULTY below)
  startSafeZone: 30,     // no obstacles closer than this to the start line
  ringSafeRadius: 10,  // no obstacles placed this close to a ring gate
  finishSafeZone: 15,    // no obstacles this close to the finish

  bass: {
    radius: 1.0,         // hit circle size
    jumpDistance: 12,    // how far sideways each leap goes
    jumpHeight: 5,
    jumpTime: 1.3,       // seconds in the air
    waitMin: 1.0,        // seconds under water between leaps
    waitMax: 2.5,
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
  // Coins come in trails: lines, waves, zigzags, circles and spirals into the sky.
  aheadDistance: 110,  // trails are laid out this far ahead of the bobber
  gapMin: 14,          // empty water between one trail and the next (difficulty changes these)
  gapMax: 26,
  spacing: 3.6,        // distance between coins in a trail
  pickupRadius: 1.0,   // coin size for touching
  hoverHeight: 0.9,    // how high above the water coins float
  skyHeight: 6,        // height of coins in the sky (flying height)
  goldenChance: 1 / 6, // chance a trail ends with a Golden Lure
  zapPackChance: 1 / 5, // chance a Zap Pack floats between two trails
};

export const SCORING = {
  coin: 10,            // (times your combo multiplier)
  goldenLure: 50,      // (times your combo multiplier)
  finish: 500,
  timeBonusSeconds: 300, // time bonus = max(0, timeBonusSeconds − your time) × timeBonusPerSecond
  timeBonusPerSecond: 2,
  perLifeLeft: 100,
  zap: 25,               // zapping an obstacle
  coolerPop: 30,         // each fish popped in the cooler (times the chain and your combo)
  // (Ring gates are worth RINGS.points, times your combo multiplier.)
  difficulty: 'normal',  // 'easy', 'normal' or 'hard' (default; the settings screen changes it)
  multiplier: { easy: 1, normal: 1.5, hard: 2 },
};

// What each difficulty changes. When a game starts, settings.js copies the chosen
// column into the values above (OBSTACLES, COINS, COMBO, GAME), and the game reads those.
export const DIFFICULTY = {
  easy: {
    label: 'Easy',
    description: 'Slow fish, lazy turtles, lots of coins, 5 lives.',
    lives: 5,
    invincibleTime: 2.5,
    obstacleSpeed: 0.65,    // obstacles move at 65% speed
    turtleChaseRadius: 8,
    turtleGiveUpRadius: 14,
    coinGapMin: 8,          // trails close together
    coinGapMax: 16,
    comboWindow: 3.6,       // lots of time to reach the next coin
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
    coinGapMin: 14,
    coinGapMax: 26,
    comboWindow: 2.6,
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
    coinGapMin: 22,         // trails far apart
    coinGapMax: 38,
    comboWindow: 1.9,       // keep moving or lose the combo!
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

// The cartoon look (see style.js)
export const STYLE = {
  outlineColor: 0x1b1b2f,  // dark navy outlines (softer than pure black)
  outlineThickness: 0.08,  // outlines are this much bigger than the shape (8%)
};

export const SCENE = {
  cameraFov: 60,
  portraitFov: 78,     // wider view when the screen is taller than it is wide (phone held upright)
  maxPixelRatio: 2,
  sunOffset: { x: 60, y: 120, z: 40 }, // sun position relative to the bobber
  shadowMapSize: 2048,
  // (Sky, fog and light colors are in THEMES, because each level looks different.)
};

// Phones and tablets: draw a bit less detail so the game stays smooth.
export const MOBILE = {
  maxPixelRatio: 1.5,
  shadowMapSize: 1024,
  waterCellSize: 4.5,  // bigger squares = fewer points to animate every frame
  terrainCellSize: 3.5,
};

export const COLORS = {
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
  bassBelly: 0xd8e6a0,
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
  zap: 0x7df9ff,
  ringWater: 0xffc107, // gold hoops on the water
  ringSky: 0xd16bff,   // purple hoops up in the sky
  zapPack: 0x00e5ff,
  zapGlow: 0x00b8d4,
  confetti: [0xff7a1a, 0x43d36b, 0x42a5f5, 0xffeb3b, 0xe53935, 0xffffff],
};
