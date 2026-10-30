import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative base path so the static bundle works on any GitHub Pages repo URL
  // (e.g. https://<user>.github.io/<repo>/) or custom domain without reconfiguration.
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) {
            return 'firebase-firestore';
          }
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase-core';
          }
          if (id.includes('node_modules/fuse.js')) {
            return 'categorizer';
          }
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
