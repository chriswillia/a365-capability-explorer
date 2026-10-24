import { defineConfig, devices } from '@playwright/test';

/*
 * End-to-end tests run against the built site, served the way GitHub Pages serves it (404.html fallback with
 * HTTP 404), once from the root and once from a project path. Set LIVE_URL to run them against a deployed site.
 */
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'control-plane-compass';
const live = process.env.LIVE_URL;
const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { trace: 'retain-on-failure' },
  projects:
    live === undefined
      ? [
          {
            name: 'site-root',
            use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173/' },
          },
          {
            name: 'site-repo',
            use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:4174/${repo}/` },
          },
        ]
      : [{ name: 'live', use: { ...devices['Desktop Chrome'], baseURL: withSlash(live) } }],
  webServer:
    live === undefined
      ? [
          {
            command: 'npx tsx scripts/serve-pages-like.ts --dir dist-root --base / --port 4173',
            url: 'http://localhost:4173/',
            reuseExistingServer: !process.env.CI,
          },
          {
            command: `npx tsx scripts/serve-pages-like.ts --dir dist-repo --base /${repo}/ --port 4174`,
            url: `http://localhost:4174/${repo}/`,
            reuseExistingServer: !process.env.CI,
          },
        ]
      : undefined,
});
