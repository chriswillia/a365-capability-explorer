import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { content, contentMeta } from './content.ts';
import { chooseDepth } from './view.ts';
import {
  evaluateAssessment,
  evaluatePatterns,
  patternAnswers,
} from '../src/lib/engine/evaluate.ts';

const { site } = content;
const copy = site.mapping;
const part = (page: Page, label: string) =>
  page
    .getByRole('navigation', { name: site.ui.views.label, exact: true })
    .getByRole('link', { name: label, exact: true });

test.describe('Phase 3 mapping', () => {
  test('matrix cells match the rule engine exactly under either base path', async ({ page }) => {
    await page.goto('patterns?view=compare');
    const table = page.getByRole('table', { name: copy.matrix });
    await expect(table.getByRole('row')).toHaveCount(content.capabilities.length + 1);
    const results = evaluatePatterns(content, contentMeta.contentVersion);
    for (const capability of content.capabilities) {
      const row = table
        .getByRole('row')
        .filter({ has: page.getByRole('rowheader', { name: capability.shortName, exact: true }) });
      const expected = results.map(({ result }) => {
        const match = result.inScope.find((r) => r.capability.id === capability.id);
        return match ? copy.levels[match.level] : site.capabilities.explorer.notApplicable;
      });
      const requirement = content.pillars.find((p) => p.id === capability.pillar)!.requirement;
      await expect(row.getByRole('cell')).toHaveText([requirement, ...expected]);
    }
    // The notices sit behind About this page.
    await page.getByText(site.ui.about.label, { exact: true }).click();
    await expect(page.getByText(copy.neutralNote)).toBeVisible();
  });
  test('pattern explanations, unknown readiness and technical tables are inspectable', async ({
    page,
  }) => {
    await page.goto('patterns/ai-teammate');
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: 'AI teammate', exact: true }),
    ).toBeVisible();
    const result = evaluateAssessment(
      content,
      patternAnswers(content, 'ai-teammate'),
      contentMeta.contentVersion,
    );
    const table = page.getByRole('table', { name: copy.inScope, exact: true });
    await expect(table.getByRole('row')).toHaveCount(result.inScope.length + 1);
    const row = table.getByRole('row').filter({
      has: page.getByRole('rowheader', { name: 'Agent observability & monitoring', exact: true }),
    });
    await row.locator('summary').click();
    await expect(
      row.getByText('Registration provides catalog visibility; telemetry needs instrumentation.'),
    ).toBeVisible();
    await part(page, copy.views.rollout).click();
    await expect(page.getByText(content.mappingConfig.licensingNote)).toBeVisible();
    await expect(page.getByText(copy.readinessNote)).toBeVisible();
    await part(page, copy.views.controls).click();
    await chooseDepth(page, 'technical');
    await part(page, copy.views.technical).click();
    await expect(page.getByRole('table', { name: copy.operatingModel })).toBeVisible();
    await part(page, copy.views.controls).click();
    await row.locator('summary').click();
    await expect(row.getByRole('link', { name: 'pro-code', exact: true })).toBeVisible();
    await row.getByRole('link', { name: 'pro-code', exact: true }).click();
    await expect(page).toHaveURL(/methodology#rule-pro-code$/);
    await expect(page.locator('#rule-pro-code')).toBeVisible();
  });
  test('risk and pattern lenses preserve generated membership after refresh', async ({ page }) => {
    for (const [lens, group] of [
      ['risk', 'shadow-ai'],
      ['pattern', 'local-agent'],
    ]) {
      await page.goto(`capabilities?lens=${lens}&group=${group}&view=table`);
      await page.reload();
      const expected =
        lens === 'risk'
          ? content.risks.find((r) => r.id === group)!.mitigatedBy
          : evaluateAssessment(
              content,
              patternAnswers(content, group!),
              contentMeta.contentVersion,
            ).inScope.map((r) => r.capability.id);
      const rows = page.getByRole('table').getByRole('rowheader');
      await expect(rows).toHaveCount(expected.length);
      for (const id of expected)
        await expect(
          rows.filter({ hasText: content.capabilities.find((c) => c.id === id)!.shortName }),
        ).toHaveCount(1);
    }
  });
  test('sample overrides load and invalid links do not masquerade as a valid pattern', async ({
    page,
  }) => {
    await page.goto('patterns/process-agent?sample=askhr');
    await expect(page.getByRole('heading', { level: 1, name: 'AskHR' })).toBeVisible();
    await page.locator('summary').filter({ hasText: copy.answers }).click();
    await expect(page.locator('dd').filter({ hasText: 'Employee data' })).toBeVisible();
    await page.goto('patterns/knowledge-agent?sample=askhr');
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.notFound.title }),
    ).toBeVisible();
    await page.goto('patterns/not-a-pattern');
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.notFound.title }),
    ).toBeVisible();
  });
  test('opening pattern results stores no assessment data and makes no third-party requests', async ({
    page,
    baseURL,
  }) => {
    const origins = new Set<string>();
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol.startsWith('http')) origins.add(url.origin);
    });
    for (const path of [
      'patterns',
      'patterns/ai-teammate',
      'patterns/process-agent?sample=askhr',
      'methodology',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    expect([...origins]).toEqual([new URL(baseURL!).origin]);
    const stored = await page.evaluate(() => ({
      local: localStorage.length,
      sessionKeys: Object.keys(sessionStorage),
      cookie: document.cookie,
    }));
    expect(stored.local).toBe(0);
    expect(stored.cookie).toBe('');
    // Existing React Router scroll restoration is not assessment persistence.
    expect(stored.sessionKeys.every((key) => key === 'react-router-scroll-positions')).toBe(true);
  });
  test('new pages contain no page-wide horizontal overflow on a narrow screen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [
      'patterns',
      'patterns?view=compare',
      'patterns/ai-teammate',
      'patterns/ai-teammate?view=risks',
      'patterns/ai-teammate?view=rollout',
      'patterns/local-agent',
      'methodology',
    ]) {
      await page.goto(path);
      await chooseDepth(page, 'technical');
      if (path.startsWith('patterns/') && !path.includes('view='))
        await page.locator('summary').filter({ hasText: copy.answers }).click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        path,
      ).toBe(true);
    }
    await page.goto('patterns?view=compare');
    const region = page.getByRole('region', { name: copy.matrix });
    await region.focus();
    await expect(region).toBeFocused();
  });
  test('expanded reason and readiness disclosures are keyboard accessible and axe-clean', async ({
    page,
  }) => {
    await page.goto('patterns/local-agent');
    await chooseDepth(page, 'technical');
    const disclosure = page
      .getByRole('table', { name: copy.inScope, exact: true })
      .locator('summary')
      .first();
    await disclosure.focus();
    await page.keyboard.press('Enter');
    await expect(disclosure.locator('..')).toHaveAttribute('open', '');
    await part(page, copy.views.rollout).click();
    const questions = page.locator('summary').filter({ hasText: copy.openQuestions });
    await questions.focus();
    await page.keyboard.press('Enter');
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
});
