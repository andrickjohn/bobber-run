# Bobber Run — Claude Code Build Prompt

*A fishing-themed 3D ball game for Eliott's 10th grade tech project.*

## How to use this document

1. Make an empty folder (for example `bobber-run`) and put this file in it as `PROMPT.md`.
2. Open a terminal in that folder and start Claude Code (`claude`).
3. Type: **"Read PROMPT.md and build the game one phase at a time. After each phase, tell me how to test it and wait for me to say 'next'."**
4. Test each phase in the browser before moving on. If something looks wrong, describe what you see and let Claude fix it.

Building in phases is the point of the demo: it shows how you steer an AI coder step by step instead of hoping one giant request works.

---

## 1. What we're building

A browser game where the player steers a **fishing bobber** across a lake using the mouse. The bobber starts at the end of a **dock**, must pass a series of **checkpoints**, dodge **fishing-themed obstacles**, grab **coins** for points, and reach the **finish buoy** on the far shore.

- Simple, low-poly graphics built from basic 3D shapes (no downloaded models or images).
- A real 3D world with a camera that follows the bobber.
- Adjustable player speed, number of obstacles, and difficulty.
- Published on **Vercel** so it runs on any computer with a browser.

## 2. Tech stack (use exactly this)

- **Vite** (vanilla JavaScript template, not TypeScript, not React)
- **Three.js** (installed from npm)
- No physics engine. Write simple movement and collision math by hand so it's easy to read.
- No external images, models, or fonts. All shapes come from Three.js geometry (boxes, spheres, cylinders, cones, tori). Sounds, if any, are generated with the Web Audio API.
- Settings and high score saved in `localStorage` (wrap in try/catch).

## 3. Code rules

- Plain, readable code. A 10th grader should be able to open any file and follow it.
- Comment every file at the top explaining what it does, and comment any math (raycasting, collisions, steering).
- Put **every tunable number** (speeds, sizes, counts, point values, colors) in `src/config.js` so it can be tweaked live during the class demo.
- One job per file. Suggested structure:

```
index.html
src/
  main.js          // starts the game, runs the main loop
  config.js        // all tunable numbers and colors
  scene.js         // renderer, lights, camera, fog, sky
  world.js         // lake, dock, shore, trees, start line, finish buoy
  bobber.js        // the player: model, mouse steering, bobbing
  checkpoints.js   // checkpoint gates and progress tracking
  obstacles.js     // every obstacle type and its behavior
  coins.js         // random coin spawning and pickup
  game.js          // score, lives, timer, game states
  ui.js            // HUD, menus, settings screen (HTML/CSS overlay)
  audio.js         // simple generated sound effects
```

- Target smooth play (60 fps) on a school Chromebook: low-poly shapes, one shadow-casting light, cap `renderer.setPixelRatio` at 2.

## 4. The world

Layout runs in a straight line along the Z axis: **dock (start) → open lake → far shore (finish)**. Lake length about 400 units, width about 80 units.

- **Lake:** a large flat plane, blue-green color, with gentle animated waves (move vertices with a sine wave, or a simple shader). Light fog so the far shore fades in.
- **Dock:** wooden planks (brown boxes) on posts (cylinders) sticking out over the water. A small tackle box and a rod leaning on the railing for flavor.
- **Start line:** a painted white stripe across the end of the dock with a little flag.
- **Shoreline:** sand-colored strip and green grass along both sides and at the far end, with simple trees (cylinder trunk + cone top) and a few rocks. The shoreline is the boundary: the bobber can't leave the water.
- **Checkpoints:** 4 gates spaced evenly across the lake. Each gate is two orange buoys with a numbered flag and a faint glowing line between them. Passing between the buoys activates it (turns green, plays a chime).
- **Finish:** a big striped finish buoy / arch near the far shore with a checkered banner.
- **Sky and light:** light blue sky color, warm sun (directional light with shadows) plus soft hemisphere light.

## 5. The player (the bobber)

- Model: a sphere, red on top and white on the bottom, with a thin stick poking out the top.
- Floats on the water and bobs gently up and down with the waves.
- **Mouse control (ball rolls toward the cursor):**
  - Every frame, raycast from the mouse through the camera onto the water plane to find the target point.
  - Accelerate the bobber toward that point. Stronger pull when the cursor is farther away, up to a max speed.
  - Apply water drag so it glides and slows down naturally.
  - Small dead zone near the bobber so it doesn't jitter when the cursor is right on top of it.
  - No clicking needed to move. Moving the mouse is the whole control.
- Leaves a small white wake trail behind it when moving fast.
- Clamped to the lake bounds (bumps softly off the shoreline).

**Camera:** third-person chase cam behind and above the bobber, looking toward the finish. It follows smoothly (lerp), never snaps.

## 6. Obstacles (fishing themed)

Obstacles try to stop the player. Each type has its own simple behavior. Spread them across the lake between the start and the finish, never within a few units of the start line or a checkpoint's center.

| Obstacle | Look (basic shapes) | Behavior |
|---|---|---|
| **Jumping Bass** | green fish body (stretched sphere) + tail fin | Leaps out of the water in an arc across the path, splashes back in, repeats on a timer |
| **Patrolling Pike** | long thin gray-green fish | Swims back and forth in a straight line across the lake |
| **Snapping Turtle** | dome shell + small head | Slowly chases the bobber if it gets within a set radius, gives up if the bobber escapes |
| **Swinging Lure** | hook + shiny lure hanging from a fishing line that comes down from above | Swings like a pendulum across a gap |
| **Drifting Log** | brown cylinder on its side | Floats slowly across the lake and wraps around when it reaches a shore |
| **Lily Pad Patch** | flat green circles | **Not deadly.** Slows the bobber down while inside it |
| **Whirlpool** (Hard only) | spinning dark-blue ring | **Not deadly by itself.** Pulls the bobber toward its center, where a pike may be waiting |

Collision detection: treat everything as circles on the flat X/Z plane (distance check). For the jumping bass, only count a hit while the fish is near water level or crossing the bobber's height.

## 7. Lives, hits, and checkpoints

- Player starts with **3 lives** (shown as small bobber icons).
- Getting hit by a deadly obstacle: splash effect, sound, lose one life, then **respawn at the last activated checkpoint** (or the dock if none yet).
- After respawning, the bobber blinks and is **invincible for 2 seconds**.
- At 0 lives: **Game Over** screen.
- Checkpoints only count once and only in forward order.

## 8. Coins

- Gold spinning coins (flat cylinders) that hover just above the water and bob.
- Spawn at random positions on the lake at random intervals. Max on screen at once and lifetime both set in `config.js`. They fade out before disappearing.
- Touching one: +10 points, sparkle burst, "ding" sound.
- Rare **Golden Lure** pickup (about 1 in 15 spawns): +50 points.
- Coins never spawn inside an obstacle or outside the lake.

## 9. Scoring

| Event | Points |
|---|---|
| Coin | +10 |
| Golden Lure | +50 |
| Passing a checkpoint (first time) | +100 |
| Reaching the finish | +500 |
| Time bonus at finish | faster = more (e.g. max(0, 300 − seconds) × 2) |
| Lives remaining at finish | +100 each |

Final score is multiplied by difficulty: Easy ×1, Normal ×1.5, Hard ×2. Save the best score per difficulty.

## 10. Settings (adjustable)

A settings screen reachable from the title screen and the pause menu:

- **Bobber Speed:** slider 1–10 (default 5). Changes the bobber's max speed and acceleration.
- **Number of Obstacles:** slider 5–40 (default 15).
- **Difficulty:** Easy / Normal / Hard.
  - **Easy:** obstacles move slowly, turtles have a small chase radius, more coins, 5 lives.
  - **Normal:** default values, 3 lives.
  - **Hard:** faster obstacles, bigger chase radius, fewer coins, whirlpools appear, 3 lives, shorter invincibility.

Settings are saved and remembered next time.

## 11. Screens and HUD

- **Title screen:** game name "Bobber Run", Play, Settings, best scores, and a one-line "how to play."
- **HUD during play:** score (top left), lives (top right), checkpoint count "2 / 4", timer, and a thin progress bar showing dock → finish.
- **Pause:** press `P` or `Esc`. Resume, Settings, Quit to Title.
- **Game Over:** final score, checkpoints reached, Play Again.
- **Victory:** score breakdown (coins, checkpoints, time bonus, lives bonus, difficulty multiplier), "New best!" if it is one, Play Again.
- Menus are HTML/CSS overlays on top of the 3D canvas. Simple, friendly, readable font, lake colors.

## 12. Build phases

Stop after each phase, explain how to test it, and wait for "next".

1. **Setup + world:** Vite + Three.js project, `npm run dev` works. Lake with waves, dock, shore, trees, sky, lights, fog. Fixed camera looking down the lake.
   *Test:* the scene loads and the water moves.
2. **Bobber + controls:** bobber floats and bobs, follows the mouse, stays inside the lake, chase camera works.
   *Test:* steering feels smooth, no jitter, can't leave the water.
3. **Course:** start line, 4 checkpoints, finish buoy. Checkpoints light up when passed. Reaching the finish shows a simple "You win" message.
   *Test:* drive the whole course start to finish.
4. **Obstacles:** all obstacle types with their behaviors, placed using the obstacle count from `config.js`.
   *Test:* each type moves the way the table describes.
5. **Lives + respawn:** collisions, lose a life, respawn at last checkpoint, invincibility blink, Game Over.
   *Test:* get hit on purpose and confirm respawn location and lives count.
6. **Coins + scoring + HUD:** coin spawning, pickups, all point values, timer, progress bar.
   *Test:* the score adds up correctly for a full run.
7. **Menus + settings + difficulty:** title, settings, pause, game over, victory screens; sliders and difficulty actually change the game; settings and best scores saved.
   *Test:* Easy and Hard feel clearly different; settings survive a page refresh.
8. **Polish:** splash and sparkle effects, wake trail, generated sounds with a mute button, final tuning so a first-time player can finish on Easy in about 2 minutes.
9. **Deploy to Vercel:** see section 13.

## 13. Deploying to Vercel

Vercel auto-detects Vite projects (build command `npm run build`, output folder `dist`). Either route works:

- **GitHub route (recommended for a class project):** create a GitHub repo, push the code, then in Vercel choose "Add New → Project," import the repo, and click Deploy. Every future push redeploys automatically.
- **Command line route:** run `npx vercel` in the project folder, log in, accept the defaults, then `npx vercel --prod` for the live link.

Before deploying, run `npm run build` and `npm run preview` to confirm the production build works. Add a short `README.md` explaining the game, the controls, and that it was built with Claude Code.

## 14. Final test checklist

- [ ] Loads on Chrome, Edge, Safari, and a Chromebook from the Vercel link
- [ ] Bobber follows the mouse smoothly and can't leave the lake
- [ ] All 4 checkpoints activate in order and award points once
- [ ] Every obstacle type behaves as described; lily pads and whirlpools don't cost lives
- [ ] Hits cost a life and respawn at the right checkpoint with invincibility
- [ ] Coins spawn randomly, never inside obstacles, and award the right points
- [ ] Speed, obstacle count, and difficulty settings all change the game and are remembered
- [ ] Game Over and Victory screens show the correct score breakdown
- [ ] Pause works with P and Esc
- [ ] No errors in the browser console

## 15. Stretch goals (only if there's time)

- Touch controls so it works on phones and tablets
- Multiple lake layouts (a level 2 with a narrow river section)
- Day/sunset/night themes
- A "catch" mini-bonus: hold still near a ripple for 2 seconds to reel in a bonus fish
- Online leaderboard
