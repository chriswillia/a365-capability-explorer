import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { content } from './content.ts';
import { chooseAudience, openViewMenu } from './view.ts';
import { emptyWorkspace } from '../src/lib/state/diagnostic-model.ts';

const { site } = content;
const storageKey = 'cpcompass:diagnostic';
const audienceKey = 'cpcompass:audience';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function seed(page: Page) {
  const data = emptyWorkspace();
  const now = new Date().toISOString();
  const entity = { createdAt: now, updatedAt: now, contentVersion: 'old-content' };
  const organization = {
    ...entity,
    id: crypto.randomUUID(),
    answers: {
      orgName: 'Fictional playbook customer',
      basePlan: 'm365-e5',
      agent365Status: 'none',
    },
  };
  const assessment = {
    ...entity,
    id: crypto.randomUUID(),
    organizationId: organization.id,
    answers: {
      useCaseName: 'Fictional playbook agent',
      accessModel: 'own-teammate',
      buildPlatform: 'copilot-studio',
      sponsor: 'yes',
      audience: ['partners'],
    },
    mode: 'full' as const,
    sectionId: 'review',
    patternId: null,
    sampleId: null,
  };
  data.organizations.push(organization);
  data.assessments.push(assessment);
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: data },
  );
  return assessment;
}

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const violations = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations.map(
    (v) => `${v.impact} ${v.id}: ${v.help} e.g. ${v.nodes[0]?.html.slice(0, 120)}`,
  );

test.describe('seller playbook navigation', () => {
  const jobs = ['pitch', 'patterns', 'map', 'licensing', 'deploy'] as const;
  const library = [
    'fit',
    'access',
    'capabilities',
    'learn',
    'portfolio',
    'workshop',
    'methodology',
  ] as const;

  test('lists the jobs and the example agents, and keeps everything else in a More menu', async ({
    page,
  }) => {
    await page.goto('./');
    const nav = page.getByRole('navigation', { name: site.ui.mainNavLabel });
    // The More menu is closed, so only the jobs and the example agents are in the page's reading order.
    await expect(nav.getByRole('link')).toHaveText(jobs.map((key) => site.ui.nav[key]));
    const menu = nav.locator('details');
    const summary = menu.locator('summary');
    await expect(summary).toHaveText(site.ui.nav.library);
    for (const key of library)
      await expect(nav.getByRole('link', { name: site.ui.nav[key], exact: true })).toBeHidden();

    await summary.click();
    await expect(nav.getByRole('link')).toHaveText(
      [...jobs, ...library].map((key) => site.ui.nav[key]),
    );
    for (const key of library)
      await expect(nav.getByRole('link', { name: site.ui.nav[key], exact: true })).toBeVisible();
    // One page per row: the header's own list styling must not turn the menu's lists into a wrapped row.
    const tops = await Promise.all(
      library.map(async (key) => {
        const box = await nav
          .getByRole('link', { name: site.ui.nav[key], exact: true })
          .boundingBox();
        return Math.round(box!.y);
      }),
    );
    expect(new Set(tops).size).toBe(library.length);
    await page.keyboard.press('Escape');
    await expect(menu).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
  });

  test('opens from the keyboard, and choosing a page closes it and moves focus to the heading', async ({
    page,
  }) => {
    await page.goto('./');
    const nav = page.getByRole('navigation', { name: site.ui.mainNavLabel });
    const summary = nav.locator('details summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(
      nav.getByRole('link', { name: site.ui.nav[library[0]], exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    const heading = page.getByRole('heading', { level: 1, name: site.routes.fit.title });
    await expect(heading).toBeFocused();
    await expect(nav.locator('details')).not.toHaveAttribute('open', '');
    await expect(page).toHaveTitle(`${site.routes.fit.title} · ${site.productName}`);
  });

  test('the home page offers each job as a link, and the hero opens the pitch', async ({
    page,
  }) => {
    await page.goto('./');
    // The header and the hero link to some of the same pages, so look for the tiles in their own section.
    const tiles = page.getByRole('region', { name: site.overview.jobs.heading });
    for (const tile of site.overview.jobs.tiles)
      await expect(tiles.getByRole('link', { name: tile.cta, exact: true })).toBeVisible();
    await page.getByRole('link', { name: site.overview.ctaPrimary, exact: true }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.pitch.title }),
    ).toBeVisible();
  });

  test('keeps an old conversation link working, landing on the guide with its query string', async ({
    page,
  }) => {
    await page.goto('conversation?audience=security');
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.pitch.title }),
    ).toBeVisible();
    await expect(page).toHaveURL(/pitch\?audience=security#conversation$/);
    await expect(page.locator('#conversation')).toBeInViewport();
  });
});

test.describe('Selling as', () => {
  test('changes the pitch, is remembered after a reload and stores nothing but the choice', async ({
    page,
  }) => {
    await page.goto('pitch');
    await chooseAudience(page, 'security');
    const pitch = content.value.pitch.audiences.security.opening;
    await expect(page.getByText(pitch)).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), audienceKey)).toBe('security');
    await page.reload();
    const menu = await openViewMenu(page);
    await expect(
      menu.getByRole('button', { name: site.ui.audience.security, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    // The menu says what is chosen without being opened.
    await expect(menu.locator('summary')).toContainText(site.ui.audience.security);
    await expect(page.getByText(pitch)).toBeVisible();
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.filter((key) => key !== audienceKey)).toEqual([]);
  });

  test('is listed on the privacy page with the other stored choices', async ({ page }) => {
    await page.goto('privacy');
    await expect(page.getByText(audienceKey, { exact: false })).toBeVisible();
  });
});

test.describe('value brief', () => {
  test('keeps its choice in the address, keeps the customer name out of it and prints alone', async ({
    page,
  }) => {
    await page.goto('pitch');
    const boxes = page
      .getByRole('group', { name: content.value.brief.concernsLegend })
      .getByRole('checkbox');
    await expect(boxes.first()).toBeVisible();
    const count = await boxes.count();
    for (let i = 0; i < count; i++) {
      if (await boxes.nth(i).isChecked()) await boxes.nth(i).click();
    }
    await expect(page).toHaveURL(/concerns=none/);
    await expect(page.getByText(content.value.brief.emptyNote)).toBeVisible();
    await boxes.nth(1).click();
    await expect(boxes.nth(1)).toBeChecked();
    await expect(page).toHaveURL(/concerns=[a-z-]+$/);
    await page.getByLabel(content.value.brief.customerLabel).fill('Fictional Customer');
    expect(page.url()).not.toContain('Fictional');

    await page.reload();
    await expect(boxes.nth(1)).toBeChecked();
    await expect(page.getByLabel(content.value.brief.customerLabel)).toHaveValue('');

    await page.getByLabel(content.value.brief.customerLabel).fill('Fictional Customer');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#pitch')).toBeHidden();
    await expect(page.locator('header')).toBeHidden();
    const brief = page.locator('[data-print-document]');
    await expect(brief).toBeVisible();
    await expect(brief.getByRole('heading', { level: 3 })).toContainText('Fictional Customer');
    const pdf = await page.pdf({ format: 'A4' });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});

test.describe('licensing and stack fit', () => {
  test('licensing greys out the people who do not apply to how the agent acts, and keeps the choice', async ({
    page,
  }) => {
    await page.goto('licensing');
    await page
      .getByLabel(content.licensing.who.accessLabel, { exact: true })
      .selectOption('delegated');
    await expect(page).toHaveURL(/access=delegated/);
    const own = content.licensing.who.populations.find((p) => p.id === 'own-access-owners')!;
    const card = page
      .getByRole('heading', { level: 3, name: own.label })
      .locator('xpath=ancestor::li');
    await expect(card).toContainText(content.licensing.who.notApplicable);
    await page.reload();
    await expect(page.getByLabel(content.licensing.who.accessLabel, { exact: true })).toHaveValue(
      'delegated',
    );
  });

  test('licensing copies a note for the licensing specialist without storing the customer name', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('licensing?access=own-background');
    await page.getByLabel(content.value.brief.customerLabel).fill('Fictional Customer');
    await page.getByRole('button', { name: content.licensing.handoff.copy }).click();
    await expect(page.locator('#handoff').getByRole('status')).toContainText(
      content.licensing.handoff.copied,
    );
    const note = await page.evaluate(() => navigator.clipboard.readText());
    expect(note).toContain('Fictional Customer');
    expect(note).toContain(content.licensing.handoff.questions[0]);
    expect(page.url()).not.toContain('Fictional');
    expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).not.toContain(
      'Fictional',
    );
  });

  test('stack fit shows a table for the chosen platforms and restores the choice after a reload', async ({
    page,
  }) => {
    await page.goto('fit');
    const platform = content.fit.platforms.items.find((p) => p.id === 'cloud-registry-sync')!;
    await expect(page.getByText(content.fit.platforms.emptyNote)).toBeVisible();
    await page.getByRole('checkbox', { name: platform.label, exact: true }).click();
    await expect(page.getByRole('checkbox', { name: platform.label, exact: true })).toBeChecked();
    await expect(page).toHaveURL(/platforms=cloud-registry-sync/);
    const table = page.getByRole('table').first();
    await expect(table.getByRole('rowheader', { name: platform.label })).toBeVisible();
    await expect(table).toContainText(site.ui.badges.preview);
    await page.reload();
    await expect(page.getByRole('checkbox', { name: platform.label, exact: true })).toBeChecked();
  });
});

test.describe('how an agent acts, guardrails and the readout', () => {
  test('shows what changes for a saved assessment and marks the way it acts', async ({ page }) => {
    const assessment = await seed(page);
    await page.goto('access');
    await page
      .getByLabel(content.accessPatterns.assessmentLabel, { exact: true })
      .selectOption(assessment.id);
    await expect(page).toHaveURL(new RegExp(`assessment=${assessment.id}`));
    await expect(page.getByText(content.accessPatterns.currentBadge).first()).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: new RegExp(`^${content.accessPatterns.changeBoth}`),
      }),
    ).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('the assessment review shows the guardrails and links on to licensing and access', async ({
    page,
  }) => {
    const assessment = await seed(page);
    await page.goto(`diagnostic/${assessment.id}`);
    await expect(
      page.getByRole('heading', { level: 3, name: content.guardrails.heading }),
    ).toBeVisible();
    await expect(page.getByText(content.guardrails.statusLabels.ready).first()).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.getByRole('link', { name: content.site.diagnostic.licensingLink }).click();
    await expect(page).toHaveURL(new RegExp(`licensing\\?assessment=${assessment.id}`));
    await expect(
      page.getByLabel(content.licensing.requirementsPanel.assessmentLabel, { exact: true }),
    ).toHaveValue(assessment.id);
    expect(await violations(page)).toEqual([]);
  });

  test('the readout adds how the agent acts and the production guardrails as numbered exhibits', async ({
    page,
  }) => {
    const assessment = await seed(page);
    await page.goto(`diagnostic/${assessment.id}/readout`);
    for (const key of ['access', 'guardrails'] as const) {
      const exhibit = page.locator(`#exhibit-${key}`);
      await expect(exhibit.getByRole('heading', { level: 2 })).toHaveText(
        content.site.readout.exhibits[key],
      );
    }
    await expect(
      page.locator('#exhibit-guardrails').getByText(content.guardrails.statusLabels.gap).first(),
    ).toBeVisible();
    await expect(
      page.locator('#exhibit-licensing').getByRole('link', {
        name: content.site.readout.licenseOpen,
      }),
    ).toHaveAttribute('href', new RegExp(`licensing\\?assessment=${assessment.id}`));
  });
});

test.describe('narrow screens', () => {
  for (const width of [320, 360, 390]) {
    test(`the new pages fit ${width}px without horizontal scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const assessment = await seed(page);
      for (const path of [
        'pitch',
        'licensing',
        `licensing?assessment=${assessment.id}`,
        'fit?platforms=copilot-studio,cloud-registry-sync&tools=stack-purview,stack-defender',
        `access?assessment=${assessment.id}`,
        `diagnostic/${assessment.id}`,
        `diagnostic/${assessment.id}/readout`,
      ]) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(await noOverflow(page), `${path} at ${width}px`).toBe(true);
      }
    });
  }

  test('the menus open inline on a phone, behind one Menu button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('./');
    const nav = page.getByRole('navigation', { name: site.ui.mainNavLabel });
    // Closed, the header is one short row: nothing but the brand and the Menu button.
    await expect(nav).toBeHidden();
    const header = await page.getByRole('banner').boundingBox();
    expect(header!.height).toBeLessThan(80);
    await page.getByRole('button', { name: site.ui.menuLabel, exact: true }).click();
    await expect(nav).toBeVisible();
    await nav.locator('details summary').click();
    await expect(nav.getByRole('link', { name: site.ui.nav.access, exact: true })).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    // Choosing a page closes the menu again.
    await nav.getByRole('link', { name: site.ui.nav.pitch, exact: true }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.pitch.title }),
    ).toBeVisible();
    await expect(nav).toBeHidden();
  });
});
