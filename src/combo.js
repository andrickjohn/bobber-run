// combo.js
// The combo: grab coins (and fly through rings) one after another to build it up.
//   - Every COMBO.perStep in a row raises the multiplier: ×2, ×3 ... up to ×10.
//   - Each grab refills the combo timer. If it runs out before your next grab, or you
//     get hit, the combo breaks and the multiplier drops back to ×1.
// Coin and ring points are multiplied by the multiplier, so long combos are worth a LOT.

import { COMBO } from './config.js';

export function createCombo() {
  const combo = {
    count: 0,       // how many in a row right now
    timer: 0,       // seconds left before the combo breaks
    best: 0,        // the longest combo this level

    get multiplier() {
      return Math.min(COMBO.maxMultiplier, 1 + Math.floor(combo.count / COMBO.perStep));
    },

    // How full the timer is (1 = just grabbed something, 0 = about to break).
    get timerFraction() {
      return combo.count > 0 ? combo.timer / COMBO.window : 0;
    },

    // Add to the combo. Returns what happened, so the game can show and play it:
    //   multiplierUp – the multiplier just went up
    //   milestone    – a word like "NICE!" if we just reached a milestone (10, 25, 50...)
    add(amount = 1) {
      const before = combo.multiplier;
      const result = { multiplierUp: false, milestone: null };
      for (let i = 0; i < amount; i++) {
        combo.count++;
        if (COMBO.milestones[combo.count]) result.milestone = COMBO.milestones[combo.count];
      }
      combo.best = Math.max(combo.best, combo.count);
      combo.timer = COMBO.window;
      result.multiplierUp = combo.multiplier > before;
      return result;
    },

    // Called every frame. On the frame the combo runs out of time, returns how big it
    // was (so a big lost combo can play a sad sound). Otherwise returns 0.
    update(dt) {
      if (combo.count === 0) return 0;
      combo.timer -= dt;
      if (combo.timer <= 0) {
        const lost = combo.count;
        combo.count = 0;
        combo.timer = 0;
        return lost;
      }
      return 0;
    },

    // Getting hit breaks the combo. Returns how big it was.
    break() {
      const lost = combo.count;
      combo.count = 0;
      combo.timer = 0;
      return lost;
    },

    reset() {
      combo.count = 0;
      combo.timer = 0;
      combo.best = 0;
    },
  };
  return combo;
}
