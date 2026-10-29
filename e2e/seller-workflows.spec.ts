import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { content } from './content.ts';
import { patternAnswers } from '../src/lib/engine/evaluate.ts';
import { talkTrackText } from '../src/lib/content/talk-track.ts';
import { emptyWorkspace } from '../src/lib/state/diagnostic-model.ts';

declare global {
  interface Window {
    pptxPreview: typeof import('pptx-preview');
  }
}

const { site, passport, leaveBehind, deploy, licensing, value, fit } = content;
const sample = site.ui.sample;
const storageKey = 'cpcompass:diagnostic';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Saves a fictional customer with one agent before the page loads. A dense agent is the fullest one: every
 * multiple-choice question answered with every option, and at the scaling stage, which brings in a third gate.
 */
async function seed(page: Page, dense = false) {
  const input = patternAnswers(content, 'process-agent', 'askhr');
  if (dense) {
    input.useCase.stage = 'scaling';
    input.useCase.businessOutcome = 'A long fictional business outcome for the layout check. '
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
    answers: { ...input.org, orgName: 'Fictional workflow customer' },
  };
  const assessment = {
    ...entity,
    id: crypto.randomUUID(),
    organizationId: organization.id,
    answers: { ...input.useCase, useCaseName: 'Fictional workflow agent' },
    mode: 'quick' as const,
    sectionId: 'profile',
    patternId: 'process-agent',
    sampleId: null,
  };
  data.organizations.push(organization);
  data.assessments.push(assessment);
  await page.addInitScript(
    ({ key, value: saved }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(saved));
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
const pageCount = (pdf: Buffer) =>
  [...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
// Windows puts CRLF line endings on the clipboard; the text itself uses LF.
const clipboard = async (page: Page) =>
  (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');

test.describe('sample customer', () => {
  test('goes from Home to a leave-behind in two clicks, and marks the sample wherever it shows', async ({
    page,
  }) => {
    await page.goto('./');
    const region = page.getByRole('region', { name: sample.heading });
    await expect(region.getByRole('button', { name: sample.load })).toBeVisible();
    await region.getByRole('button', { name: sample.load }).click();

    await expect(page).toHaveURL(/\/map\?assessment=[0-9a-f-]{36}#passport-heading$/);
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.map.title }),
    ).toBeVisible();
    const result = page.getByRole('region', { name: passport.result.heading });
    await expect(result.getByText(sample.chip)).toBeVisible();
    await expect(page.getByRole('banner').getByText(sample.chip)).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await result.getByRole('link', { name: passport.result.actions.leaveBehind }).click();
    await expect(page).toHaveURL(/\/leave-behind\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.leaveBehind.title }),
    ).toBeVisible();
    const sheet = page.locator('[data-print-document]');
    await expect(sheet).toContainText(sample.customerName);
    await expect(sheet).toContainText(sample.chip);
    expect(await violations(page)).toEqual([]);
  });

  test('is reset or removed from Home, and removing it updates the whole page at once', async ({
    page,
  }) => {
    await page.goto('./');
    const region = page.getByRole('region', { name: sample.heading });
    await region.getByRole('button', { name: sample.load }).click();
    await expect(page).toHaveURL(/\/map\?assessment=/);
    await page.getByRole('link', { name: site.ui.homeLinkLabel, exact: true }).click();

    const recent = page.getByRole('region', { name: site.overview.recent.heading });
    await expect(recent.getByText(sample.customerName)).toBeVisible();
    await expect(recent.getByText(sample.chip)).toBeVisible();
    await expect(page.getByRole('banner').getByText(sample.chip)).toBeVisible();

    await region.getByRole('button', { name: sample.reset }).click();
    await expect(region.getByText(sample.resetDone)).toBeVisible();
    await expect(recent.getByText(sample.customerName)).toBeVisible();

    await region.getByRole('button', { name: sample.remove }).click();
    await expect(region.getByText(sample.removed)).toBeVisible();
    await expect(recent).toHaveCount(0);
    await expect(page.getByRole('banner').getByText(sample.chip)).toHaveCount(0);
    await expect(region.getByRole('button', { name: sample.load })).toBeVisible();
    expect(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), storageKey),
    ).toMatchObject({ organizations: [], assessments: [] });
  });
});

test.describe('scoping from an example agent', () => {
  test('goes from an example to its leave-behind in two clicks, with the example answers marked as assumed', async ({
    page,
  }) => {
    await page.goto('patterns/customer-agent');
    // Opening the example saves nothing.
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
    await page.getByRole('button', { name: site.mapping.use.button }).click();

    await expect(page).toHaveURL(/\/map\?assessment=[0-9a-f-]{36}$/);
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.map.title }),
    ).toBeVisible();
    await expect(page.getByText(passport.assumed.badge)).toHaveCount(passport.questions.length);
    const result = page.getByRole('region', { name: passport.result.heading });
    await expect(result).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await result.getByRole('link', { name: passport.result.actions.leaveBehind }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.leaveBehind.title }),
    ).toBeVisible();
    // The header link goes back to the agent from any page for it.
    await page
      .getByRole('banner')
      .getByRole('link', { name: new RegExp(`^${site.ui.working.label}:`) })
      .click();
    await expect(page.getByRole('region', { name: passport.result.heading })).toBeInViewport();
  });

  test('adds a second example to the same customer, or starts a new one, as the seller chooses', async ({
    page,
  }) => {
    await page.goto('patterns/customer-agent');
    await page.getByRole('button', { name: site.mapping.use.button }).click();
    await expect(page.getByRole('region', { name: passport.result.heading })).toBeVisible();

    await page.goto('patterns/knowledge-agent');
    const customer = page.getByLabel(site.mapping.use.customerLabel);
    await expect(customer).toBeVisible();
    await page.getByRole('button', { name: site.mapping.use.button }).click();
    await expect(page.getByRole('region', { name: passport.result.heading })).toBeVisible();
    let saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
    expect(saved.organizations).toHaveLength(1);
    expect(saved.assessments).toHaveLength(2);
    // With two agents for one customer, the passport offers to compare them.
    await expect(
      page.getByRole('link', { name: passport.result.actions.portfolio, exact: true }),
    ).toBeVisible();

    await page.goto('patterns/local-agent');
    await page.getByLabel(site.mapping.use.customerLabel).selectOption({
      label: site.mapping.use.newCustomer,
    });
    await page.getByRole('button', { name: site.mapping.use.button }).click();
    await expect(page.getByRole('region', { name: passport.result.heading })).toBeVisible();
    saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
    expect(saved.organizations).toHaveLength(2);
    expect(saved.assessments).toHaveLength(3);
  });

  test('offers six questions for an agent no example looks like', async ({ page }) => {
    await page.goto('patterns');
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.patterns.title }),
    ).toBeVisible();
    await page.getByRole('link', { name: site.mapping.startBlankCta, exact: true }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.map.title }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: passport.result.heading })).toHaveCount(0);
  });
});

test.describe('agent passport', () => {
  test('turns six answers into a passport that survives a reload and keeps names out of the address', async ({
    page,
  }) => {
    await page.goto('map');
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.map.title }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: passport.result.heading })).toHaveCount(0);
    await page.getByLabel(passport.setup.customerNameLabel).fill('Fictional Passport Customer');
    await page.getByLabel(passport.setup.agentLabel).fill('Fictional passport agent');

    for (const ask of passport.questions) {
      const question = content.questions.find((q) => q.id === ask.id)!;
      const option = question.options.find((o) => o.value !== 'unknown')!;
      if (question.type === 'multi')
        await page
          .getByRole('group', { name: new RegExp(ask.ask.replace('?', '\\?')) })
          .getByRole('checkbox', { name: option.label, exact: true })
          .check();
      else await page.getByRole('combobox', { name: ask.ask }).selectOption(option.value);
    }

    const result = page.getByRole('region', { name: passport.result.heading });
    await expect(result).toBeVisible();
    for (const heading of [
      passport.result.accessHeading,
      passport.result.controlsHeading,
      passport.result.mustHaveHeading,
      passport.result.licenseHeading,
    ])
      await expect(result.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page).toHaveURL(/\/map\?assessment=[0-9a-f-]{36}$/);
    expect(page.url()).not.toContain('Fictional');
    expect(await violations(page)).toEqual([]);

    await page.reload();
    await expect(page.getByRole('region', { name: passport.result.heading })).toBeVisible();
    await expect(page.getByLabel(passport.setup.agentLabel)).toHaveValue(
      'Fictional passport agent',
    );
    for (const action of [
      'licensing',
      'deploy',
      'leaveBehind',
      'readout',
      'canvas',
      'discovery',
    ] as const)
      await expect(
        page
          .getByRole('region', { name: passport.result.heading })
          .getByRole('link', { name: passport.result.actions[action], exact: true }),
      ).toBeVisible();
  });

  test('says so for an agent that is not saved, and starts a new one', async ({ page }) => {
    await page.goto('map?assessment=00000000-0000-4000-8000-000000000000');
    await expect(page.getByText(passport.setup.missing)).toBeVisible();
    await expect(page.getByRole('region', { name: passport.result.heading })).toHaveCount(0);
  });
});

test.describe('leave-behind', () => {
  test('prints on one page, A4 and Letter, even for an agent with every answer filled in', async ({
    page,
  }) => {
    const assessment = await seed(page, true);
    await page.goto(`leave-behind/${assessment.id}`);
    const sheet = page.locator('[data-print-document]');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Fictional workflow agent');
    await expect(sheet).toContainText('Fictional workflow customer');
    expect(await violations(page)).toEqual([]);

    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('button', { name: leaveBehind.toolbar.print })).toBeHidden();
    await expect(page.getByRole('banner')).toBeHidden();
    await expect(sheet).toBeVisible();
    for (const format of ['A4', 'Letter'] as const)
      expect(pageCount(await page.pdf({ format })), format).toBe(1);
  });

  test('downloads three slides, each with its own notes, that a slide renderer opens', async ({
    page,
    context,
  }, testInfo) => {
    const assessment = await seed(page, true);
    await page.goto(`leave-behind/${assessment.id}`);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: leaveBehind.toolbar.powerpoint }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(`${leaveBehind.deck.fileName}.pptx`);
    const path = testInfo.outputPath('leave-behind.pptx');
    await download.saveAs(path);
    const bytes = readFileSync(path);
    const zip = await JSZip.loadAsync(bytes);
    const files = Object.keys(zip.files);
    expect(files.filter((file) => /^ppt\/slides\/slide\d+\.xml$/.test(file))).toHaveLength(3);
    expect(
      files.filter((file) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(file)),
    ).toHaveLength(3);
    const first = await zip.file('ppt/slides/slide1.xml')!.async('string');
    expect(first).toContain('Fictional workflow agent');
    await expect(page.getByRole('button', { name: leaveBehind.toolbar.powerpoint })).toBeEnabled();

    const preview = await context.newPage();
    try {
      await preview.setContent('<main id="slide-preview" style="width:960px;height:540px"></main>');
      await preview.addScriptTag({
        path: resolve('node_modules/pptx-preview/dist/pptx-preview.umd.js'),
      });
      const rendered = await preview.evaluate(async (base64) => {
        const node = document.getElementById('slide-preview')!;
        const renderer = window.pptxPreview.init(node, { width: 960, height: 540, mode: 'slide' });
        await renderer.preview(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer);
        return renderer.slideCount;
      }, bytes.toString('base64'));
      expect(rendered).toBe(3);
    } finally {
      await preview.close();
    }
  });

  test('loads for an address nobody saved, and says the agent is missing', async ({ page }) => {
    await page.goto('leave-behind/00000000-0000-4000-8000-000000000000');
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.leaveBehind.title }),
    ).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: leaveBehind.missing })).toBeVisible();
  });
});

test.describe('deploy', () => {
  test('shows the gates, why, what to do and how to prove it, and a 30, 60 and 90 day plan', async ({
    page,
  }) => {
    const assessment = await seed(page);
    await page.goto(`deploy?assessment=${assessment.id}`);
    await expect(
      page.getByRole('heading', { level: 1, name: site.routes.deploy.title }),
    ).toBeVisible();
    await expect(page.getByLabel(deploy.assessmentLabel)).toHaveValue(assessment.id);
    const views = page.getByRole('navigation', { name: site.ui.views.label, exact: true });
    for (const gate of content.guardrails.gates) {
      await views.getByRole('link', { name: gate.title }).click();
      await expect(page.getByRole('heading', { level: 2, name: gate.title })).toBeVisible();
      await expect(page.getByText(deploy.baseline.proveLabel).first()).toBeVisible();
    }

    await views.getByRole('link', { name: deploy.plan.heading }).click();
    const plan = page.getByRole('region', { name: deploy.plan.heading });
    const table = plan.getByRole('table');
    await expect(table.getByRole('row')).toHaveCount(deploy.plan.periods.length + 1);
    expect(await violations(page)).toEqual([]);
  });

  test('shows every step before an agent is chosen, and says why', async ({ page }) => {
    await page.goto('deploy');
    await expect(page.getByText(deploy.noAssessmentNote)).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});

test.describe('licensing calculator', () => {
  test('sizes the licenses from the numbers entered, copies them as Markdown and stores nothing', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const copy = licensing.calculator;
    await page.goto('licensing#calculator');
    const calculator = page.locator('#calculator');
    await expect(calculator.getByText(copy.waiting)).toBeVisible();

    await calculator.getByLabel(copy.people.delegating.label, { exact: true }).fill('100');
    await calculator.getByLabel(copy.people.owners.label, { exact: true }).fill('20');
    await calculator.getByLabel(copy.people.overlap.label, { exact: true }).fill('5');
    const required = calculator
      .locator('dl > div')
      .filter({ has: page.locator('dt', { hasText: copy.results.required.label }) });
    await expect(required).toContainText('115');

    await calculator.getByRole('button', { name: copy.copy }).click();
    await expect(calculator.getByText(copy.copied)).toBeVisible();
    const text = await clipboard(page);
    expect(text).toContain(copy.export.title);
    expect(text).toContain('115');
    expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).not.toContain(
      '115',
    );
    expect(await violations(page)).toEqual([]);

    await calculator.getByRole('button', { name: copy.reset }).click();
    await expect(calculator.getByText(copy.waiting)).toBeVisible();
  });
});

test.describe('pushback', () => {
  test('answers the pushback on the stack fit page, each answer behind its question', async ({
    page,
  }) => {
    await page.goto('fit#pushback');
    const section = page.locator('#pushback');
    await expect(
      section.getByRole('heading', { level: 2, name: value.objections.heading }),
    ).toBeVisible();
    await expect(section).toBeInViewport();
    for (const item of value.objections.items) {
      const details = section.locator('details', { hasText: item.objection });
      await expect(details).toHaveJSProperty('open', false);
      await details.locator(':scope > summary').click();
      await expect(details.getByText(item.answer)).toBeVisible();
    }
    expect(await violations(page)).toEqual([]);
  });
});

test.describe('capability talk track', () => {
  test('copies what to say and what to ask', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const capability = content.capabilities.find((c) => (c.discoveryQuestions?.length ?? 0) > 0)!;
    const copy = site.capabilities.brief;
    await page.goto(`capabilities/${capability.id}`);
    const card = page.getByRole('region', { name: copy.talkTrack });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: copy.copyTalkTrack }).click();
    await expect(card.getByText(copy.talkTrackCopied)).toBeVisible();
    expect(await clipboard(page)).toBe(talkTrackText(content, capability));
    expect(await violations(page)).toEqual([]);
  });
});

test.describe('stack fit, connected platforms', () => {
  test('lists every connected platform with its observability status and the limits', async ({
    page,
  }) => {
    await page.goto('fit#connected');
    const section = page.locator('#connected');
    const table = section.getByRole('table');
    await expect(table.getByRole('row')).toHaveCount(fit.connected.rows.length + 1);
    for (const row of fit.connected.rows)
      await expect(table.getByRole('rowheader', { name: row.platform })).toBeVisible();
    for (const limit of fit.connected.limits)
      await expect(section.getByText(limit, { exact: false })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});

test.describe('hosting', () => {
  test('the workflow pages load every asset from the base path and call no other site', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const assessment = await seed(page);
    const origins = new Set<string>();
    const failures: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin);
    });
    page.on('response', (response) => {
      // The 404.html fallback answers a deep link with HTTP 404 on GitHub Pages; assets must not.
      if (response.request().resourceType() !== 'document' && response.status() >= 400)
        failures.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) => failures.push(`failed ${request.url()}`));
    for (const path of [
      'map',
      `map?assessment=${assessment.id}`,
      'deploy',
      `deploy?assessment=${assessment.id}`,
      'licensing',
      'brief',
      'fit',
      `leave-behind/${assessment.id}`,
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    expect(failures).toEqual([]);
    expect([...origins]).toEqual([new URL(baseURL as string).origin]);
  });
});

test.describe('narrow screens', () => {
  for (const width of [320, 360, 390]) {
    test(`the workflow pages fit ${width}px without horizontal scrolling`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 800 });
      const assessment = await seed(page, true);
      for (const path of [
        'map',
        `map?assessment=${assessment.id}`,
        'deploy',
        `deploy?assessment=${assessment.id}`,
        `leave-behind/${assessment.id}`,
        'licensing#calculator',
        'licensing?view=plans',
        'licensing?view=needs',
        'licensing?view=specialist',
        'brief',
        'patterns?view=conversation',
        'deploy?view=production',
        'deploy?view=plan',
        'patterns?view=compare',
        'patterns/ai-teammate?view=risks',
        'patterns/ai-teammate?view=rollout',
        'fit#connected',
        'fit#pushback',
      ]) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(await noOverflow(page), `${path} at ${width}px`).toBe(true);
      }
    });
  }
});
