// vite.config.js
// Settings for Vite, the tool that runs the game while we work on it (npm run dev)
// and packs it up for publishing (npm run build).
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Three.js alone is about 550 kB, so the game is one ~590 kB file (150 kB zipped).
    // That's fine for a game, so we raise the size warning limit.
    chunkSizeWarningLimit: 800,
  },
});
