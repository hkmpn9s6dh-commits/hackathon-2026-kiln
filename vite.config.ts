import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { devvit } from '@devvit/start/vite';

export default defineConfig({
  plugins: [react(), devvit()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    sourcemap: false,
  },
});
