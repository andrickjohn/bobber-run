# Bobber Run

*A fishing-themed 3D ball game by Eliott, built with [Claude Code](https://claude.com/claude-code) for a 10th grade tech project.*

Steer a fishing bobber down a lake, scoop up trails of coins to build huge combos, float
through glowing ring gates, jump over (or zap!) fishing-themed obstacles, and ride into the
swirling portal at the end (it bursts open when you've gone far enough). Catch colorful fish
and stack them in your cooler: three of a color pop! The portal shows your
score, then blasts you through hyperspace to the next world: **Space Lakes**, where lakes
float on islands among the stars above a swirling black hole, then **Lava Lagoon**, where cool
pools sit on volcanic rock above a sea of lava, and finally **Aurora Fjord**, a snowy, slippery
lake under the northern lights. In the island worlds the bobber leaps from one lake to the next.

Plays on computers, tablets and phones.

## How to play

| Computer | Phone / tablet | What it does |
|---|---|---|
| **Mouse** (point left or right) | **Drag your finger** | The bobber cruises forward by itself; it slides over to line up with where you point |
| **← → / A D** | | Steer left and right with the keyboard instead |
| **↑ / W** and **↓ / S** | | Speed boost and brake |
| **Space** or **left-click** | Tap **JUMP** | A quick hop over a log or a fish |
| **F** or **right-click** | Tap **ZAP** | Fire a zap at what you're aiming at |
| **P** or **Esc** | ⏸ button | Pause |
| **R** | ↻ button | Restart the level |
| **M** | Sound button | Sound on/off |

- **It's like a runner game:** the bobber always cruises forward on the water. You steer left and right, and jump over things in your way.
- **Coins come in trails** that run straight down the course: straight lines, smooth lane changes, and gentle curves. Some line up right through a ring gate, and over the gaps between lakes they follow the arc of your big leap. Coins close to you fly to you by themselves, so if you're lined up you'll get them. Grab **every coin in a trail** for a **PERFECT TRAIL** bonus! Each coin also gives you a little burst of speed. Every coin in a row builds your 🔥 **combo**: every 5 in a row raises the multiplier (×2, ×3 … ×10), and each coin's "ding" is a little higher than the last. Wait too long between coins, or get hit, and the combo breaks.
- **Catch & stack:** colorful little fish swim in schools; bump into them (or zap them, or zap a bass or pike) to **catch** them. Caught fish drop into the **cooler** on the side of the screen. **Three of a color in a row** (up/down or across) **pop** for big points, and fish falling into the gaps can set off **chains**. Fill the cooler with nothing to pop and it overflows: you lose your combo!
- **Ring gates** are optional glowing gold hoops on the water. Go through one for points (times your combo), a combo boost and a free zap.
- Getting hit by a fish, turtle, lure or log costs a life and your combo. You come back a little behind where it happened and blink for a moment (safe).
- **Jump** to hop over logs and fish, then you're straight back down scooping coins. In worlds with gaps between the lakes (Space Lakes, Lava Lagoon), the bobber takes a **BIG LEAP** across by itself when it reaches the end of a lake. The open portal pulls you toward its middle, so you can't miss it.
- **Zaps** (the 🎯 dots) knock obstacles out for points. They reload slowly; grab **⚡ Zap Packs** (+3) and go through ring gates (+1) to earn more.
- **Lily pads** slow you down and **whirlpools** (Hard only) pull you in, but neither costs a life (and you can jump right over them).

### Worlds

| World | What's special |
|---|---|
| 1. Home Lake | A curvy lake with beaches, pine forests, snowy mountains, frogs and birds, starting from a wooden dock |
| 2. Space Lakes | Four lakes on floating islands among the stars, above a swirling black hole. Leap from island to island! |
| 3. Lava Lagoon | Five narrow, twisty pools on volcanic islands above a sea of lava |
| 4. Aurora Fjord | The curviest lake yet, at night under the northern lights. The water is icy and slippery: the bobber slides much farther, so steer early! |

Every world starts with a **3, 2, 1, GO!** countdown while the camera swoops down from the sky.
Your lives and score carry from one world to the next. Ride into a portal and you go straight
into hyperspace, no stopping: you dive in and zoom through a glowing, spinning tunnel while a
little card shows your stars and points, then you burst out into the next world and GO!
Press **Scores** on the card to stop and see the full breakdown. You can also jump straight
to a world from the title screen.

### Stars

Each world has 3 stars to earn: ★ reach the portal, ★ get a 20+ combo, ★ don't lose a life.
Your best stars for each world are saved and shown on the title screen.

The first time something new comes up (steering, combos, catching fish, the cooler, ring
gates, jumping, zapping, the portal), a little tip card explains it. Each tip only
ever shows once.

### Obstacles

| Obstacle | What it does |
|---|---|
| Jumping Bass | Leaps across your path. You can slip under it at the top of its jump |
| Patrolling Pike | Swims back and forth across the lake |
| Snapping Turtle | Chases you if you get close, gives up if you escape |
| Swinging Lure | Swings like a pendulum on a fishing line |
| Drifting Log | Floats slowly across the lake |
| Lily Pad Patch | Slows you down (not deadly) |
| Whirlpool | Pulls you toward its center, where a pike may be waiting (not deadly by itself) |

### Scoring

| Event | Points |
|---|---|
| Coin | +10 × combo multiplier |
| Perfect trail (every coin in a trail) | +100 × combo multiplier |
| Golden Lure (ends some trails) | +50 × combo multiplier |
| Ring gate | +50 × combo multiplier |
| Each fish popped in the cooler | +30 × chain number × combo multiplier |
| Finish | +500 |
| Time bonus | max(0, 300 − seconds) × 2 |
| Each life left at the finish | +100 |
| Zapping an obstacle | +25 |

Each world's score is multiplied by the difficulty (Easy ×1, Normal ×1.5, Hard ×2) and added
to your run total. Your best run for each difficulty is saved in the browser.

### Settings

Bobber Speed (1–10), Number of Obstacles (5–40), and Difficulty (Easy / Normal / Hard).
Settings are remembered next time.

## Running it yourself

You need [Node.js](https://nodejs.org) (version 20 or newer).

```bash
npm install
npm run dev
```

Then open the link it prints (usually http://localhost:5173).

To try it on a phone on the same Wi-Fi, run `npm run dev -- --host` and open the
**Network** address it prints on the phone.

To make the production version (what gets published):

```bash
npm run build
npm run preview
```

## How the code is organized

Everything is plain JavaScript with [Three.js](https://threejs.org) for the 3D graphics and
[Vite](https://vitejs.dev) to run and build it. No downloaded models, images, fonts or sound
files: every shape is built from simple 3D geometry, and every sound is generated with the Web
Audio API.

| File | What it does |
|---|---|
| `src/config.js` | **Every tunable number and color.** Change things here to tweak the game |
| `src/main.js` | Starts the game, switches between screens, runs the main loop |
| `src/scene.js` | Renderer, camera, lights, the gradient sky dome, sky reflections and fog |
| `src/world.js` | The scenery for each world: lakes, waves, islands, mountains, dock, trees, stars, portal |
| `src/bobber.js` | The player: model, mouse/finger/keyboard steering, jumping, the big leap, bobbing |
| `src/shooting.js` | The zapper: firing zaps and what they hit |
| `src/hyperspace.js` | The hyperspace effect between worlds: star streaks and the spinning tunnel |
| `src/blackhole.js` | The black hole under Space Lakes and the spiral fall into it |
| `src/device.js` | Detects phones/tablets (for touch buttons and lighter graphics) |
| `src/course.js` | Ring gates, the finish portal, and where you respawn |
| `src/combo.js` | The combo counter and multiplier |
| `src/catchfish.js` | The schools of colorful fish you can catch |
| `src/cooler.js` | The cooler puzzle: stacking, matching, chains and overflow |
| `src/fishart.js` | Draws the flat 2D fish, bobbers and lures (title toy and cooler) |
| `src/style.js` | Thin outlines (and optional toon shading, `STYLE.toon`) |
| `src/tacklebox.js` | The Tackle Box Drop fish-merging toy on the title screen |
| `src/obstacles.js` | Every obstacle type and how it moves |
| `src/coins.js` | Coin trails, Golden Lures and Zap Packs |
| `src/game.js` | Lives, score, timer, game states, runs through the worlds, collisions |
| `src/ui.js` | HUD panels, menus, countdown, tips and the warp score card (HTML on top of the 3D view) |
| `src/style.css` | How the HUD and menus look: one set of colors, outlines and fonts used everywhere |
| `src/settings.js` | Saving settings, best scores, stars and which tips you've seen |
| `src/audio.js` | Generated sound effects and each world's background sounds |
| `src/effects.js` | Splashes, sparkles, confetti and the wake trail |
| `src/wildlife.js` | Frogs and birds on the shore |

## Built with Claude Code

This game was built step by step with Claude Code, Anthropic's AI coding assistant, following
the plan in `prompt.md` (phases 1–9), then extended with flying, zapping, portals, Space Lakes
and touch controls (phases 10–14), then a playable title screen and combo-based scoring
(phases 15–16). Each phase was tested in the browser before moving on.

To add a new world, add an entry to `LEVELS` (and maybe a new look in `THEMES`) in
`src/config.js`.
