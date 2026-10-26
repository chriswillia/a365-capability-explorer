import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  CONTENT_FILES,
  ChangelogEntrySchema,
  type Content,
  type ContentMeta,
} from '../src/lib/content/schemas.ts';
import { patternAnswers } from '../src/lib/engine/evaluate.ts';
import { buildReadout } from '../src/lib/readout/report.ts';
import { emptyWorkspace, type DiagnosticWorkspace } from '../src/lib/state/diagnostic-model.ts';
import { MAX_IMPORT_BYTES, parseDiagnosticBundle } from '../src/lib/state/diagnostic-transfer.ts';
import { z } from 'zod';

const compiled = (key: string): unknown =>
  JSON.parse(readFileSync(`src/generated/${key}.json`, 'utf8'));
const content = {
  ...Object.fromEntries(
    Object.entries(CONTENT_FILES).map(([key, { schema }]) => [key, schema.parse(compiled(key))]),
  ),
  changelog: z.array(ChangelogEntrySchema).parse(compiled('changelog')),
} as Content;
const contentMeta = compiled('meta') as ContentMeta;

const copy = content.site.readout;
const diagnostic = content.site.diagnostic;
const storageKey = 'cpcompass:diagnostic';

async function seed(page: Page, incompatible = false) {
  const input = patternAnswers(content, 'process-agent', 'askhr');
  const data = emptyWorkspace();
  const now = new Date().toISOString();
  const entity = { createdAt: now, updatedAt: now, contentVersion: 'old-content' };
  const organization = {
    ...entity,
    id: crypto.randomUUID(),
    answers: { ...input.org, orgName: 'Fictional readout organization' },
  };
  const assessment = {
    ...entity,
    id: crypto.randomUUID(),
    organizationId: organization.id,
    answers: {
      ...input.useCase,
      useCaseName: 'Fictional saved readout',
      ...(incompatible ? { retiredQuestion: 'old answer' } : {}),
    },
    mode: 'full' as const,
    sectionId: 'review',
    patternId: 'process-agent',
    sampleId: 'askhr',
  };
  data.organizations.push(organization);
  data.assessments.push(assessment);
  await page.addInitScript(
    ({ key, data }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(data));
    },
    { key: storageKey, data },
  );
  return { data, organization, assessment };
}

const saved = (page: Page) => page.evaluate((key) => localStorage.getItem(key), storageKey);

test.describe('Phase 5 readouts and portable assessments', () => {
  test('readout resumes, recomputes current results, copies summary and compares without saving', async ({
    page,
    context,
  }) => {
    const { organization, assessment } = await seed(page);
    const report = buildReadout(content, organization, assessment, contentMeta.contentVersion);
    await page.goto('diagnostic');
    await page.getByRole('link', { name: copy.open, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(report.title);
    await expect(page).toHaveURL(new RegExp(`diagnostic/${assessment.id}/readout$`));
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(report.title);
    for (const line of report.summary)
      await expect(page.getByText(line, { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: copy.copySummary }).click();
    await expect(page.getByRole('status')).toContainText(copy.copied);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain(report.summary[0]);
    expect(clipboard).toContain(content.site.disclaimer);
    const before = await saved(page);
    await page.getByRole('button', { name: content.site.ui.depth.technical, exact: true }).click();
    await page
      .getByLabel(content.site.mapping.whatIfs, { exact: true })
      .selectOption(content.whatIfs[0]!.id);
    await expect(
      page.getByRole('heading', { name: content.whatIfs[0]!.title, exact: true }),
    ).toBeVisible();
    expect(await saved(page)).toBe(before);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.emulateMedia({ media: 'print' });
    for (const format of ['A4', 'Letter'] as const) {
      const pdf = await page.pdf({ format });
      expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
      expect(pdf.length).toBeGreaterThan(10000);
    }
    await expect(page.getByRole('navigation', { name: content.site.ui.mainNavLabel })).toBeHidden();
  });

  test('assessment JSON round trips as copies, and cancel never changes local data', async ({
    page,
  }, testInfo) => {
    const { assessment } = await seed(page);
    await page.goto(`diagnostic/${assessment.id}/readout`);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: copy.json, exact: true }).click();
    const download = await downloadPromise;
    const path = testInfo.outputPath('assessment.json');
    await download.saveAs(path);
    const raw = readFileSync(path, 'utf8');
    const parsed = parseDiagnosticBundle(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('Downloaded assessment failed validation');
    expect(parsed.bundle.workspace.assessments).toHaveLength(1);
    expect(parsed.bundle.workspace.organizations).toHaveLength(1);
    await page.goto('diagnostic');
    const before = await saved(page);
    await expect(page.locator('#diagnostic-import')).toHaveAccessibleName(copy.import);
    await page.locator('#diagnostic-import').setInputFiles(path);
    await expect(page.getByRole('button', { name: copy.applyImport })).toBeVisible();
    expect(await saved(page)).toBe(before);
    await page.getByRole('button', { name: copy.cancelImport }).click();
    expect(await saved(page)).toBe(before);
    await page.locator('#diagnostic-import').setInputFiles(path);
    await page.getByRole('button', { name: copy.applyImport }).click();
    await expect(page.getByText(copy.importSuccess, { exact: true })).toBeVisible();
    const data: DiagnosticWorkspace = JSON.parse((await saved(page))!);
    expect(data.assessments).toHaveLength(2);
    expect(data.organizations).toHaveLength(2);
    expect(data.assessments[0]!.id).toBe(assessment.id);
    expect(data.assessments[1]!.id).not.toBe(assessment.id);
    expect(data.assessments[1]!.organizationId).toBe(data.organizations[1]!.id);
    await page.reload();
    await expect(page.getByRole('link', { name: copy.open, exact: true })).toHaveCount(2);
  });

  test('malformed and oversized imports leave local data untouched and show explicit errors', async ({
    page,
  }) => {
    await seed(page);
    await page.goto('diagnostic');
    const before = await saved(page);
    for (const [buffer, message] of [
      [Buffer.from('{broken'), copy.importErrors.json],
      [Buffer.from('{"formatVersion":99}'), copy.importErrors.format],
      [Buffer.alloc(MAX_IMPORT_BYTES + 1, ' '), copy.importErrors.size],
    ] as const) {
      await page
        .locator('#diagnostic-import')
        .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer });
      await expect(page.getByRole('alert')).toContainText(message);
      expect(await saved(page)).toBe(before);
      await expect(page.getByRole('button', { name: copy.applyImport })).toHaveCount(0);
    }
  });

  test('Markdown includes version, answers, evidence and the disclaimer', async ({
    page,
  }, testInfo) => {
    const { assessment } = await seed(page);
    await page.goto(`diagnostic/${assessment.id}/readout`);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: copy.markdown }).click();
    const path = testInfo.outputPath('readout.md');
    await (await downloadPromise).saveAs(path);
    const text = readFileSync(path, 'utf8');
    for (const expected of [
      contentMeta.contentVersion,
      'Fictional saved readout',
      copy.draft,
      copy.roadmap,
      content.site.disclaimer,
    ])
      expect(text).toContain(expected);
  });

  test('filled and blank canvases are accessible, fit mobile and print one blank page on both paper sizes', async ({
    page,
  }) => {
    const { assessment } = await seed(page);
    await page.goto(`canvas/${assessment.id}`);
    await expect(page.getByRole('heading', { level: 1, name: copy.canvas })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 320, height: 740 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('link', { name: copy.blankCanvas, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: copy.canvas })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.emulateMedia({ media: 'print' });
    for (const format of ['A4', 'Letter'] as const) {
      const pdf = await page.pdf({ format, landscape: true });
      expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
      expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
    }
  });

  test('incompatible saved answers block readouts and canvases; blank canvas needs no storage', async ({
    page,
  }) => {
    const { assessment } = await seed(page, true);
    for (const path of [`diagnostic/${assessment.id}/readout`, `canvas/${assessment.id}`]) {
      await page.goto(path);
      await expect(page.getByRole('alert')).toContainText(diagnostic.incompatible);
    }
    await page.evaluate((key) => localStorage.setItem(key, '{broken'), storageKey);
    await page.goto('canvas/blank');
    await expect(page.getByRole('heading', { level: 1, name: copy.canvas })).toBeVisible();
    expect(await saved(page)).toBe('{broken');
  });
});
