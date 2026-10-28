import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { normalizeBase } from './scripts/base-path.ts';
import { sitePlugin } from './scripts/vite-plugin-site.ts';

// https://vite.dev/config/
export default defineConfig({
  // Never hard-coded: BASE_PATH is set by the deploy workflow from actions/configure-pages.
  base: normalizeBase(process.env.BASE_PATH),
  plugins: [react(), sitePlugin()],
  build: {
    outDir: process.env.OUT_DIR ?? 'dist',
    target: 'es2023',
    // A soft budget for the main chunk (React, the router and Fluent UI are most of it). The Phase 7
    // performance pass revisits chunking; until then a jump past this should be a deliberate choice.
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        // The generated content is data that changes on its own schedule. In its own chunk it stays cached
        // across a code-only release, and the entry chunk stays under the budget above.
        codeSplitting: { groups: [{ name: 'content', test: /[\\/]src[\\/]generated[\\/]/ }] },
      },
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'tests/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./tests/setup.ts'],
          // Whole-app renders in jsdom share the machine with the other test files.
          testTimeout: 20000,
        },
      },
    ],
  },
});
