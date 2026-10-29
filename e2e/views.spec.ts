import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { content } from './content.ts';
import { chooseDepth } from './view.ts';
import { patternAnswers } from '../src/lib/engine/evaluate.ts';
import { readoutParts } from '../src/lib/readout/plan.ts';
import { emptyWorkspace } from '../src/lib/state/diagnostic-model.ts';

const { site, licensing, deploy, guardrails, workshop } = content;
const map = site.mapping;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

interface Part {
  /** The name in the address; the first part needs none. */
  id: string | null;
  label: string;
}

interface Long {
  path: string;
  title: string;
  /** The parts in the Executive view. */
  parts: Part[];
  /** The parts in the Technical view, when it has more. */
  technicalParts?: Part[];
  /** A page that shows saved work puts some in the browser first, and returns its address. */
  prepare?: (page: Page) => Promise<string>;
  /** How far down the page the first heading may start. A readout opens with its cover. */
  maxStart?: number;
  /** How many screens a part may be. A readout adds its cover and toolbar, about one more. */
  maxScreens?: number;
}

/**
 * Puts a fictional customer with agents in the browser, and returns the address of one agent's readout. The ids
 * are fixed, so it can be called more than once on the same page.
 */
async function saveAgents(page: Page): Promise<string> {
  const input = patternAnswers(content, 'process-agent', 'askhr');
  const data = emptyWorkspace();
  const entity = {
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    contentVersion: 'old-content',
  };
  const organization = {
    ...entity,
    id: '00000000-0000-4000-8000-000000000001',
    answers: { ...input.org, orgName: 'Fictional organization' },
  };
  data.organizations.push(organization);
  for (const [index, title] of ['Fictional HR assistant', 'Fictional operations agent'].entries())
    data.assessments.push({
      ...entity,
      id: `00000000-0000-4000-8000-00000000001${index}`,
      organizationId: organization.id,
      answers: { ...input.useCase, useCaseName: title, businessValue: '4', expectedUsers: 'lt-50' },
      mode: 'full',
      sectionId: 'review',
      patternId: 'process-agent',
      sampleId: 'askhr',
    });
  await page.addInitScript(
    ({ key, data }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(data));
    },
    { key: 'cpcompass:diagnostic', data },
  );
  return `diagnostic/${data.assessments[0]!.id}/readout`;
}

// The pages that show one part at a time, and the parts each one offers in the Executive view.
const LONG: Long[] = [
  {
    path: 'licensing',
    title: site.routes.licensing.title,
    parts: [
      { id: null, label: licensing.views.who },
      { id: 'size', label: licensing.views.size },
      { id: 'plans', label: licensing.views.plans },
      { id: 'needs', label: licensing.views.needs },
      { id: 'specialist', label: licensing.views.specialist },
    ],
  },
  {
    path: 'deploy',
    title: site.routes.deploy.title,
    parts: [
      ...guardrails.gates.map((gate, index) => ({
        id: index === 0 ? null : gate.id,
        label: gate.title,
      })),
      { id: 'plan', label: deploy.plan.heading },
    ],
  },
  {
    path: 'patterns',
    title: site.routes.patterns.title,
    parts: [
      { id: null, label: map.views.cards },
      { id: 'compare', label: map.views.compare },
      { id: 'conversation', label: map.views.conversation },
    ],
  },
  {
    path: 'patterns/ai-teammate',
    title: 'AI teammate',
    parts: [
      { id: null, label: map.views.controls },
      { id: 'risks', label: map.views.risks },
      { id: 'rollout', label: map.views.rollout },
    ],
    technicalParts: [
      { id: null, label: map.views.controls },
      { id: 'risks', label: map.views.risks },
      { id: 'rollout', label: map.views.rollout },
      { id: 'technical', label: map.views.technical },
    ],
  },
  {
    path: 'learn',
    title: site.routes.learn.title,
    parts: [
      { id: null, label: site.learn.views.fit },
      { id: 'works', label: site.learn.views.works },
      { id: 'journey', label: site.learn.views.journey },
      { id: 'glossary', label: site.learn.views.glossary },
    ],
  },
  {
    path: 'workshop',
    title: site.routes.workshop.title,
    parts: [
      { id: null, label: workshop.views.guide },
      { id: 'checklist', label: workshop.views.checklist },
      { id: 'patterns', label: workshop.views.patterns },
      { id: 'capabilities', label: workshop.views.capabilities },
    ],
    maxStart: 640,
  },
  {
    path: 'portfolio',
    title: site.routes.portfolio.title,
    parts: [
      { id: null, label: site.portfolio.views.compare },
      { id: 'foundations', label: site.portfolio.views.foundations },
      { id: 'readiness', label: site.portfolio.views.readiness },
    ],
    prepare: async (page) => {
      await saveAgents(page);
      return 'portfolio';
    },
    maxStart: 780,
  },
  {
    // The title is "Agent 365 readout — organization: agent", and a heading matches by the start of its name.
    path: 'readout',
    title: site.readout.title.split(' — ')[0]!,
    parts: readoutParts(false).map((part) => ({
      id: part.id === 'summary' ? null : part.id,
      label: site.readout.views[part.id],
    })),
    technicalParts: readoutParts(true).map((part) => ({
      id: part.id === 'summary' ? null : part.id,
      label: site.readout.views[part.id],
    })),
    prepare: saveAgents,
    maxStart: 1400,
    maxScreens: 6.5,
  },
];

const switcher = (page: Page) =>
  page.getByRole('navigation', { name: site.ui.views.label, exact: true });
const pager = (page: Page) =>
  page.getByRole('navigation', { name: site.ui.views.pagerLabel, exact: true });
const address = (path: string, part: Part) => (part.id === null ? path : `${path}?view=${part.id}`);
const violations = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations.map(
    (v) => `${v.impact} ${v.id}: ${v.help} e.g. ${v.nodes[0]?.html.slice(0, 120)}`,
  );
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('long pages show one part at a time', () => {
  // Accessibility does not depend on the base path, so these heavy checks run under one of the two.
  test.skip(
    ({ baseURL }) => new URL(baseURL!).pathname !== '/',
    'Checked once, under the root base path.',
  );

  for (const long of LONG) {
    test(`${long.path}: every part opens from its link and has no accessibility violations`, async ({
      page,
    }) => {
      await page.goto(long.prepare === undefined ? long.path : await long.prepare(page));
      await expect(page.getByRole('heading', { level: 1, name: long.title })).toBeVisible();
      await expect(switcher(page).getByRole('link')).toHaveText(long.parts.map((p) => p.label));
      for (const part of long.parts) {
        await switcher(page).getByRole('link', { name: part.label, exact: true }).click();
        await expect(
          switcher(page).getByRole('link', { name: part.label, exact: true }),
        ).toHaveAttribute('aria-current', 'true');
        await expect(page).toHaveURL(
          new RegExp(part.id === null ? `${long.path}$` : `view=${part.id}$`),
        );
        expect(await violations(page), `${long.path} › ${part.label}`).toEqual([]);
      }
    });

    test(`${long.path}: every part has no violations in the Technical view`, async ({ page }) => {
      const path = long.prepare === undefined ? long.path : await long.prepare(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: long.title })).toBeVisible();
      await chooseDepth(page, 'technical');
      for (const part of long.technicalParts ?? long.parts) {
        await page.goto(address(path, part));
        await expect(
          switcher(page).getByRole('link', { name: part.label, exact: true }),
        ).toHaveAttribute('aria-current', 'true');
        expect(await violations(page), `${long.path} › ${part.label} (Technical)`).toEqual([]);
      }
    });
  }
});

test.describe('addresses that point into a long page', () => {
  const links: [string, string, string][] = [
    ['patterns#conversation', 'conversation', map.views.conversation],
    ['patterns#team', 'team', map.views.conversation],
    ['patterns#requirement-govern', 'requirement-govern', map.views.conversation],
    ['patterns#compare', 'compare', map.views.compare],
    ['learn#myths', 'myths', site.learn.views.fit],
    ['learn#concepts', 'concepts', site.learn.views.works],
    ['learn#roles', 'roles', site.learn.views.journey],
    ['learn#glossary-sdk', 'glossary-sdk', site.learn.views.glossary],
    ['workshop#checklist', 'checklist', workshop.views.checklist],
    ['workshop#cards-secure', 'cards-secure', workshop.views.capabilities],
    ['licensing#calculator', 'calculator', licensing.views.size],
    ['licensing#plans', 'plans', licensing.views.plans],
    ['licensing#requirements', 'requirements', licensing.views.needs],
    ['licensing#regulated', 'regulated', licensing.views.specialist],
    ['licensing#handoff', 'handoff', licensing.views.specialist],
    ['patterns/ai-teammate#in-scope', 'in-scope', map.views.controls],
  ];

  for (const [path, id, label] of links) {
    test(`${path} lands on its section, in the part that holds it`, async ({ page }) => {
      await page.goto(path);
      await expect(switcher(page).getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'aria-current',
        'true',
      );
      await expect(page.locator(`#${id}`)).toBeVisible();
      await expect(page.locator(`#${id}`)).toBeInViewport();
    });
  }

  test('a link into a section of another part says which part in the address and keeps the section', async ({
    page,
  }) => {
    await page.goto('licensing#calculator');
    await expect(page).toHaveURL(/licensing\?view=size#calculator$/);
  });

  test('a link to a requirement area opens it', async ({ page }) => {
    await page.goto('patterns#requirement-secure');
    await expect(page.locator('#requirement-secure')).toHaveJSProperty('open', true);
    await expect(page.locator('#requirement-govern')).toHaveJSProperty('open', false);
  });

  test('a link to an exhibit of a readout opens the part that holds it, with the exhibit in view', async ({
    page,
  }) => {
    const readout = await saveAgents(page);
    for (const [key, label] of [
      ['exhibit-anatomy', site.readout.views.controls],
      ['exhibit-guardrails', site.readout.views.golive],
      ['exhibit-licensing', site.readout.views.next],
    ] as const) {
      await page.goto(`${readout}#${key}`);
      await expect(switcher(page).getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'aria-current',
        'true',
      );
      await expect(page.locator(`#${key} h2`)).toBeInViewport();
    }
  });
});

test.describe('moving between parts', () => {
  test('the Next and Previous links step through the parts, and focus follows to the top', async ({
    page,
  }) => {
    await page.goto('patterns');
    await pager(page)
      .getByRole('link', { name: `${site.ui.views.next}: ${map.views.compare}` })
      .click();
    await expect(page).toHaveURL(/patterns\?view=compare$/);
    await expect(
      switcher(page).getByRole('link', { name: map.views.compare, exact: true }),
    ).toBeFocused();
    await expect(page.getByRole('heading', { level: 2, name: map.matrix })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/patterns$/);
    await expect(
      page.getByRole('heading', { level: 2, name: content.patterns[0]!.title }),
    ).toBeVisible();
  });

  test('the first part has no Previous link and the last has no Next link', async ({ page }) => {
    await page.goto('licensing');
    await expect(
      pager(page).getByRole('link', { name: new RegExp(site.ui.views.previous) }),
    ).toHaveCount(0);
    await page.goto('licensing?view=specialist');
    await expect(
      pager(page).getByRole('link', { name: new RegExp(site.ui.views.next) }),
    ).toHaveCount(0);
    await expect(
      pager(page).getByRole('link', { name: new RegExp(site.ui.views.previous) }),
    ).toBeVisible();
  });

  test('the numbers typed into the license calculator survive a look at another part', async ({
    page,
  }) => {
    await page.goto('licensing?view=size');
    const people = licensing.calculator.people.delegating.label;
    await page.getByLabel(people).fill('250');
    await switcher(page).getByRole('link', { name: licensing.views.plans, exact: true }).click();
    await expect(page.getByLabel(people)).toBeHidden();
    await switcher(page).getByRole('link', { name: licensing.views.size, exact: true }).click();
    await expect(page.getByLabel(people)).toHaveValue('250');
  });
});

test.describe('no part is a long scroll', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.skip(
    ({ baseURL }) => new URL(baseURL!).pathname !== '/',
    'Checked once, under the root base path.',
  );

  for (const long of LONG) {
    test(`${long.path}: every part is at most five screens, and its content starts near the top`, async ({
      page,
    }) => {
      const path = long.prepare === undefined ? long.path : await long.prepare(page);
      for (const technical of [false, true]) {
        if (technical && long.technicalParts === undefined) continue;
        if (technical) {
          await page.goto(path);
          await chooseDepth(page, 'technical');
        }
        for (const part of (technical ? long.technicalParts : long.parts)!) {
          const where = `${long.path} › ${part.label}${technical ? ' (Technical)' : ''}`;
          await page.goto(address(path, part));
          await expect(
            switcher(page).getByRole('link', { name: part.label, exact: true }),
          ).toHaveAttribute('aria-current', 'true');
          const { height, start } = await page.evaluate(() => {
            const main = document.querySelector('main')!;
            const first = [...main.querySelectorAll('h2')].find((h) => h.offsetParent !== null);
            return {
              height: main.getBoundingClientRect().height,
              start: first ? first.getBoundingClientRect().top + window.scrollY : Infinity,
            };
          });
          expect(height, `${where} is ${Math.round(height / 800)} screens`).toBeLessThanOrEqual(
            (long.maxScreens ?? 5) * 800,
          );
          expect(start, `${where} starts ${Math.round(start)}px down`).toBeLessThanOrEqual(
            long.maxStart ?? 520,
          );
        }
      }
    });
  }

  for (const path of ['capabilities', 'fit']) {
    test(`${path}: the page is at most five screens`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const height = await page.evaluate(
        () => document.querySelector('main')!.getBoundingClientRect().height,
      );
      expect(height, `${path} is ${Math.round(height / 800)} screens`).toBeLessThanOrEqual(5 * 800);
    });
  }
});

test.describe('the parts on a small screen', () => {
  for (const width of [320, 390]) {
    test(`the part links wrap without scrolling sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const long of LONG) {
        await page.goto(long.prepare === undefined ? long.path : await long.prepare(page));
        await expect(switcher(page)).toBeVisible();
        expect(await noOverflow(page), `${long.path} at ${width}px`).toBe(true);
        for (const link of await switcher(page).getByRole('link').all()) {
          const box = await link.boundingBox();
          expect(box!.height, `${long.path} link height`).toBeGreaterThanOrEqual(24);
        }
      }
    });
  }
});
