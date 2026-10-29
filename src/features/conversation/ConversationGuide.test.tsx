import { FluentProvider } from '@fluentui/react-components';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, matchRoutes } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it } from 'vitest';
import { routes } from '../../app/routes.tsx';
import { requirementGuides } from '../../lib/content/conversation.ts';
import { content, pillarName } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { DEPTH_STORAGE_KEY } from '../../lib/state/depth.ts';
import { StateProviders } from '../../lib/state/StateProviders.tsx';
import { STORAGE_PREFIX } from '../../lib/state/storage.ts';
import { fluentTheme } from '../../theme/fluentTheme.ts';

const { site, conversation: copy } = content;

async function renderPage(path = '/patterns?view=conversation') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <FluentProvider theme={fluentTheme}>
      <StateProviders>
        <RouterProvider router={router} />
      </StateProviders>
    </FluentProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: site.routes.patterns.title });
  return router;
}

const guide = () => within(screen.getByRole('region', { name: copy.title }));
const area = (pillarId: string) =>
  document.getElementById(`requirement-${pillarId}`) as HTMLDetailsElement;

afterEach(() => window.localStorage.clear());

describe('customer conversation guide on the Scope an agent page', () => {
  it('opens with the introduction and the five steps in order', async () => {
    await renderPage();
    expect(guide().getByText(copy.introduction)).toBeInTheDocument();
    const items = within(guide().getByRole('list', { name: copy.stepsTitle })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(copy.steps.length);
    for (const [i, step] of copy.steps.entries()) {
      const item = within(items[i]!);
      expect(item.getByRole('heading', { level: 4, name: step.title })).toBeInTheDocument();
      expect(item.getByText(step.instruction)).toBeInTheDocument();
      if (step.action)
        expect(item.getByRole('link', { name: step.action.label })).toHaveAttribute(
          'href',
          step.action.to,
        );
    }
  });

  it('does not mark the guide as needing review in the Executive view', async () => {
    await renderPage();
    expect(guide().queryByText(site.ui.badges.draft)).not.toBeInTheDocument();
  });

  it('marks the guide as needing review in the Technical view', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}${DEPTH_STORAGE_KEY}`, 'technical');
    await renderPage();
    expect(guide().getByText(site.ui.badges.draft)).toBeInTheDocument();
  });

  it('covers each requirement area with its capabilities, questions, people and flags', async () => {
    await renderPage();
    for (const guideArea of requirementGuides(content)) {
      const section = within(area(guideArea.pillar.id));
      expect(section.getByText(guideArea.pillar.definition, { exact: false })).toBeInTheDocument();
      for (const capability of guideArea.capabilities)
        expect(section.getByRole('link', { name: capability.shortName })).toHaveAttribute(
          'href',
          `/capabilities/${capability.id}`,
        );
      expect(
        section.getByRole('heading', {
          level: 4,
          name: renderTemplate(copy.questionsLabel, { count: guideArea.questions.length }),
        }),
      ).toBeInTheDocument();
      for (const { question } of guideArea.questions)
        expect(section.getByText(question, { exact: false })).toBeInTheDocument();
      for (const { team, productAreas } of guideArea.people)
        expect(section.getByText(`${team} — ${productAreas.join(', ')}`)).toBeInTheDocument();
      expect(
        section.getByText(
          renderTemplate(copy.flagsTemplate, {
            premium: guideArea.premium,
            total: guideArea.total,
            notInGcc: guideArea.notInGcc,
          }),
        ),
      ).toBeInTheDocument();
      expect(
        section.getByRole('link', {
          name: renderTemplate(copy.browse, { label: pillarName(guideArea.pillar) }),
        }),
      ).toHaveAttribute('href', `/capabilities?pillar=${guideArea.pillar.id}`);
    }
  });

  it('keeps each requirement area closed, with a summary that counts what is inside', async () => {
    await renderPage();
    for (const { pillar, capabilities, questions } of requirementGuides(content)) {
      const panel = area(pillar.id);
      expect(panel).toBeInstanceOf(HTMLDetailsElement);
      expect(panel.open).toBe(false);
      expect(
        within(panel).getByText(
          renderTemplate(copy.areaSummary, {
            label: pillarName(pillar),
            count: capabilities.length,
            n: questions.length,
          }),
        ),
      ).toBeInTheDocument();
    }
  });

  it('opens the requirement area a link points at, and only that one', async () => {
    await renderPage('/patterns#requirement-secure');
    await waitFor(() => expect(area('secure').open).toBe(true));
    for (const { pillar } of requirementGuides(content))
      if (pillar.id !== 'secure') expect(area(pillar.id).open).toBe(false);
  });

  it('says how many myth-and-fact answers still need checking against their source, or that none do', async () => {
    await renderPage();
    const pending = content.faq.filter((item) => item.fact === null).length;
    const template = pending === 0 ? copy.assumptionsClear : copy.assumptionsNote;
    expect(
      screen.getByText(renderTemplate(template, { count: pending, total: content.faq.length })),
    ).toBeInTheDocument();
    expect(guide().getByRole('link', { name: copy.assumptionsLink })).toHaveAttribute(
      'href',
      '/learn#myths',
    );
  });

  it('counts the answers that are still unverified when one has no published fact', async () => {
    const entry = content.faq[0]!;
    const published = entry.fact;
    entry.fact = null;
    try {
      await renderPage();
      const pending = content.faq.filter((item) => item.fact === null).length;
      expect(
        screen.getByText(
          renderTemplate(copy.assumptionsNote, { count: pending, total: content.faq.length }),
        ),
      ).toBeInTheDocument();
    } finally {
      entry.fact = published;
    }
  });

  it('only links to pages that exist', async () => {
    await renderPage();
    const links = guide().getAllByRole('link');
    expect(links.length).toBeGreaterThan(10);
    for (const link of links) {
      const href = link.getAttribute('href')!;
      if (href.startsWith('#')) {
        expect(document.getElementById(href.slice(1)), href).not.toBeNull();
        continue;
      }
      const matches = matchRoutes(routes, href.split(/[?#]/)[0]!);
      expect(matches, href).not.toBeNull();
      const keys = matches!.flatMap((match) => {
        const key = (match.route.handle as { routeKey?: string } | undefined)?.routeKey;
        return key ? [key] : [];
      });
      expect(keys.length, href).toBeGreaterThan(0);
      expect(keys, href).not.toContain('notFound');
    }
  });

  it('ends with next steps that continue the work in the tool', async () => {
    await renderPage();
    const next = guide().getByRole('heading', { name: copy.nextTitle }).nextElementSibling;
    for (const item of copy.next)
      expect(within(next as HTMLElement).getByRole('link', { name: item.label })).toHaveAttribute(
        'href',
        item.to,
      );
  });
});

describe('the old conversation address', () => {
  it('lands on the guide on the Scope an agent page', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/conversation'] });
    render(
      <FluentProvider theme={fluentTheme}>
        <StateProviders>
          <RouterProvider router={router} />
        </StateProviders>
      </FluentProvider>,
    );
    await screen.findByRole('heading', { level: 1, name: site.routes.patterns.title });
    expect(router.state.location.pathname).toBe('/patterns');
    expect(router.state.location.search).toBe('?view=conversation');
    expect(router.state.location.hash).toBe('#conversation');
  });

  it('keeps the query string and a hash that points inside the guide', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/conversation?audience=security#requirement-secure'],
    });
    render(
      <FluentProvider theme={fluentTheme}>
        <StateProviders>
          <RouterProvider router={router} />
        </StateProviders>
      </FluentProvider>,
    );
    await screen.findByRole('heading', { level: 1, name: site.routes.patterns.title });
    expect(router.state.location.pathname).toBe('/patterns');
    expect(router.state.location.search).toBe('?audience=security&view=conversation');
    expect(router.state.location.hash).toBe('#requirement-secure');
  });
});

describe('the old Pitch address', () => {
  const open = async (path: string, heading: string) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    render(
      <FluentProvider theme={fluentTheme}>
        <StateProviders>
          <RouterProvider router={router} />
        </StateProviders>
      </FluentProvider>,
    );
    await screen.findByRole('heading', { level: 1, name: heading });
    return router;
  };

  it('leads to the capabilities, where a seller now starts', async () => {
    const router = await open('/pitch', site.routes.capabilities.title);
    expect(router.state.location.pathname).toBe('/capabilities');
  });

  it('leads a link to the conversation guide to Scope an agent', async () => {
    const router = await open('/pitch#conversation', site.routes.patterns.title);
    expect(router.state.location.pathname).toBe('/patterns');
    expect(router.state.location.search).toBe('?view=conversation');
  });

  it('leads a link to the pushback answers to Stack fit, and to the value brief to its own page', async () => {
    const fit = await open('/pitch#pushback', site.routes.fit.title);
    expect(fit.state.location.pathname).toBe('/fit');
    expect(fit.state.location.hash).toBe('#pushback');
    cleanup();
    const brief = await open('/pitch?view=brief&concerns=protect-data', site.routes.brief.title);
    expect(brief.state.location.pathname).toBe('/brief');
    expect(brief.state.location.search).toBe('?concerns=protect-data');
  });
});
