import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({
    jsxRuntime: 'classic'
  })],
  server: {
    middlewareMode: true,
  },
  appType: 'custom',
  build: {
    manifest: true,
    outDir: 'dist',
  },
});
