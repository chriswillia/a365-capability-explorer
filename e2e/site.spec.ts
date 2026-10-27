import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Capability, Site, Learn, Persona } from '../src/lib/content/schemas.ts';

/*
 * Reads the same compiled content the app was built from, so expectations follow the content rather than
 * repeating it. Relative URLs ("capabilities", "./") resolve against each project's baseURL, which ends in "/".
 */
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(`src/generated/${name}.json`, 'utf8')) as T;
const site = read<Site>('site');
const capabilities = read<Capability[]>('capabilities');
const learn = read<Learn>('learn');
const personas = read<Persona[]>('personas');

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

    for (const path of [
      './',
      'capabilities',
      `capabilities/${capabilities[0]!.id}`,
      'learn',
      'privacy',
      'portfolio',
      'workshop',
      'patterns',
      'patterns/ai-teammate',
      'methodology',
    ]) {
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
    for (const path of [
      './',
      'capabilities',
      `capabilities/${capabilities[0]!.id}`,
      'privacy',
      'patterns',
      'patterns/ai-teammate',
      'patterns/process-agent?sample=askhr',
      'capabilities?lens=risk&group=shadow-ai',
      'capabilities?lens=pattern&group=local-agent&view=matrix',
      'methodology',
      'learn',
      'portfolio',
      'workshop',
    ]) {
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

test.describe('Understand and Learn', () => {
  test('persona starts reach available sections under either base path', async ({
    page,
    baseURL,
  }) => {
    for (const persona of personas) {
      await page.goto('./');
      await page.getByRole('link', { name: persona.startLabel, exact: true }).click();
      const expected = new URL(persona.href.slice(1), baseURL);
      await expect(page).toHaveURL(expected.href);
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: persona.href.startsWith('/learn')
            ? site.routes.learn.title
            : site.routes.capabilities.title,
        }),
      ).toBeVisible();
      if (expected.hash) {
        await expect(page.locator(expected.hash)).toBeInViewport();
      }
    }
  });
  test('walkthrough advances with the keyboard and retains its table alternative', async ({
    page,
  }) => {
    await page.goto('learn');
    await expect(
      page.getByRole('table', { name: site.learn.flowTable }).getByRole('row'),
    ).toHaveCount(learn.flow.length + 1);
    const next = page.getByRole('button', { name: site.learn.next });
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText(`2`);
    await expect(page.getByRole('heading', { name: learn.flow[1]!.title }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: site.learn.previous })).toBeEnabled();
    await setDepth(page, 'technical');
    await expect(page.getByText(learn.flow[1]!.technical!, { exact: true })).toBeVisible();
  });
  test('glossary links expose keyboard tooltips and survive refresh at the definition', async ({
    page,
  }) => {
    await page.goto('learn');
    const link = page.locator('main a[href$="#glossary-sdk"]').first();
    await link.focus();
    const description = await link.getAttribute('aria-describedby');
    const tooltip = page.locator(`[id="${description}"]`);
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#glossary-sdk$/);
    await expect(page.locator('#glossary-sdk')).toBeInViewport();
    await page.reload();
    await expect(page.locator('#glossary-sdk')).toBeInViewport();
  });
  test('Learn and persona cards fit a narrow screen without page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['./', 'learn', 'learn#glossary']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  });
});

test.describe('capabilities page', () => {
  test('keeps lenses, views and comparison in the URL through refresh and history', async ({
    page,
  }) => {
    const copy = site.capabilities.explorer;
    await page.goto('capabilities?lens=layer&group=data&view=cards');
    const expected = capabilities.filter((c) => c.controlPoints.includes('data'));
    await expect(page.getByRole('checkbox')).toHaveCount(expected.length);
    await page.getByLabel(copy.view, { exact: true }).selectOption('matrix');
    await expect(page).toHaveURL(/view=matrix/);
    await page.reload();
    await expect(page.getByLabel(copy.view, { exact: true })).toHaveValue('matrix');
    const checkbox = page.getByRole('checkbox').first();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await expect(page).toHaveURL(/compare=/);
    await page.goBack();
    await expect(page).not.toHaveURL(/compare=/);
    await page.goBack();
    await expect(page.getByLabel(copy.view, { exact: true })).toHaveValue('cards');
  });

  test('deep-linked briefs and corrections work under either base path', async ({ page }) => {
    const c = capabilities[0]!;
    await page.goto(`capabilities/${c.id}`);
    await expect(page.getByRole('heading', { level: 1, name: c.shortName })).toBeVisible();
    await page.reload();
    await expect(page.getByText(c.source.featureText, { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: site.capabilities.brief.correction, exact: true }),
    ).toHaveAttribute(
      'href',
      /github\.com\/chriswillia\/a365-capability-explorer\/issues\/new\?title=/,
    );
  });

  test('cards and matrix remain usable on a narrow screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('capabilities?view=cards');
    await expect(page.getByRole('link', { name: capabilities[0]!.shortName })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByLabel(site.capabilities.explorer.view, { exact: true }).selectOption('matrix');
    await expect(
      page.getByRole('region', { name: site.capabilities.scrollRegionLabel }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

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
  const pages = [
    './',
    'capabilities',
    'capabilities?view=cards',
    'capabilities?view=matrix',
    `capabilities?compare=${capabilities[0]!.id}&compare=${capabilities[1]!.id}`,
    `capabilities/${capabilities[0]!.id}`,
    'privacy',
    'learn',
    'patterns',
    'patterns/ai-teammate',
    'patterns/process-agent?sample=askhr',
    'capabilities?lens=risk&group=shadow-ai',
    'capabilities?lens=pattern&group=local-agent&view=matrix',
    'methodology',
    'no/such/page',
  ];

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
