import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5203, strictPort: true, open: false },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
});
