# Bobber Run

*A fishing-themed 3D ball game by Eliott, built with [Claude Code](https://claude.com/claude-code) for a 10th grade tech project.*

Steer a fishing bobber across a lake, pass all 4 checkpoints, dodge (or zap!) fishing-themed
obstacles, grab coins, and fly into the swirling portal at the end. The portal shows your
score, then blasts you through hyperspace to the next world: **Space Lakes**, where lakes
float on islands among the stars, and then **Lava Lagoon**, where cool pools sit on volcanic
rock above a sea of lava. You have to fly from one lake to the next.

Plays on computers, tablets and phones.

## How to play

| Computer | Phone / tablet | What it does |
|---|---|---|
| **Mouse** (just move it) | **Drag your finger** | The bobber glides toward where you point |
| **Arrow keys / W A S D** | | Steer with the keyboard instead |
| Hold **Space** or the **left mouse button** | Hold **FLY** | Fly up, hover, then glide down when you let go |
| **F** or **right-click** | Tap **ZAP** | Fire a zap at what you're aiming at |
| **P** or **Esc** | ⏸ button | Pause |
| **R** | ↻ button | Restart the level |
| **M** | Sound button | Sound on/off |

- Go **between** the two buoys of each checkpoint, in order (1 → 4). Going around one costs points and you'll have to go back.
- Getting hit by a fish, turtle, lure or log costs a life. You go back to your last checkpoint and blink for a moment (safe).
- **Flying** uses energy (the ⚡ bar), which recharges while you float on the water. Fly over obstacles, grab coins floating in the sky, and cross the gaps between space lakes. Fall into a gap and you lose a life!
- **Zaps** (the 🎯 dots) knock obstacles out for points. They reload slowly; grab **⚡ Zap Packs** (+3) and pass checkpoints (+2) to earn more.
- **Lily pads** slow you down and **whirlpools** (Hard only) pull you in, but neither costs a life (and you can fly right over them).

### Worlds

| World | What's special |
|---|---|
| 1. Home Lake | A curvy lake with beaches, trees, frogs and birds, starting from a wooden dock |
| 2. Space Lakes | Four lakes on floating islands among the stars. Fly across the gaps between them |
| 3. Lava Lagoon | Five narrow, twisty pools on volcanic islands. Fall in a gap and it's into the lava! |

Your lives and score carry from one world to the next. After each portal, the score screen
counts down and then jumps to hyperspace automatically (or press **Warp now**). You can also
jump straight to a world from the title screen.

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
| Coin | +10 |
| Golden Lure (rare) | +50 |
| Checkpoint | +100 |
| Missed checkpoint | −25 |
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
| `src/scene.js` | Renderer, camera, lights, sky and fog |
| `src/world.js` | The scenery for each world: lakes, waves, islands, dock, trees, stars, portal |
| `src/bobber.js` | The player: model, mouse/finger/keyboard steering, flying, bobbing |
| `src/shooting.js` | The zapper: firing zaps and what they hit |
| `src/hyperspace.js` | The star-streak hyperspace effect between worlds |
| `src/device.js` | Detects phones/tablets (for touch buttons and lighter graphics) |
| `src/checkpoints.js` | Checkpoint gates and progress tracking |
| `src/obstacles.js` | Every obstacle type and how it moves |
| `src/coins.js` | Coins, Golden Lures and Zap Packs |
| `src/game.js` | Lives, score, timer, game states, runs through the worlds, collisions |
| `src/ui.js` | HUD and menus (HTML/CSS on top of the 3D view) |
| `src/settings.js` | Saving settings and best scores |
| `src/audio.js` | Generated sound effects, lake sounds, space hum and lava rumble |
| `src/effects.js` | Splashes, sparkles, confetti and the wake trail |
| `src/wildlife.js` | Frogs and birds on the shore |

## Built with Claude Code

This game was built step by step with Claude Code, Anthropic's AI coding assistant, following
the plan in `prompt.md` (phases 1–9), then extended with flying, zapping, portals, Space Lakes
and touch controls (phases 10–14). Each phase was tested in the browser before moving on.

To add a new world, add an entry to `LEVELS` (and maybe a new look in `THEMES`) in
`src/config.js`.
