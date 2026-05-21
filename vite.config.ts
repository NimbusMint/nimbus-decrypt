import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            sourcemap: true,
            minify: false,
            rollupOptions: {
              input: {
                main: 'electron/main.ts',
                'crypto.worker': 'electron/lib/crypto.worker.ts',
              },
              external: ['electron', 'crypto', 'path', 'fs', 'os', 'url', 'module', 'util', 'worker_threads'],
              output: {
                format: 'cjs',
                entryFileNames: '[name].js',
              },
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            sourcemap: true,
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Disable eval — enforced by CSP as well
  esbuild: {
    supported: {
      'dynamic-import': true,
    },
  },
});
