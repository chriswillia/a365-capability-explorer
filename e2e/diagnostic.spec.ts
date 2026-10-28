import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { PillarDef, Question, Site } from '../src/lib/content/schemas.ts';
import { renderTemplate } from '../src/lib/content/template.ts';

const site = JSON.parse(readFileSync('src/generated/site.json', 'utf8')) as Site;
const questions = JSON.parse(readFileSync('src/generated/questions.json', 'utf8')) as Question[];
const pillars = JSON.parse(readFileSync('src/generated/pillars.json', 'utf8')) as PillarDef[];
const copy = site.diagnostic;
const label = (id: string) => questions.find((q) => q.id === id)!.label;
const pillarName = (pillar: PillarDef) =>
  renderTemplate(site.capabilities.pillarName, {
    requirement: pillar.requirement,
    label: pillar.label,
  });
const key = 'cpcompass:diagnostic';

// A new customer needs only a name; the cloud is asked in the same form and a quick scan opens at the use case.
async function start(page: Page) {
  await page.goto('diagnostic');
  await page
    .getByRole('textbox', { name: copy.newOrganization })
    .fill('Fictional browser organization');
  await page
    .getByRole('combobox', { name: label('cloudEnvironment'), exact: true })
    .selectOption('gcc');
  await page.getByRole('button', { name: copy.start, exact: true }).click();
  await expect(page).toHaveURL(/diagnostic\/[0-9a-f-]{36}$/);
}

// Less common actions on a saved assessment sit behind "More actions"; open every menu that is closed.
async function openMenus(page: Page) {
  await page.locator('summary', { hasText: copy.more }).first().waitFor();
  const closed = page.locator('details:not([open]) > summary', { hasText: copy.more });
  while ((await closed.count()) > 0) await closed.first().click();
}

test.describe('Phase 4 diagnostic', () => {
  test('autosaves answers, section and mode without names or answers in URLs or requests', async ({
    page,
    baseURL,
  }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await start(page);
    const rail = page.getByRole('navigation', { name: copy.sectionRail });
    await rail.getByRole('button', { name: 'Use case profile', exact: true }).click();
    await page
      .getByRole('textbox', { name: label('useCaseName'), exact: true })
      .fill('Fictional saved assessment');
    await page.getByRole('combobox', { name: copy.mode, exact: true }).selectOption('full');
    await page
      .getByRole('textbox', { name: label('businessOutcome'), exact: true })
      .fill('Preserve this local outcome');
    await rail.getByRole('button', { name: 'Build and run', exact: true }).click();
    await page
      .getByRole('combobox', { name: label('buildPlatform'), exact: true })
      .selectOption('pro-code-microsoft');
    await expect(
      page.getByRole('combobox', { name: label('codeStack'), exact: true }),
    ).toBeVisible();
    await page.getByRole('combobox', { name: copy.mode, exact: true }).selectOption('quick');
    await expect(page.getByRole('combobox', { name: label('codeStack'), exact: true })).toHaveCount(
      0,
    );
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Fictional saved assessment' }),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: copy.mode, exact: true })).toHaveValue('quick');
    await expect(rail.getByRole('button', { name: 'Build and run', exact: true })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await page.getByRole('combobox', { name: copy.mode, exact: true }).selectOption('full');
    await rail.getByRole('button', { name: 'Use case profile', exact: true }).click();
    await expect(
      page.getByRole('textbox', { name: label('businessOutcome'), exact: true }),
    ).toHaveValue('Preserve this local outcome');
    await rail.getByRole('button', { name: 'Tools and interactions', exact: true }).click();
    const tools = page.locator('#question-tools');
    const none = questions.find((q) => q.id === 'tools')!.options.find((o) => o.value === 'none')!;
    const computer = questions
      .find((q) => q.id === 'tools')!
      .options.find((o) => o.value === 'computer-use')!;
    await tools.getByRole('checkbox', { name: none.label, exact: true }).check();
    await tools.getByRole('checkbox', { name: computer.label, exact: true }).check();
    await expect(tools.getByRole('checkbox', { name: none.label, exact: true })).not.toBeChecked();
    await tools.getByRole('button', { name: copy.unknown }).click();
    await expect(
      tools.getByRole('checkbox', { name: computer.label, exact: true }),
    ).not.toBeChecked();
    await rail.getByRole('button', { name: copy.review, exact: true }).click();
    for (const pillar of pillars)
      await expect(
        page.getByRole('heading', { level: 3, name: pillarName(pillar), exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole('link', { name: site.readout.open, exact: true }).last(),
    ).toBeVisible();
    await expect(page.getByRole('table', { name: site.mapping.inScope, exact: true })).toHaveCount(
      0,
    );
    expect(page.url()).toMatch(/diagnostic\/[0-9a-f-]{36}$/);
    expect(requests.every((url) => new URL(url).origin === new URL(baseURL!).origin)).toBe(true);
    expect(requests.some((url) => /Fictional|Preserve/.test(decodeURIComponent(url)))).toBe(false);
  });
  test('a sample starter preserves organization context and supports management confirmations', async ({
    page,
  }) => {
    await page.goto('patterns/process-agent?sample=askhr');
    await page.getByRole('link', { name: copy.startFromPattern, exact: true }).click();
    await expect(page).toHaveURL(/diagnostic\?pattern=process-agent&sample=askhr$/);
    await page
      .getByRole('textbox', { name: copy.newOrganization })
      .fill('Fictional sample organization');
    await page
      .getByRole('combobox', { name: label('cloudEnvironment'), exact: true })
      .selectOption('gcc');
    await page.getByRole('button', { name: copy.start, exact: true }).click();
    await expect(page).toHaveURL(/diagnostic\/[0-9a-f-]{36}$/);
    await page.getByRole('link', { name: copy.back, exact: true }).click();
    await openMenus(page);
    await page.getByRole('button', { name: copy.duplicate, exact: true }).click();
    await openMenus(page);
    await expect(page.getByRole('button', { name: copy.rename, exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: copy.rename, exact: true }).first().click();
    await page
      .getByRole('textbox', { name: copy.assessmentName, exact: true })
      .fill('Renamed local assessment');
    await page.getByRole('button', { name: copy.save, exact: true }).click();
    const card = page.getByRole('listitem').filter({
      has: page.getByRole('heading', { name: 'Renamed local assessment', exact: true }),
    });
    await openMenus(page);
    await card.getByRole('button', { name: copy.delete, exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: copy.cancel })).toBeFocused();
    await expect(dialog).toHaveCSS('opacity', '1');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await dialog.getByRole('button', { name: copy.cancel }).click();
    await expect(card).toBeVisible();
    await expect(card.getByRole('button', { name: copy.delete, exact: true })).toBeFocused();
    await card.getByRole('button', { name: copy.delete, exact: true }).click();
    await dialog.getByRole('button', { name: copy.confirm }).click();
    await expect(card).toHaveCount(0);
    const saved = await page.evaluate(
      (storageKey) => JSON.parse(localStorage.getItem(storageKey)!),
      key,
    );
    expect(saved.organizations[0].answers.cloudEnvironment).toBe('gcc');
    expect(saved.assessments).toHaveLength(1);
    expect(saved.assessments[0].sampleId).toBe('askhr');
    expect(saved.organizations[0].answers).toEqual({
      orgName: 'Fictional sample organization',
      cloudEnvironment: 'gcc',
    });
  });
  test('failed saves keep the draft and the real leave dialog traps keyboard focus', async ({
    page,
  }) => {
    await start(page);
    await page
      .getByRole('navigation', { name: copy.sectionRail })
      .getByRole('button', { name: 'Use case profile', exact: true })
      .click();
    await page.evaluate((storageKey) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === storageKey) throw new DOMException('Test quota failure', 'QuotaExceededError');
        original.call(this, name, value);
      };
      window.addEventListener(
        'restore-test-storage',
        () => {
          Storage.prototype.setItem = original;
        },
        { once: true },
      );
    }, key);
    await page
      .getByRole('textbox', { name: label('useCaseName'), exact: true })
      .fill('In-memory draft');
    await expect(page.getByRole('alert')).toContainText(copy.storageQuota);
    await page.getByRole('link', { name: site.ui.nav.pitch, exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    const cancel = dialog.getByRole('button', { name: copy.cancel });
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: copy.leave })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
    await expect(dialog).toHaveCSS('opacity', '1');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await cancel.click();
    await expect(page).toHaveURL(/diagnostic\/[0-9a-f-]{36}$/);
    await page.evaluate(() => window.dispatchEvent(new Event('restore-test-storage')));
    await page.getByRole('button', { name: copy.retry }).click();
    await expect(page.getByText(copy.storageQuota, { exact: true })).toHaveCount(0);
    const saved = await page.evaluate(
      (storageKey) => JSON.parse(localStorage.getItem(storageKey)!),
      key,
    );
    expect(saved.assessments[0].answers.useCaseName).toBe('In-memory draft');
  });
  for (const depth of ['executive', 'technical'] as const) {
    test(`zero axe violations on home, full wizard and review in ${depth}`, async ({ page }) => {
      await page.goto('diagnostic');
      await page.getByRole('button', { name: site.ui.depth[depth], exact: true }).click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await start(page);
      await page.getByRole('combobox', { name: copy.mode, exact: true }).selectOption('full');
      await page
        .getByRole('navigation', { name: copy.sectionRail })
        .getByRole('button', { name: 'Customer profile', exact: true })
        .click();
      await page.locator('#question-orgName summary').click();
      await page.getByRole('button', { name: site.mapping.anatomyByOptions.layer }).click();
      await page.locator('aside').getByText(site.mapping.anatomy, { exact: true }).first().click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page
        .getByRole('navigation', { name: copy.sectionRail })
        .getByRole('button', { name: copy.review, exact: true })
        .click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }
  test('mobile wizard and preview fit a narrow viewport and support keyboard section navigation', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await start(page);
    await page
      .getByRole('textbox', { name: label('useCaseName'), exact: true })
      .fill('Fictional mobile assessment');
    const next = page.getByRole('button', { name: copy.next, exact: true });
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { level: 2, name: 'How the agent acts', exact: true }),
    ).toBeFocused();
    await page
      .getByRole('navigation', { name: copy.sectionRail })
      .getByRole('button', { name: copy.review, exact: true })
      .click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
  test('corrupt local data is recoverable and only resets after confirmation', async ({ page }) => {
    await page.addInitScript((storageKey) => localStorage.setItem(storageKey, '{broken'), key);
    await page.goto('diagnostic');
    await expect(page.getByText(copy.storageInvalid, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: copy.start, exact: true })).toHaveCount(0);
    await page.getByText(copy.recovery, { exact: true }).click();
    await expect(page.getByRole('textbox', { name: copy.recovery })).toHaveValue('{broken');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: copy.reset, exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: copy.cancel }).click();
    expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(
      '{broken',
    );
    await page.getByRole('button', { name: copy.reset, exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: copy.confirm }).click();
    await expect(page.getByRole('button', { name: copy.start, exact: true })).toBeVisible();
    expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
  });
});

test.describe('seller flow', () => {
  test('a scenario start marks its answers as assumed until the seller confirms them', async ({
    page,
  }) => {
    await page.goto('diagnostic?pattern=process-agent');
    await page
      .getByRole('textbox', { name: copy.newOrganization })
      .fill('Fictional assumed customer');
    await page.getByRole('button', { name: copy.start, exact: true }).click();
    await expect(page).toHaveURL(/diagnostic\/[0-9a-f-]{36}$/);
    await expect(page.getByText(copy.assumedBadge).first()).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    const confirm = page.getByRole('button', {
      name: `${copy.confirmAnswer} — ${label('stage')}`,
      exact: true,
    });
    await confirm.click();
    await expect(confirm).toHaveCount(0);
    const saved = await page.evaluate(
      (storageKey) => JSON.parse(localStorage.getItem(storageKey)!),
      key,
    );
    const assumed: string[] = saved.assessments[0].assumedQuestionIds;
    expect(assumed).not.toContain('stage');
    expect(assumed.length).toBeGreaterThan(3);

    await page.getByRole('link', { name: site.readout.open, exact: true }).first().click();
    await expect(
      page.getByText(renderTemplate(site.readout.assumedTakeaway, { count: assumed.length })),
    ).toBeVisible();
  });

  test('the header keeps the customer in reach and opens their comparison', async ({ page }) => {
    await start(page);
    const chip = page.locator('summary', { hasText: `${site.ui.customer.label}:` });
    const menu = page.locator('details').filter({ has: chip });
    await expect(chip).toContainText('Fictional browser organization');
    await chip.click();
    await expect(menu).toHaveAttribute('open', '');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('link', { name: site.ui.customer.compare, exact: true }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.portfolio.title }),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: site.portfolio.organization })).toContainText(
      'Fictional browser organization',
    );
    await expect(menu).not.toHaveAttribute('open', '');
  });
});
