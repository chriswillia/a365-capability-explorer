import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { content } from './content.ts';
import { chooseDepth } from './view.ts';

const { site, value, licensing, deploy, guardrails } = content;
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
  parts: Part[];
}

// The pages that show one part at a time, and the parts each one offers in the Executive view.
const LONG: Long[] = [
  {
    path: 'pitch',
    title: site.routes.pitch.title,
    parts: [
      { id: null, label: value.views.say },
      { id: 'prepare', label: value.views.prepare },
      { id: 'run', label: value.views.run },
      { id: 'brief', label: value.views.brief },
    ],
  },
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
      await page.goto(long.path);
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
      await page.goto(long.path);
      await expect(page.getByRole('heading', { level: 1, name: long.title })).toBeVisible();
      await chooseDepth(page, 'technical');
      const parts =
        long.path === 'patterns/ai-teammate'
          ? [...long.parts, { id: 'technical', label: map.views.technical }]
          : long.parts;
      for (const part of parts) {
        await page.goto(address(long.path, part));
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
    ['pitch#pitch', 'pitch', value.views.say],
    ['pitch#pushback', 'pushback', value.views.prepare],
    ['pitch#questions', 'questions', value.views.prepare],
    ['pitch#conversation', 'conversation', value.views.run],
    ['pitch#requirement-govern', 'requirement-govern', value.views.run],
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
    await page.goto('pitch#requirement-secure');
    await expect(page.locator('#requirement-secure')).toHaveJSProperty('open', true);
    await expect(page.locator('#requirement-govern')).toHaveJSProperty('open', false);
  });
});

test.describe('moving between parts', () => {
  test('the Next and Previous links step through the parts, and focus follows to the top', async ({
    page,
  }) => {
    await page.goto('pitch');
    await pager(page)
      .getByRole('link', { name: `${site.ui.views.next}: ${value.views.prepare}` })
      .click();
    await expect(page).toHaveURL(/pitch\?view=prepare$/);
    await expect(
      switcher(page).getByRole('link', { name: value.views.prepare, exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole('heading', { level: 2, name: value.objections.heading }),
    ).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/pitch$/);
    await expect(page.getByRole('heading', { level: 2, name: value.pitch.heading })).toBeVisible();
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
      for (const part of long.parts) {
        await page.goto(address(long.path, part));
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
        expect(
          height,
          `${long.path} › ${part.label} is ${Math.round(height / 800)} screens`,
        ).toBeLessThanOrEqual(5 * 800);
        expect(
          start,
          `${long.path} › ${part.label} starts ${Math.round(start)}px down`,
        ).toBeLessThanOrEqual(520);
      }
    });
  }
});

test.describe('the parts on a small screen', () => {
  for (const width of [320, 390]) {
    test(`the part links wrap without scrolling sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const long of LONG) {
        await page.goto(long.path);
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
