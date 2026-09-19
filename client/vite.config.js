import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the Express server during development so the
    // client can just call fetch('/api/...') with no CORS/base-URL
    // juggling. In production the two are typically deployed separately
    // (see README "Deployment"), so services/api.js falls back to
    // VITE_API_BASE_URL there.
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
