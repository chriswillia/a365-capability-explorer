import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { content, contentMeta } from './content.ts';
import { patternAnswers } from '../src/lib/engine/evaluate.ts';
import { computePortfolioMetrics, computeWorkshopMinutes } from '../src/lib/content/metrics.ts';
import { renderTemplate } from '../src/lib/content/template.ts';
import { buildPortfolio, portfolioLevel } from '../src/lib/portfolio/portfolio.ts';
import { emptyWorkspace, type DiagnosticWorkspace } from '../src/lib/state/diagnostic-model.ts';
import { parseDiagnosticBundle } from '../src/lib/state/diagnostic-transfer.ts';

const copy = content.site.portfolio;
const workshop = content.workshop;
const mapping = content.site.mapping;
const presentation = content.site.presentation;
const key = 'cpcompass:diagnostic';

async function seed(page: Page) {
  const data = emptyWorkspace();
  const entity = {
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    contentVersion: 'old-content',
  };
  const input = patternAnswers(content, 'process-agent', 'askhr');
  data.organizations.push(
    {
      ...entity,
      id: crypto.randomUUID(),
      answers: { ...input.org, orgName: 'Fictional portfolio organization' },
    },
    { ...entity, id: crypto.randomUUID(), answers: { orgName: 'Separate organization' } },
  );
  for (const [index, title] of [
    'Fictional HR assistant',
    'Fictional operations agent',
    'Unknown value case',
    'Incompatible case',
    'Separate case',
  ].entries())
    data.assessments.push({
      ...entity,
      id: crypto.randomUUID(),
      organizationId: data.organizations[index === 4 ? 1 : 0]!.id,
      answers: {
        ...input.useCase,
        useCaseName: title,
        businessValue: index === 2 ? null : index === 1 ? '2' : '5',
        expectedUsers: index === 0 ? 'gt-5000' : index === 2 ? null : 'lt-50',
        ...(index === 3 ? { retiredQuestion: 'keep this answer' } : {}),
      },
      mode: 'full',
      sectionId: 'review',
      patternId: 'process-agent',
      sampleId: 'askhr',
    });
  await page.addInitScript(
    ({ key, data }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(data));
    },
    { key, data },
  );
  return data;
}
const saved = (page: Page) => page.evaluate((key) => localStorage.getItem(key), key);
const assertNoHorizontalOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

test.describe('Phase 6 portfolio and workshop kit', () => {
  test('portfolio recomputes exact levels, shared foundations and readiness without changing saved data', async ({
    page,
  }) => {
    const data = await seed(page);
    const expected = buildPortfolio(
      content,
      data,
      contentMeta.contentVersion,
      data.organizations[0]!.id,
      data.assessments.slice(0, 4).map((item) => item.id),
    );
    const metrics = computePortfolioMetrics(expected);
    await page.goto('portfolio');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      content.site.routes.portfolio.title,
    );
    await expect(page.getByText(copy.incompatible, { exact: true })).toBeVisible();
    const before = await saved(page);
    for (const [label, value] of [
      [copy.selected, metrics.selected],
      [copy.evaluated, metrics.evaluated],
      [copy.foundationsCount, metrics.sharedFoundations],
      [copy.gapsCount, metrics.gaps],
    ] as const)
      await expect(
        page
          .locator('dl > div')
          .filter({ has: page.locator('dt', { hasText: label }) })
          .locator('dd'),
      ).toHaveText(String(value));
    const matrix = page.getByRole('table', { name: copy.matrix, exact: true });
    for (const capability of expected.capabilities) {
      const row = matrix.getByRole('row').filter({
        has: page.getByRole('rowheader', { name: capability.capability.shortName, exact: true }),
      });
      await expect(row.getByRole('cell')).toHaveText([
        content.pillars.find((pillar) => pillar.id === capability.capability.pillar)!.requirement,
        ...expected.cases.map((item) => {
          const level = portfolioLevel(capability, item.assessment.id);
          return level === null ? '—' : mapping.levels[level];
        }),
      ]);
    }
    await expect(page.getByRole('table', { name: copy.table, exact: true })).toContainText(
      copy.unplotted,
    );
    expect(
      await page
        .getByRole('img', { name: new RegExp(copy.chart) })
        .locator('circle')
        .count(),
    ).toBe(2);
    await expect(page.getByText(content.site.readout.eligibility, { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('checkbox', { name: 'Fictional operations agent', exact: true }).uncheck();
    await expect(
      matrix.getByRole('columnheader', { name: 'Fictional operations agent', exact: true }),
    ).toHaveCount(0);
    expect(await saved(page)).toBe(before);
    await page.getByRole('button', { name: copy.clear, exact: true }).click();
    await expect(page.getByText(copy.selectionEmpty, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: copy.export, exact: true })).toBeDisabled();
    await page.getByRole('button', { name: copy.selectAll, exact: true }).click();
    await page
      .getByLabel(copy.organization, { exact: true })
      .selectOption(data.organizations[1]!.id);
    await expect(page.getByRole('table', { name: copy.table, exact: true })).toContainText(
      'Separate case',
    );
    await expect(page.getByRole('table', { name: copy.table, exact: true })).not.toContainText(
      'Fictional HR assistant',
    );
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      content.site.routes.portfolio.title,
    );
    expect(await saved(page)).toBe(before);
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: test.info().outputPath('portfolio-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: test.info().outputPath('portfolio-desktop.png'),
      fullPage: true,
    });
  });

  test('selected portfolio bundles preserve incompatible answers, import only as copies and respect cancellation', async ({
    page,
  }) => {
    const data = await seed(page);
    await page.goto('portfolio');
    await page.getByRole('checkbox', { name: 'Fictional operations agent', exact: true }).uncheck();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: copy.export, exact: true }).click();
    const file = test.info().outputPath('portfolio.json');
    await (await downloaded).saveAs(file);
    const raw = readFileSync(file, 'utf8');
    const parsed = parseDiagnosticBundle(raw);
    if (!parsed.ok) throw new Error('Invalid portfolio download');
    expect(parsed.bundle.workspace.organizations).toHaveLength(1);
    expect(parsed.bundle.workspace.assessments.map((item) => item.id)).toEqual([
      data.assessments[0]!.id,
      data.assessments[2]!.id,
      data.assessments[3]!.id,
    ]);
    expect(parsed.bundle.workspace.assessments[2]!.answers.retiredQuestion).toBe(
      'keep this answer',
    );
    const before = await saved(page);
    const input = page.locator('input[type="file"]');
    await input.setInputFiles(file);
    await page
      .getByRole('button', { name: content.site.readout.cancelImport, exact: true })
      .click();
    expect(await saved(page)).toBe(before);
    await input.setInputFiles(file);
    await page.getByRole('button', { name: content.site.readout.applyImport, exact: true }).click();
    await expect(page.getByRole('status')).toContainText(content.site.readout.importSuccess);
    const merged: DiagnosticWorkspace = JSON.parse((await saved(page))!);
    expect(merged.organizations).toHaveLength(3);
    expect(merged.assessments).toHaveLength(8);
    expect(merged.assessments.slice(0, 5)).toEqual(data.assessments);
    expect(merged.assessments[5]!.organizationId).toBe(merged.organizations[2]!.id);
    expect(merged.assessments[5]!.id).not.toBe(data.assessments[0]!.id);
    expect(merged.assessments[5]!.contentVersion).toBe('old-content');
    await page
      .getByLabel(copy.organization, { exact: true })
      .selectOption(merged.organizations[2]!.id);
    await expect(page.getByText(copy.incompatible, { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('presentation mode enlarges type, hides edits, exits with Escape and cleans up on navigation', async ({
    page,
  }) => {
    // Five pages, each with a full axe run, so this is long by design.
    test.setTimeout(90000);
    const data = await seed(page);
    for (const path of [
      'portfolio',
      'workshop',
      `diagnostic/${data.assessments[0]!.id}/readout`,
      `canvas/${data.assessments[0]!.id}`,
      'canvas/blank',
    ]) {
      await page.goto(path);
      if (path.endsWith('/readout'))
        await page
          .getByRole('button', { name: content.site.ui.depth.technical, exact: true })
          .click();
      const before = await saved(page);
      const heading = page.getByRole('heading', { level: 1 });
      const originalSize = await heading.evaluate((node) =>
        parseFloat(getComputedStyle(node).fontSize),
      );
      await page.getByRole('button', { name: presentation.enter, exact: true }).click();
      await expect(
        page.getByRole('button', { name: presentation.exit, exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('banner')).toBeHidden();
      expect(
        await heading.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
      ).toBeGreaterThan(originalSize);
      expect(await page.locator('input:visible, select:visible, textarea:visible').count()).toBe(0);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: presentation.enter, exact: true }),
      ).toBeFocused();
      await expect(page.getByRole('banner')).toBeVisible();
      expect(await saved(page)).toBe(before);
    }
    await page.goto('workshop');
    await page.getByRole('button', { name: presentation.enter, exact: true }).click();
    await page
      .getByRole('link', { name: content.site.routes.capability.title, exact: true })
      .first()
      .click();
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.locator('body')).not.toHaveAttribute('data-presentation-mode');
  });

  test('workshop exposes the full timed guide and paired printable card sets on A4 and Letter', async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.goto('workshop');
    await expect(
      page.getByText(
        renderTemplate(workshop.duration, { count: computeWorkshopMinutes(workshop.agenda) }),
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.locator('[data-pattern-card]')).toHaveCount(content.patterns.length);
    await expect(page.locator('[data-capability-card]')).toHaveCount(content.capabilities.length);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const initialStorage = await saved(page);
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    await page.evaluate(() => {
      window.print = () => {};
    });
    for (const [target, button] of [
      ['guide', workshop.printGuide],
      ['checklist', workshop.printChecklist],
      ['patterns', workshop.printPatterns],
      ['capabilities', workshop.printCapabilities],
    ] as const) {
      for (const format of ['A4', 'Letter'] as const) {
        await page.emulateMedia({ media: 'screen' });
        await page.getByRole('button', { name: button, exact: true }).click();
        await page.emulateMedia({ media: 'print' });
        await expect(page.locator(`[data-workshop-part="${target}"]`)).toBeVisible();
        for (const other of ['guide', 'checklist', 'patterns', 'capabilities'].filter(
          (item) => item !== target,
        ))
          await expect(page.locator(`[data-workshop-part="${other}"]`)).toBeHidden();
        const pdf = await page.pdf({ format });
        expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
        writeFileSync(test.info().outputPath(`workshop-${target}-${format}.pdf`), pdf);
      }
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      await expect(page.locator('[data-workshop-print]')).toHaveAttribute(
        'data-workshop-print',
        'all',
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: test.info().outputPath('workshop-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: test.info().outputPath('workshop-desktop.png'), fullPage: true });
    await page
      .locator('[data-capability-card]')
      .first()
      .screenshot({ path: test.info().outputPath('capability-card.png') });
    await page
      .locator('[data-pattern-card]')
      .first()
      .screenshot({ path: test.info().outputPath('pattern-card.png') });
    expect(await saved(page)).toBe(initialStorage);
    expect(failures).toEqual([]);
  });

  test('empty portfolios and invalid saved work show explicit guidance without creating storage', async ({
    page,
  }) => {
    await page.goto('portfolio');
    await expect(page.getByText(copy.empty, { exact: true })).toBeVisible();
    expect(await saved(page)).toBeNull();
    await expect(page.getByRole('button', { name: copy.export, exact: true })).toBeDisabled();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.evaluate((key) => localStorage.setItem(key, '{invalid'), key);
    await page.reload();
    await expect(page.getByRole('alert')).toContainText(content.site.diagnostic.storageInvalid);
    expect(await saved(page)).toBe('{invalid');
  });
});
