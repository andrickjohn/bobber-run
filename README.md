# Bobber Run

*A fishing-themed 3D ball game by Eliott, built with [Claude Code](https://claude.com/claude-code) for a 10th grade tech project.*

Steer a fishing bobber across a lake, pass all 4 checkpoints, dodge fishing-themed
obstacles, grab coins, and reach the finish buoy on the far shore.

## How to play

| Control | What it does |
|---|---|
| **Mouse** | The bobber glides toward wherever you point on the water (no clicking needed) |
| **Arrow keys / W A S D** | Steer with the keyboard instead |
| **P** or **Esc** | Pause |
| **R** | Restart |
| **M** | Sound on/off |

- Go **between** the two orange buoys of each checkpoint, in order (1 → 4). Going around one costs points and you'll have to go back.
- Getting hit by a fish, turtle, lure or log costs a life. You go back to your last checkpoint and blink for a moment (safe).
- **Lily pads** slow you down and **whirlpools** (Hard only) pull you in, but neither costs a life.

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

The total is multiplied by the difficulty: Easy ×1, Normal ×1.5, Hard ×2.
Your best score for each difficulty is saved in the browser.

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
| `src/world.js` | Lake, waves, shoreline, dock, trees, start line and finish |
| `src/bobber.js` | The player: model, mouse/keyboard steering, bobbing |
| `src/checkpoints.js` | Checkpoint gates and progress tracking |
| `src/obstacles.js` | Every obstacle type and how it moves |
| `src/coins.js` | Coin spawning and pickup |
| `src/game.js` | Lives, score, timer, game states, collisions |
| `src/ui.js` | HUD and menus (HTML/CSS on top of the 3D view) |
| `src/settings.js` | Saving settings and best scores |
| `src/audio.js` | Generated sound effects and lake sounds |
| `src/effects.js` | Splashes, sparkles, confetti and the wake trail |
| `src/wildlife.js` | Frogs and birds on the shore |

## Built with Claude Code

This game was built step by step with Claude Code, Anthropic's AI coding assistant, following
the plan in `prompt.md`. Each phase was tested in the browser before moving on to the next.
