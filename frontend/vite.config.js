import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/health': apiTarget,
      '/jobs': apiTarget,
      '/projects': apiTarget,
      '/openapi.json': apiTarget,
      '/docs': apiTarget
    }
  }
});
