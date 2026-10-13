// device.js
// Works out what kind of device the game is running on.
// "pointer: coarse" means the main way to point is a finger (phone or tablet),
// not a precise mouse. Phones are slower than computers, so other files use this
// to draw a little less detail, and the UI shows on-screen Fly and Zap buttons.

export const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
