import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/*
 * Reads the same compiled content the app was built from, so expectations follow the content rather than
 * repeating it. Relative URLs ("capabilities", "./") resolve against each project's baseURL, which ends in "/".
 */
interface Site {
  productName: string;
  tagline: string;
  indexable: boolean;
  disclaimer: string;
  ui: {
    depth: { groupLabel: string; executive: string; technical: string };
    skipToContent: string;
  };
  routes: Record<string, { title: string }>;
  overview: { kpis: { id: string; label: string; valueKey: string }[] };
  privacy: { statement: string };
}
interface Capability {
  id: string;
  source: { includedWithBasePlans: boolean; gccAvailable: boolean };
  setup: string;
}
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(`src/generated/${name}.json`, 'utf8')) as T;
const site = read<Site>('site');
const capabilities = read<Capability[]>('capabilities');

const DEPTH_KEY = 'cpcompass:depth';

async function setDepth(page: Page, depth: 'executive' | 'technical') {
  const label = depth === 'executive' ? site.ui.depth.executive : site.ui.depth.technical;
  await page
    .getByRole('group', { name: site.ui.depth.groupLabel })
    .getByRole('button', { name: label })
    .click();
}

test.describe('home page', () => {
  test('shows the product name, subtitle and KPIs computed from the content', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1, name: site.productName })).toBeVisible();
    await expect(page.getByText(site.tagline)).toBeVisible();

    const expected: Record<string, number> = {
      capabilityCount: capabilities.length,
      foundationalCount: capabilities.filter((c) => c.source.includedWithBasePlans).length,
      premiumCount: capabilities.filter((c) => !c.source.includedWithBasePlans).length,
      gccCount: capabilities.filter((c) => c.source.gccAvailable).length,
      platformCount: capabilities.filter((c) => c.setup === 'platform').length,
      agentDecisionCount: capabilities.filter((c) => c.setup !== 'platform').length,
    };
    for (const kpi of site.overview.kpis) {
      const tile = page.locator('dl > div', { hasText: kpi.label });
      await expect(tile.locator('dd').first()).toHaveText(String(expected[kpi.valueKey]));
    }
  });

  test('sets the document title from the subtitle', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveTitle(`${site.productName}: ${site.tagline.replace(/\.$/, '')}`);
  });

  test('shows the mandated disclaimer in the footer', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('contentinfo')).toContainText(site.disclaimer);
  });

  test('adds console and layer tables in the Technical view only, and remembers the choice', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(page.getByRole('table')).toHaveCount(0);

    await setDepth(page, 'technical');
    await expect(page.getByRole('table')).toHaveCount(2);
    expect(await page.evaluate((key) => window.localStorage.getItem(key), DEPTH_KEY)).toBe(
      'technical',
    );

    await page.reload();
    await expect(page.getByRole('table')).toHaveCount(2);
    await setDepth(page, 'executive');
    await expect(page.getByRole('table')).toHaveCount(0);
  });
});

test.describe('hosting behavior (GitHub Pages)', () => {
  test('a deep link loads the app, and survives a hard refresh', async ({ page }) => {
    await page.goto('capabilities');
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.capabilities.title }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.capabilities.title }),
    ).toBeVisible();
  });

  test('an unknown address shows the in-app not-found page', async ({ page }) => {
    await page.goto('no/such/page');
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.notFound.title }),
    ).toBeVisible();
  });

  test('every script, style, font and image loads from the same base path', async ({ page }) => {
    const failures: string[] = [];
    page.on('response', (response) => {
      const type = response.request().resourceType();
      // The 404.html fallback itself answers a deep link with HTTP 404 on GitHub Pages; assets must not.
      if (type !== 'document' && response.status() >= 400)
        failures.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) => failures.push(`failed ${request.url()}`));

    for (const path of ['./', 'capabilities', 'privacy']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    expect(failures).toEqual([]);
  });

  test('makes no requests to any other site', async ({ page, baseURL }) => {
    const origins = new Set<string>();
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin);
    });
    for (const path of ['./', 'capabilities', 'privacy', 'patterns']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    await setDepth(page, 'technical');
    expect([...origins]).toEqual([new URL(baseURL as string).origin]);
  });

  test('carries a noindex tag exactly while the site is not indexable', async ({ page }) => {
    await page.goto('./');
    const robots = page.locator('meta[name="robots"]');
    if (site.indexable) await expect(robots).toHaveCount(0);
    else await expect(robots).toHaveAttribute('content', /noindex/);
  });
});

test.describe('capabilities page', () => {
  test('badge icons keep their size (an icon squeezed to a sliver is invisible)', async ({
    page,
  }) => {
    await page.goto('capabilities');
    await setDepth(page, 'technical');
    const icon = page.locator('span[aria-hidden="true"] > svg').first();
    await expect(icon).toBeVisible();
    const box = await icon.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(14);
    expect(box?.height).toBeGreaterThanOrEqual(14);
  });
});

test.describe('keyboard and focus', () => {
  test('the skip link is the first stop and moves focus to the main content', async ({ page }) => {
    await page.goto('./');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: site.ui.skipToContent });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
  });

  test('after navigating, focus moves to the new page heading and the title follows', async ({
    page,
  }) => {
    await page.goto('./');
    await page.getByRole('navigation').getByRole('link', { name: 'Capabilities' }).click();
    const heading = page.getByRole('heading', { level: 1, name: site.routes.capabilities.title });
    await expect(heading).toBeFocused();
    await expect(page).toHaveTitle(`${site.routes.capabilities.title} · ${site.productName}`);
  });

  test('the capabilities table scroll region can be reached by keyboard', async ({ page }) => {
    await page.goto('capabilities');
    const region = page.getByRole('region', { name: /scrollable/i });
    await region.focus();
    await expect(region).toBeFocused();
  });
});

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  const pages = ['./', 'capabilities', 'privacy', 'patterns', 'no/such/page'];

  for (const depth of ['executive', 'technical'] as const) {
    for (const path of pages) {
      test(`${path} has no violations in the ${depth} view`, async ({ page }) => {
        await page.goto(path);
        await setDepth(page, depth);
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const summary = results.violations.map(
          (v) =>
            `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} node(s)) e.g. ${v.nodes[0]?.html.slice(0, 120)}`,
        );
        expect(summary).toEqual([]);
      });
    }
  }
});
