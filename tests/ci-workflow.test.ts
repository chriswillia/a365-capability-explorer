import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const workflow = load(read('../.github/workflows/ci.yml'));

describe('CI browser runtime', () => {
  it('keeps the preinstalled browser image aligned with the locked Playwright version', () => {
    const lock = z
      .object({
        packages: z.object({
          'node_modules/@playwright/test': z.object({ version: z.string() }),
        }),
      })
      .parse(JSON.parse(read('../package-lock.json')));
    const version = lock.packages['node_modules/@playwright/test'].version;
    expect(workflow).toMatchObject({
      jobs: { verify: { container: { image: `mcr.microsoft.com/playwright:v${version}-noble` } } },
    });
  });

  it('requires a working browser and all tests before publishing', () => {
    expect(workflow).toMatchObject({
      jobs: {
        verify: {
          'timeout-minutes': 20,
          steps: expect.arrayContaining([
            expect.objectContaining({
              name: 'Verify the test browser',
              'timeout-minutes': 2,
              run: expect.stringContaining('chromium.launch()'),
            }),
            expect.objectContaining({ name: 'Unit and component tests', run: 'npx vitest run' }),
            expect.objectContaining({
              name: 'End-to-end and accessibility tests',
              run: 'npx playwright test',
            }),
          ]),
        },
      },
    });
    expect(load(read('../.github/workflows/deploy-pages.yml'))).toMatchObject({
      jobs: { deploy: { needs: 'ci' } },
    });
  });
});
