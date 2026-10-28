import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { content, contentMeta } from './content.ts';
import { chooseDepth } from './view.ts';
import { patternAnswers } from '../src/lib/engine/evaluate.ts';
import { exhibitId, exhibitPlan, type ExhibitKey } from '../src/lib/readout/plan.ts';
import { buildReadout } from '../src/lib/readout/report.ts';
import { emptyWorkspace, type DiagnosticWorkspace } from '../src/lib/state/diagnostic-model.ts';
import { MAX_IMPORT_BYTES, parseDiagnosticBundle } from '../src/lib/state/diagnostic-transfer.ts';
import { colors } from '../src/theme/tokens.ts';

declare global {
  interface Window {
    pptxPreview: typeof import('pptx-preview');
    slideRenderer: ReturnType<(typeof import('pptx-preview'))['init']>;
  }
}

const copy = content.site.readout;
const diagnostic = content.site.diagnostic;
const storageKey = 'cpcompass:diagnostic';

async function seed(page: Page, incompatible = false, dense = false) {
  const input = patternAnswers(content, 'process-agent', 'askhr');
  if (dense) {
    input.useCase.businessOutcome = 'A long fictional business outcome for the local layout check. '
      .repeat(34)
      .slice(0, 2000);
    for (const question of content.questions.filter((q) => q.type === 'multi')) {
      const answers = question.scope === 'org' ? input.org : input.useCase;
      answers[question.id] = question.options
        .filter((o) => !['none', 'unknown'].includes(o.value))
        .map((o) => o.value);
    }
  }
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
      successMeasures: 'Reduce handling time from ten minutes to five; review after the pilot.',
      accountableOwner: 'Fictional operations team',
      preparedBy: 'Fictional preparer',
      preparedOn: '2026-10-26',
      engagementName: 'Fictional planning review',
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

// Sharing options, the logo editor and backup sit behind closed sections; open one before using what is inside.
async function open(page: Page, summary: string) {
  const label = page.locator('summary', { hasText: summary }).first();
  await label.waitFor();
  if ((await label.locator('..').getAttribute('open')) === null) await label.click();
}

test.describe('Phase 5 readouts and portable assessments', () => {
  test('readout resumes, recomputes current results, copies summary and compares without saving', async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);
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
    const executive = exhibitPlan(false);
    for (const [key, title] of Object.entries(copy.exhibits))
      await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(
        executive.includes(key as ExhibitKey) ? 1 : 0,
      );
    const contents = page.getByRole('navigation', { name: copy.contents });
    await expect(contents.getByRole('link')).toHaveCount(executive.length);
    await contents.getByRole('link', { name: copy.exhibits.licensing, exact: true }).click();
    await expect(page).toHaveURL(/#exhibit-licensing$/);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, copy.moreShare);
    await page.getByRole('button', { name: copy.copySummary }).click();
    await expect(page.getByRole('status')).toContainText(copy.copied);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain(report.summary[0]);
    expect(clipboard).toContain(content.site.disclaimer);
    const before = await saved(page);
    await chooseDepth(page, 'technical');
    for (const title of Object.values(copy.exhibits))
      await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(1);
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
      writeFileSync(test.info().outputPath(`technical-readout-${format}.pdf`), pdf);
      await test
        .info()
        .attach(`technical-readout-${format}.pdf`, { body: pdf, contentType: 'application/pdf' });
    }
    await expect(page.getByRole('navigation', { name: content.site.ui.mainNavLabel })).toBeHidden();
  });

  for (const [name, size] of [
    ['wide', { width: 1280, height: 800 }],
    ['phone', { width: 390, height: 800 }],
  ] as const) {
    test(`Contents links bring each section's heading into view, clear of the toolbar (${name})`, async ({
      page,
    }) => {
      test.setTimeout(90000);
      await page.setViewportSize(size);
      const { assessment } = await seed(page);
      await page.goto(`diagnostic/${assessment.id}/readout`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const contents = page.getByRole('navigation', { name: copy.contents });
      for (const key of exhibitPlan(false)) {
        if ((await contents.locator('details').getAttribute('open')) === null)
          await contents.locator('summary').click();
        await contents.getByRole('link', { name: copy.exhibits[key], exact: true }).click();
        const heading = page.locator(`#${exhibitId(key)} h2`);
        await expect(heading, key).toBeInViewport();
        // Nothing, such as the sticky toolbar, sits on top of the heading.
        const covered = await heading.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          const top = document.elementFromPoint(rect.left + 4, rect.top + rect.height / 2);
          return top !== null && !node.contains(top);
        });
        expect(covered, key).toBe(false);
      }
    });
  }

  test('assessment JSON round trips as copies, and cancel never changes local data', async ({
    page,
  }, testInfo) => {
    const { assessment } = await seed(page);
    await page.goto(`diagnostic/${assessment.id}/readout`);
    await open(page, copy.moreShare);
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
    await open(page, diagnostic.backup);
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
    await open(page, diagnostic.backup);
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
    await open(page, copy.moreShare);
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

  test('local logos normalize, persist, export and remove without accepting SVG or oversized images', async ({
    page,
  }, testInfo) => {
    const { assessment } = await seed(page);
    await page.goto(`diagnostic/${assessment.id}/readout`);
    await open(page, copy.addLogo);
    const before = await saved(page);
    await page.getByLabel(copy.branding.alt, { exact: true }).fill('Fictional logo');
    for (const [name, mimeType, buffer, message] of [
      ['logo.svg', 'image/svg+xml', Buffer.from('<svg/>'), copy.branding.errors.format],
      ['big.png', 'image/png', Buffer.alloc(2 * 1024 * 1024 + 1), copy.branding.errors.size],
      ['broken.png', 'image/png', Buffer.from('not a PNG'), copy.branding.errors.format],
    ] as const) {
      await page
        .getByLabel(copy.branding.choose, { exact: true })
        .setInputFiles({ name, mimeType, buffer });
      await expect(page.getByRole('alert')).toContainText(message);
      expect(await saved(page)).toBe(before);
    }
    const jpeg = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      return canvas.toDataURL('image/jpeg').split(',')[1]!;
    });
    await page.getByLabel(copy.branding.choose, { exact: true }).setInputFiles({
      name: 'fictional.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(jpeg, 'base64'),
    });
    await expect(page.getByRole('img', { name: 'Fictional logo', exact: true })).toBeVisible();
    const data: DiagnosticWorkspace = JSON.parse((await saved(page))!);
    expect(data.assessments[0]!.logo).toMatchObject({
      width: 512,
      height: 256,
      alt: 'Fictional logo',
    });
    expect(data.assessments[0]!.logo!.data).toMatch(/^data:image\/png;base64,/);
    await page.reload();
    await expect(page.getByRole('img', { name: 'Fictional logo', exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const downloading = page.waitForEvent('download');
    await open(page, copy.moreShare);
    await page.getByRole('button', { name: copy.json, exact: true }).click();
    const path = testInfo.outputPath('branded-assessment.json');
    await (await downloading).saveAs(path);
    const parsed = parseDiagnosticBundle(readFileSync(path, 'utf8'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('Invalid branded export');
    expect(parsed.bundle.workspace.assessments[0]!.logo).toEqual(data.assessments[0]!.logo);
    await page.goto('diagnostic');
    await open(page, diagnostic.more);
    await page.getByRole('button', { name: diagnostic.duplicate, exact: true }).click();
    const duplicated: DiagnosticWorkspace = JSON.parse((await saved(page))!);
    const duplicate = duplicated.assessments.find((item) => item.id !== assessment.id);
    if (!duplicate) throw new Error('Missing duplicated assessment');
    expect(duplicate.logo).toEqual(data.assessments[0]!.logo);
    await page.goto(`diagnostic/${duplicate.id}/readout`);
    await open(page, copy.addLogo);
    await page.getByLabel(copy.branding.alt, { exact: true }).fill('Duplicated logo');
    const edited: DiagnosticWorkspace = JSON.parse((await saved(page))!);
    expect(edited.assessments.find((item) => item.id === assessment.id)!.logo!.alt).toBe(
      'Fictional logo',
    );
    await page.goto(`canvas/${assessment.id}`);
    await expect(page.getByRole('img', { name: 'Fictional logo', exact: true })).toBeVisible();
    await expect(page.getByText('Fictional operations team', { exact: true })).toBeVisible();
    await expect(
      page.getByText(String(data.assessments[0]!.answers.successMeasures), { exact: true }),
    ).toBeVisible();
    await page.goto(`diagnostic/${assessment.id}/readout`);
    await page.getByRole('button', { name: copy.branding.remove, exact: true }).click();
    await expect(page.getByRole('img', { name: 'Fictional logo', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: copy.branding.remove, exact: true })).toHaveCount(
      0,
    );
  });

  test('PowerPoint downloads contain eight readout slides or one populated/blank canvas slide, with local previews', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(90000);
    const { assessment } = await seed(page, false, true);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`diagnostic/${assessment.id}/readout`);
    await open(page, copy.addLogo);
    await page.getByLabel(copy.branding.alt, { exact: true }).fill('Fictional layout-check logo');
    const image = await page.evaluate((colors) => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 160;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Missing canvas context');
      context.fillStyle = colors.ink;
      context.fillRect(0, 0, 400, 160);
      context.fillStyle = colors.white;
      context.font = '42px Segoe UI';
      context.fillText('FICTIONAL', 40, 95);
      return canvas.toDataURL('image/png').split(',')[1]!;
    }, colors);
    await page.getByLabel(copy.branding.choose, { exact: true }).setInputFiles({
      name: 'fictional.png',
      mimeType: 'image/png',
      buffer: Buffer.from(image, 'base64'),
    });
    await expect(
      page.getByRole('img', { name: 'Fictional layout-check logo', exact: true }),
    ).toBeVisible();
    for (const [route, count, name] of [
      [`diagnostic/${assessment.id}/readout`, 8, 'readout'],
      [`canvas/${assessment.id}`, 1, 'canvas'],
      ['canvas/blank', 1, 'blank-canvas'],
    ] as const) {
      await page.goto(route);
      const downloading = page.waitForEvent('download');
      await page.getByRole('button', { name: copy.powerpoint, exact: true }).click();
      const download = await downloading;
      expect(download.suggestedFilename()).toMatch(/\.pptx$/);
      const path = testInfo.outputPath(`${name}.pptx`);
      await download.saveAs(path);
      const bytes = readFileSync(path);
      const zip = await JSZip.loadAsync(bytes);
      expect(
        Object.keys(zip.files).filter((file) => /^ppt\/slides\/slide\d+\.xml$/.test(file)),
      ).toHaveLength(count);
      expect(
        Object.keys(zip.files).filter((file) =>
          /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(file),
        ),
      ).toHaveLength(count);
      await expect(page.getByRole('button', { name: copy.powerpoint, exact: true })).toBeEnabled();
      if (name !== 'readout') {
        await page.emulateMedia({ media: 'print' });
        for (const format of ['A4', 'Letter'] as const) {
          const pdf = await page.pdf({ format, landscape: true });
          writeFileSync(testInfo.outputPath(`${name}-${format}.pdf`), pdf);
          await testInfo.attach(`${name}-${format}.pdf`, {
            body: pdf,
            contentType: 'application/pdf',
          });
          expect([...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)]).toHaveLength(1);
        }
        await page.emulateMedia({ media: 'screen' });
      }
      const preview = await context.newPage();
      try {
        await preview.setViewportSize({ width: 1100, height: 750 });
        await preview.setContent(
          '<style>.pptx-preview-wrapper > [class^="pptx-preview-wrapper-"] { visibility: hidden; }</style><main id="slide-preview" style="width:960px;height:540px"></main>',
        );
        await preview.addScriptTag({
          path: resolve('node_modules/pptx-preview/dist/pptx-preview.umd.js'),
        });
        await preview.evaluate(
          async ({ base64, count }) => {
            const node = document.getElementById('slide-preview');
            if (!node) throw new Error('Missing preview container');
            const renderer = window.pptxPreview.init(node, {
              width: 960,
              height: 540,
              mode: 'slide',
            });
            window.slideRenderer = renderer;
            const buffer = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;
            await renderer.preview(buffer);
            if (renderer.slideCount !== count)
              throw new Error(
                `Unexpected rendered slide count: ${renderer.slideCount}, expected ${count}; themes=${renderer.pptx.themes.length}, layouts=${renderer.pptx.slideLayouts.length}, masters=${renderer.pptx.slideMaster.length}`,
              );
          },
          { base64: bytes.toString('base64'), count },
        );
        for (let i = 0; i < count; i++) {
          await preview.evaluate((index) => window.slideRenderer.renderSingleSlide(index), i);
          await preview
            .locator('#slide-preview')
            .screenshot({ path: testInfo.outputPath(`${name}-slide-${i + 1}.png`) });
        }
      } finally {
        await preview.close();
      }
    }
    expect(errors).toEqual([]);
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
