import { FluentProvider } from '@fluentui/react-components';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it } from 'vitest';
import { content, contentMeta, metrics, values } from '../lib/content/index.ts';
import { renderTemplate } from '../lib/content/template.ts';
import { DEPTH_STORAGE_KEY } from '../lib/state/depth.ts';
import { StateProviders } from '../lib/state/StateProviders.tsx';
import { STORAGE_PREFIX } from '../lib/state/storage.ts';
import { fluentTheme } from '../theme/fluentTheme.ts';
import '../features/explorer/CapabilitiesPage.tsx';
import '../features/explorer/CapabilityPage.tsx';
import '../features/value/ValuePage.tsx';
import { routes } from './routes.tsx';

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <FluentProvider theme={fluentTheme}>
      <StateProviders>
        <RouterProvider router={router} />
      </StateProviders>
    </FluentProvider>,
  );
  return router;
}

const { site } = content;

describe('layout shell', () => {
  it('has the landmarks, the footer stamp and the mandated disclaimer on every page', async () => {
    renderApp();
    expect(
      await screen.findByRole('heading', { level: 1, name: site.productName }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText(renderTemplate(site.ui.footer.stamp, values))).toBeInTheDocument();
    expect(screen.getByText(site.disclaimer)).toBeInTheDocument();
    expect(screen.getByText(site.independenceNotice)).toBeInTheDocument();
    expect(screen.getByText(contentMeta.contentVersion)).toBeInTheDocument();
  });

  it('shows no site-wide preview banner above the header', async () => {
    renderApp();
    const header = await screen.findByRole('banner');
    expect(header.previousElementSibling?.className ?? '').not.toMatch(/banner/i);
    expect(within(header).queryByText(/preview/i)).not.toBeInTheDocument();
  });

  it('keeps the disclaimer wording the brief requires', () => {
    expect(site.disclaimer).toBe(
      'Guidance tool for planning conversations. Not an official Microsoft licensing determination. Confirm with the Microsoft Agent 365 service description, the Microsoft Product Terms and your Microsoft account team.',
    );
  });

  it('lists the four jobs in order, keeps the rest under Library, and also links Methodology in the footer', async () => {
    renderApp();
    const nav = await screen.findByRole('navigation', { name: site.ui.mainNavLabel });
    const jobs = ['overview', 'pitch', 'map', 'licensing'] as const;
    const library = [
      'fit',
      'access',
      'capabilities',
      'patterns',
      'learn',
      'portfolio',
      'workshop',
      'methodology',
    ] as const;
    // A closed menu hides its links from the accessibility tree, so ask for them explicitly.
    const links = within(nav).getAllByRole('link', { hidden: true });
    expect(links.map((l) => l.textContent)).toEqual(
      [...jobs, ...library].map((key) => site.ui.nav[key]),
    );
    const summary = within(nav).getByText(site.ui.nav.library);
    expect(summary.tagName).toBe('SUMMARY');
    const menu = summary.closest('details') as HTMLElement;
    for (const key of library)
      expect(
        within(menu).getByRole('link', { name: site.ui.nav[key], hidden: true }),
      ).toBeInTheDocument();
    for (const key of jobs)
      expect(within(menu).queryByRole('link', { name: site.ui.nav[key], hidden: true })).toBeNull();
    expect(within(nav).getByRole('link', { name: site.ui.nav.overview })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: site.ui.nav.map })).toHaveAttribute(
      'href',
      '/diagnostic',
    );
    expect(
      within(screen.getByRole('contentinfo')).getByRole('link', { name: site.ui.nav.methodology }),
    ).toHaveAttribute('href', '/methodology');
  });

  it('opens the Library menu, closes it on Escape and after a page change, and marks it current', async () => {
    renderApp();
    const nav = await screen.findByRole('navigation', { name: site.ui.mainNavLabel });
    const summary = within(nav).getByText(site.ui.nav.library);
    const menu = summary.closest('details') as HTMLDetailsElement;
    expect(menu.open).toBe(false);
    await userEvent.click(summary);
    expect(menu.open).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(menu.open).toBe(false);
    expect(summary).toHaveFocus();

    await userEvent.click(summary);
    await userEvent.click(within(nav).getByRole('link', { name: site.ui.nav.capabilities }));
    await screen.findByRole('heading', { level: 1, name: site.routes.capabilities.title });
    const afterNavigation = within(
      await screen.findByRole('navigation', { name: site.ui.mainNavLabel }),
    ).getByText(site.ui.nav.library);
    expect((afterNavigation.closest('details') as HTMLDetailsElement).open).toBe(false);
  });

  it('explains the detail-level switch to everyone who uses it', async () => {
    renderApp();
    const group = await screen.findByRole('group', { name: site.ui.depth.groupLabel });
    expect(group).toHaveAccessibleDescription(site.ui.depth.hint);
    expect(screen.getByText(site.ui.depth.label)).toBeInTheDocument();
  });

  it('offers a skip link as the first focusable element', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1 });
    await userEvent.tab();
    expect(screen.getByRole('link', { name: site.ui.skipToContent })).toHaveFocus();
  });

  it('moves focus to the new page heading after navigating', async () => {
    renderApp();
    await userEvent.click(await screen.findByRole('link', { name: site.ui.nav.pitch }));
    const heading = await screen.findByRole('heading', {
      level: 1,
      name: site.routes.pitch.title,
    });
    // Focus moves in an effect after the new page renders, so the heading can exist a moment before it has focus.
    await waitFor(() => expect(heading).toHaveFocus());
    expect(document.title).toBe(`${site.routes.pitch.title} · ${site.productName}`);
  });

  it('shows a page-not-found message for an unknown address', async () => {
    renderApp('/no/such/page');
    expect(
      await screen.findByRole('heading', { level: 1, name: site.routes.notFound.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(site.ui.notFound.body)).toBeInTheDocument();
  });

  it('shows a coming-soon page, with its own copy, for a section still in development', async () => {
    renderApp('/whats-new');
    expect(
      await screen.findByRole('heading', { level: 1, name: site.routes.whatsNew.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(site.routes.whatsNew.description)).toBeInTheDocument();
    expect(screen.getByText(site.ui.comingSoon.status)).toBeInTheDocument();
  });
});

describe('Executive | Technical toggle', () => {
  it('starts in Executive and remembers a switch to Technical in local storage', async () => {
    renderApp('/capabilities');
    const group = await screen.findByRole('group', { name: site.ui.depth.groupLabel });
    const executive = within(group).getByRole('button', { name: site.ui.depth.executive });
    const technical = within(group).getByRole('button', { name: site.ui.depth.technical });
    expect(executive).toHaveAttribute('aria-pressed', 'true');
    expect(technical).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(technical);
    expect(technical).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}${DEPTH_STORAGE_KEY}`)).toBe('technical');
  });

  it('restores the saved choice on the next visit', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}${DEPTH_STORAGE_KEY}`, 'technical');
    renderApp();
    const group = await screen.findByRole('group', { name: site.ui.depth.groupLabel });
    expect(within(group).getByRole('button', { name: site.ui.depth.technical })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('Overview', () => {
  it('opens with the pitch and map actions, then one tile for each job', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1 });
    const { overview } = site;
    expect(screen.getByRole('link', { name: overview.ctaPrimary })).toHaveAttribute(
      'href',
      '/pitch',
    );
    expect(
      screen
        .getAllByRole('link', { name: overview.ctaSecondary })
        .map((a) => a.getAttribute('href')),
    ).toContain('/diagnostic');
    const jobs = within(screen.getByRole('region', { name: overview.jobs.heading }));
    const tiles = jobs.getAllByRole('listitem');
    expect(tiles).toHaveLength(overview.jobs.tiles.length);
    for (const [index, tile] of overview.jobs.tiles.entries()) {
      const item = within(tiles[index]!);
      expect(item.getByText(tile.question)).toBeInTheDocument();
      expect(item.getByRole('heading', { level: 3, name: tile.title })).toBeInTheDocument();
      expect(item.getByRole('link', { name: tile.cta })).toHaveAttribute('href', tile.to);
    }
    expect(screen.getByText(overview.jobs.libraryNote)).toBeInTheDocument();
  });

  it('keeps the catalog numbers, the role starts and the Frontier journey off the home page', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(site.capabilities.glance.kpis[0]!.label)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: site.learn.sections.roles }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: site.learn.sections.frontier }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows no recent customers before the first one is saved', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1 });
    expect(
      screen.queryByRole('heading', { name: site.overview.recent.heading }),
    ).not.toBeInTheDocument();
  });
});

describe('Capabilities page', () => {
  const explorer = site.capabilities.explorer;
  const pillarLabel = (id: string) =>
    renderTemplate(site.capabilities.pillarName, {
      requirement: content.pillars.find((p) => p.id === id)!.requirement,
      label: content.pillars.find((p) => p.id === id)!.label,
    });

  it('filters through URL state, changes views and supports browser history', async () => {
    const router = renderApp('/capabilities?lens=layer&group=data&view=cards');
    await screen.findByRole('heading', { level: 1, name: site.routes.capabilities.title });
    const expected = content.capabilities.filter((c) => c.controlPoints.includes('data'));
    expect(screen.getAllByRole('checkbox')).toHaveLength(expected.length);
    await userEvent.selectOptions(screen.getByLabelText(explorer.view), 'matrix');
    expect(router.state.location.search).toContain('view=matrix');
    expect(await screen.findByRole('table')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: explorer.reset }));
    expect(router.state.location.search).not.toContain('group=');
    expect(screen.getAllByRole('checkbox')).toHaveLength(content.capabilities.length);
  });

  it('groups capabilities under Observability, Governance and Security, with counts', async () => {
    renderApp('/capabilities?view=table');
    for (const pillar of content.pillars) {
      const heading = await screen.findByRole('heading', {
        level: 2,
        name: pillarLabel(pillar.id),
      });
      const section = heading.closest('section') as HTMLElement;
      expect(within(section).getAllByRole('rowheader')).toHaveLength(metrics.byPillar[pillar.id]);
      expect(
        within(section).getByText(
          renderTemplate(explorer.groupCount, { count: metrics.byPillar[pillar.id] }),
        ),
      ).toBeInTheDocument();
    }
    expect(screen.getAllByRole('table')).toHaveLength(content.pillars.length);
    const chips = within(screen.getByRole('group', { name: explorer.pillarFilter }));
    expect(
      chips.getByRole('button', {
        name: renderTemplate(explorer.pillarChip, {
          label: explorer.allPillars,
          count: content.capabilities.length,
        }),
      }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters by requirement area chip, product area, licensing and GCC, and shows the counts', async () => {
    const router = renderApp('/capabilities?view=table');
    const chips = within(await screen.findByRole('group', { name: explorer.pillarFilter }));
    await userEvent.click(
      chips.getByRole('button', {
        name: renderTemplate(explorer.pillarChip, {
          label: pillarLabel('secure'),
          count: metrics.secureCount,
        }),
      }),
    );
    expect(router.state.location.search).toBe('?pillar=secure&view=table');
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getAllByRole('rowheader')).toHaveLength(metrics.secureCount);
    await userEvent.selectOptions(screen.getByLabelText(explorer.gcc), 'unavailable');
    await userEvent.selectOptions(screen.getByLabelText(explorer.licensing), 'premium');
    await userEvent.selectOptions(screen.getByLabelText(explorer.productArea), 'Purview');
    expect(router.state.location.search).toBe(
      '?pillar=secure&console=Purview&licensing=premium&gcc=unavailable&view=table',
    );
    const expected = content.capabilities.filter(
      (c) =>
        c.pillar === 'secure' &&
        c.source.console === 'Purview' &&
        !c.source.includedWithBasePlans &&
        !c.source.gccAvailable,
    );
    expect(expected.length).toBeGreaterThan(0);
    expect(screen.getAllByRole('rowheader')).toHaveLength(expected.length);
    expect(screen.getByRole('status')).toHaveTextContent(
      renderTemplate(explorer.results, { ...values, count: expected.length }),
    );
    await userEvent.click(screen.getByRole('button', { name: explorer.reset }));
    expect(router.state.location.search).toBe('?view=table');
  });

  it('shows cards by default, with every filter beyond area and search behind "More filters"', async () => {
    const router = renderApp('/capabilities');
    await screen.findByRole('heading', { level: 1, name: site.routes.capabilities.title });
    expect(screen.getAllByRole('checkbox')).toHaveLength(content.capabilities.length);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByLabelText(explorer.view)).toHaveValue('cards');
    const summary = screen.getByText(explorer.more, { selector: 'summary' });
    const drawer = summary.closest('details') as HTMLDetailsElement;
    expect(drawer.open).toBe(false);
    for (const label of [explorer.productArea, explorer.licensing, explorer.gcc, explorer.setup])
      expect(drawer.contains(screen.getByLabelText(label))).toBe(true);
    await userEvent.selectOptions(screen.getByLabelText(explorer.gcc), 'unavailable');
    expect(router.state.location.search).toBe('?gcc=unavailable');
    expect(
      screen.getByText(renderTemplate(explorer.moreActive, { count: 1 }), { selector: 'summary' }),
    ).toBeInTheDocument();
    expect((summary.closest('details') as HTMLDetailsElement).open).toBe(true);
  });

  it('groups by product area when asked, and keeps links written for the console lens working', async () => {
    renderApp('/capabilities?lens=console&group=Entra&view=table');
    const heading = await screen.findByRole('heading', {
      level: 2,
      name: content.consoles.find((c) => c.id === 'Entra')!.displayName,
    });
    expect(
      within(heading.closest('section') as HTMLElement).getAllByRole('rowheader'),
    ).toHaveLength(metrics.byConsole.Entra);
    expect(screen.getByLabelText(explorer.groupBy)).toHaveValue('console');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers a filter for words a seller uses but the catalog does not contain', async () => {
    const router = renderApp('/capabilities?view=table');
    const search = await screen.findByLabelText(explorer.search);
    await userEvent.type(search, 'SIEM');
    expect(screen.getByText(explorer.empty)).toBeInTheDocument();
    expect(screen.getByText(explorer.emptyGuidance)).toBeInTheDocument();
    const layer = content.controlPoints.find((p) => p.id === 'oversight')!;
    const expected = content.capabilities.filter((c) => c.controlPoints.includes('oversight'));
    await userEvent.click(
      screen.getByRole('button', {
        name: renderTemplate(explorer.shortcutLabel, {
          label: `${explorer.lenses.layer}: ${layer.layer}`,
          count: expected.length,
        }),
      }),
    );
    expect(router.state.location.search).toBe('?lens=layer&group=oversight&view=table');
    expect(screen.getAllByRole('rowheader')).toHaveLength(expected.length);
    expect(screen.getByLabelText(explorer.search)).toHaveValue('');
  });

  it('says once, and only in the Technical view, that summaries need review instead of marking every row', async () => {
    renderApp('/capabilities?view=table');
    await screen.findAllByRole('table');
    const note = renderTemplate(explorer.draftSummary, {
      draft: content.capabilities.length,
      total: content.capabilities.length,
    });
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    expect(screen.queryByText(site.ui.badges.draft)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: site.ui.depth.technical }));
    expect(await screen.findByText(note)).toBeInTheDocument();
  });

  it('shows licensing and GCC availability on every row in the Executive view', async () => {
    renderApp('/capabilities?view=table');
    await screen.findAllByRole('table');
    expect(screen.getAllByText(site.ui.badges.gccUnavailable)).toHaveLength(metrics.notInGccCount);
    expect(screen.getAllByText(site.ui.badges.gccAvailable).length).toBeGreaterThanOrEqual(
      metrics.gccCount,
    );
    const premium = screen.getAllByText(site.ui.badges.premium, { selector: ':not(option)' });
    expect(premium).toHaveLength(metrics.premiumCount);
  });

  it('shows empty results, keeps search focus and updates the URL', async () => {
    const router = renderApp('/capabilities');
    const search = await screen.findByLabelText(explorer.search);
    await userEvent.type(search, 'no-such-capability');
    expect(search).toHaveFocus();
    expect(router.state.location.search).toContain('q=no-such-capability');
    expect(screen.getByText(explorer.empty)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('enforces a four-capability comparison, keeps selections across filters and offers a sticky bar', async () => {
    renderApp('/capabilities?view=table');
    await screen.findAllByRole('table');
    const boxes = screen.getAllByRole('checkbox');
    for (const box of boxes.slice(0, 4)) await userEvent.click(box);
    expect(screen.getAllByRole('checkbox')[4]).toBeDisabled();
    const comparison = screen.getByRole('region', { name: explorer.comparison });
    expect(within(comparison).getAllByRole('row')).toHaveLength(5);
    const bar = screen.getByRole('group', { name: explorer.compare });
    expect(bar).toHaveTextContent(renderTemplate(explorer.compareBar, { count: 4 }));
    expect(within(bar).getByRole('link', { name: explorer.showComparison })).toHaveAttribute(
      'href',
      '#comparison',
    );
    await userEvent.type(screen.getByLabelText(explorer.search), 'no-such-capability');
    expect(within(comparison).getAllByRole('row')).toHaveLength(5);
    await userEvent.click(within(bar).getByRole('button', { name: explorer.clearComparison }));
    expect(screen.queryByRole('region', { name: explorer.comparison })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: explorer.compare })).not.toBeInTheDocument();
  });

  it('warns about malformed explorer links', async () => {
    renderApp('/capabilities?lens=unknown&compare=invalid');
    expect(await screen.findByRole('alert')).toHaveTextContent(explorer.invalidLink);
  });

  it('lists every capability once, without a per-row draft marker', async () => {
    renderApp('/capabilities?view=table');
    const tables = await screen.findAllByRole('table');
    expect(tables.flatMap((table) => within(table).getAllByRole('rowheader'))).toHaveLength(
      content.capabilities.length,
    );
  });

  describe('Capability briefs', () => {
    it('opens a brief with source fidelity, availability and a verified date', async () => {
      const first = content.capabilities[0]!;
      renderApp('/capabilities?view=table');
      await userEvent.click(await screen.findByRole('link', { name: first.shortName }));
      expect(
        await screen.findByRole('heading', { level: 1, name: first.shortName }),
      ).toBeInTheDocument();
      expect(screen.getByText(first.source.featureText)).toBeInTheDocument();
      expect(screen.getByText(first.withoutIt!)).toBeInTheDocument();
      expect(
        screen.getAllByText(
          renderTemplate(site.ui.badges.verified, { date: first.source.lastVerified }),
        ).length,
      ).toBeGreaterThan(0);
      expect(screen.queryByText(site.ui.badges.draft)).not.toBeInTheDocument();
      expect(document.title).toBe(`${first.shortName} · ${site.productName}`);
      expect(
        screen.getByRole('link', { name: site.capabilities.brief.correction }),
      ).toHaveAttribute('href', expect.stringContaining('/issues/new?title='));
    });

    it('shows the review status of a brief in the Technical view', async () => {
      const first = content.capabilities[0]!;
      renderApp(`/capabilities/${first.id}`);
      await screen.findByRole('heading', { level: 1, name: first.shortName });
      await userEvent.click(screen.getByRole('button', { name: site.ui.depth.technical }));
      expect(screen.getAllByText(site.ui.badges.draft).length).toBeGreaterThan(0);
    });

    it('shows both sources when they differ, without hiding official availability', async () => {
      const c = content.capabilities.find((item) =>
        item.sourceNotes?.some((note) => note.differs),
      )!;
      renderApp(`/capabilities/${c.id}`);
      await screen.findByRole('heading', { level: 1, name: c.shortName });
      expect(screen.getByText(c.source.featureText)).toBeInTheDocument();
      for (const note of c.sourceNotes ?? [])
        expect(screen.getByText(note.note)).toBeInTheDocument();
      expect(screen.getAllByText(site.ui.badges.sourcesDiffer).length).toBeGreaterThan(0);
    });

    it('shows a not-found page, not a fabricated brief, for unknown capability ids', async () => {
      renderApp('/capabilities/does-not-exist');
      expect(
        await screen.findByRole('heading', { level: 1, name: site.routes.notFound.title }),
      ).toBeInTheDocument();
    });
  });

  it('shows the official wording and ids in Technical, and outcomes in Executive', async () => {
    renderApp('/capabilities');
    const first = content.capabilities[0]!;
    expect(await screen.findByText(first.executiveValue!)).toBeInTheDocument();
    expect(screen.queryByText(first.id)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: site.ui.depth.technical }));
    expect(await screen.findByText(first.id)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(first.source.featureText.slice(0, 30)))).toBeInTheDocument();
  });

  it('flags capabilities whose sources differ, and says what the flag means', async () => {
    renderApp('/capabilities?view=table');
    await screen.findAllByRole('table');
    expect(screen.getAllByText(site.ui.badges.sourcesDiffer)).toHaveLength(5);
    expect(screen.getByText(site.capabilities.sourcesDifferNote)).toBeInTheDocument();
  });

  it('labels the Graph API as a preview', async () => {
    renderApp('/capabilities?view=table');
    await screen.findAllByRole('table');
    expect(screen.getAllByText(site.ui.badges.preview)).toHaveLength(1);
  });
});

describe('feedback by email', () => {
  afterEach(() => {
    site.feedbackEmail = null;
  });

  it('offers no mail link until an address has been confirmed', async () => {
    const capability = content.capabilities[0]!;
    renderApp(`/capabilities/${capability.id}`);
    await screen.findByRole('heading', { level: 1, name: capability.shortName });
    expect(site.feedbackEmail).toBeNull();
    expect(
      screen.queryByRole('link', { name: site.ui.footer.emailFeedback }),
    ).not.toBeInTheDocument();
  });

  it('links the capability brief and the footer to the configured address', async () => {
    site.feedbackEmail = 'feedback@example.invalid';
    const capability = content.capabilities[0]!;
    renderApp(`/capabilities/${capability.id}`);
    await screen.findByRole('heading', { level: 1, name: capability.shortName });
    const links = screen.getAllByRole('link', { name: site.ui.footer.emailFeedback });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `mailto:feedback@example.invalid?subject=${encodeURIComponent(`Correction: ${capability.shortName}`)}`,
      'mailto:feedback@example.invalid',
    ]);
  });
});
