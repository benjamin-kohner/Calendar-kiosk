import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Single-page kiosk app. The Vercel serverless functions live in /api and are
// served by Vercel (or `vercel dev` locally); Vite only builds the frontend.
export default defineConfig({
  plugins: [svelte()],
  build: {
    target: 'es2022',
    outDir: 'dist'
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    // When running plain `vite` for UI work, proxy /api to a running `vercel dev`
    // on :3000 if you have one. Otherwise the app gracefully falls back to cache.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
