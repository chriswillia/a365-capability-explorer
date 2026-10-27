import { FluentProvider } from '@fluentui/react-components';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it } from 'vitest';
import { content, contentMeta, metrics, values } from '../lib/content/index.ts';
import { renderTemplate } from '../lib/content/template.ts';
import { DEPTH_STORAGE_KEY } from '../lib/state/depth.ts';
import { DepthProvider } from '../lib/state/DepthProvider.tsx';
import { STORAGE_PREFIX } from '../lib/state/storage.ts';
import { fluentTheme } from '../theme/fluentTheme.ts';
import { routes } from './routes.tsx';

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <FluentProvider theme={fluentTheme}>
      <DepthProvider>
        <RouterProvider router={router} />
      </DepthProvider>
    </FluentProvider>,
  );
  return router;
}

const { site } = content;

describe('layout shell', () => {
  it('has the landmarks, the preview banner and the mandated disclaimer on every page', async () => {
    renderApp();
    expect(
      await screen.findByRole('heading', { level: 1, name: site.productName }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText(site.ui.previewBanner)).toBeInTheDocument();
    expect(screen.getByText(site.disclaimer)).toBeInTheDocument();
    expect(screen.getByText(site.independenceNotice)).toBeInTheDocument();
    expect(screen.getByText(contentMeta.contentVersion)).toBeInTheDocument();
  });

  it('keeps the disclaimer wording the brief requires', () => {
    expect(site.disclaimer).toBe(
      'Guidance tool for planning conversations. Not an official Microsoft licensing determination. Confirm with the Microsoft Agent 365 service description, the Microsoft Product Terms and your Microsoft account team.',
    );
  });

  it('lists the main sections in workflow order, marks the current one, and keeps Methodology in the footer', async () => {
    renderApp();
    const nav = await screen.findByRole('navigation', { name: site.ui.mainNavLabel });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(
      (
        [
          'overview',
          'learn',
          'capabilities',
          'patterns',
          'diagnostic',
          'portfolio',
          'workshop',
        ] as const
      ).map((key) => site.ui.nav[key]),
    );
    expect(within(nav).getByRole('link', { name: site.ui.nav.overview })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).queryByRole('link', { name: site.ui.nav.methodology })).toBeNull();
    expect(
      within(screen.getByRole('contentinfo')).getByRole('link', { name: site.ui.nav.methodology }),
    ).toHaveAttribute('href', '/methodology');
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
    await userEvent.click(await screen.findByRole('link', { name: site.ui.nav.capabilities }));
    const heading = await screen.findByRole('heading', {
      level: 1,
      name: site.routes.capabilities.title,
    });
    expect(heading).toHaveFocus();
    expect(document.title).toBe(`${site.routes.capabilities.title} · ${site.productName}`);
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
  it('shows KPIs that are computed from the content, not typed', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1 });
    for (const kpi of site.overview.kpis) {
      const label = screen.getByText(kpi.label);
      const tile = label.closest('div') as HTMLElement;
      expect(tile).toHaveTextContent(String(metrics[kpi.valueKey]));
    }
  });

  it('links every number to the capabilities it counts, and every pillar to its capabilities', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1 });
    for (const kpi of site.overview.kpis)
      expect(screen.getByRole('link', { name: kpi.label })).toHaveAttribute('href', kpi.href);
    const gcc = site.overview.kpis.find((kpi) => kpi.noteHref !== undefined)!;
    expect(
      screen.getByRole('link', { name: `${metrics.notInGccCount} are not available in GCC.` }),
    ).toHaveAttribute('href', gcc.noteHref);
    for (const pillar of content.pillars)
      expect(screen.getByRole('link', { name: pillar.label })).toHaveAttribute(
        'href',
        `/capabilities?pillar=${pillar.id}`,
      );
  });

  it('opens with the seller path first and a way to start a customer conversation', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1 });
    expect(content.personas[0]!.id).toBe('seller-partner');
    const cards = screen.getAllByRole('heading', { level: 3 }).slice(0, 2);
    expect(cards[0]).toHaveTextContent(content.personas[0]!.label);
    expect(screen.getByRole('link', { name: site.overview.ctaConversation })).toHaveAttribute(
      'href',
      '/conversation',
    );
    const personas = screen.getByRole('region', { name: site.overview.personasHeading });
    expect(within(personas).queryByText(site.ui.badges.draft)).not.toBeInTheDocument();
  });

  it('generates the exhibit title from the data', async () => {
    renderApp();
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: `${metrics.premiumCount} of ${metrics.capabilityCount} capabilities require Microsoft 365 E7/G7 or Agent 365; ${metrics.foundationalCount} come with base plans.`,
      }),
    ).toBeInTheDocument();
  });

  it('states that most of Agent 365 is a platform foundation, because the data supports it', async () => {
    renderApp();
    expect(await screen.findByText(site.overview.insights.platformFoundation)).toBeInTheDocument();
  });

  it('adds console and layer detail only in the Technical view', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(site.overview.technicalHint)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: site.ui.depth.technical }));
    const tables = await screen.findAllByRole('table');
    expect(tables).toHaveLength(2);
    expect(within(tables[0] as HTMLElement).getAllByRole('row')).toHaveLength(
      content.consoles.length + 1,
    );
    expect(screen.queryByText(site.overview.technicalHint)).not.toBeInTheDocument();
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
    renderApp('/capabilities');
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
    const router = renderApp('/capabilities');
    const chips = within(await screen.findByRole('group', { name: explorer.pillarFilter }));
    await userEvent.click(
      chips.getByRole('button', {
        name: renderTemplate(explorer.pillarChip, {
          label: pillarLabel('secure'),
          count: metrics.secureCount,
        }),
      }),
    );
    expect(router.state.location.search).toBe('?pillar=secure');
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getAllByRole('rowheader')).toHaveLength(metrics.secureCount);
    await userEvent.selectOptions(screen.getByLabelText(explorer.gcc), 'unavailable');
    await userEvent.selectOptions(screen.getByLabelText(explorer.licensing), 'premium');
    await userEvent.selectOptions(screen.getByLabelText(explorer.productArea), 'Purview');
    expect(router.state.location.search).toBe(
      '?pillar=secure&console=Purview&licensing=premium&gcc=unavailable',
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
    expect(router.state.location.search).toBe('');
  });

  it('groups by product area when asked, and keeps links written for the console lens working', async () => {
    renderApp('/capabilities?lens=console&group=Entra');
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
    const router = renderApp('/capabilities');
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
    expect(router.state.location.search).toBe('?lens=layer&group=oversight');
    expect(screen.getAllByRole('rowheader')).toHaveLength(expected.length);
    expect(screen.getByLabelText(explorer.search)).toHaveValue('');
  });

  it('says once that summaries are drafts instead of repeating the marker on every row', async () => {
    renderApp('/capabilities');
    await screen.findAllByRole('table');
    expect(
      screen.getByText(
        renderTemplate(explorer.draftSummary, {
          draft: content.capabilities.length,
          total: content.capabilities.length,
        }),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(site.ui.badges.draft)).not.toBeInTheDocument();
  });

  it('shows licensing and GCC availability on every row in the Executive view', async () => {
    renderApp('/capabilities');
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
    renderApp('/capabilities');
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
    renderApp('/capabilities');
    const tables = await screen.findAllByRole('table');
    expect(tables.flatMap((table) => within(table).getAllByRole('rowheader'))).toHaveLength(
      content.capabilities.length,
    );
  });

  describe('Capability briefs', () => {
    it('opens a brief with source fidelity, availability and editorial status', async () => {
      const first = content.capabilities[0]!;
      renderApp('/capabilities');
      await userEvent.click(await screen.findByRole('link', { name: first.shortName }));
      expect(
        await screen.findByRole('heading', { level: 1, name: first.shortName }),
      ).toBeInTheDocument();
      expect(screen.getByText(first.source.featureText)).toBeInTheDocument();
      expect(screen.getByText(first.withoutIt!)).toBeInTheDocument();
      expect(screen.getAllByText(site.ui.badges.draft).length).toBeGreaterThan(0);
      expect(document.title).toBe(`${first.shortName} · ${site.productName}`);
      expect(
        screen.getByRole('link', { name: site.capabilities.brief.correction }),
      ).toHaveAttribute('href', expect.stringContaining('/issues/new?title='));
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
    renderApp('/capabilities');
    await screen.findAllByRole('table');
    expect(screen.getAllByText(site.ui.badges.sourcesDiffer)).toHaveLength(5);
    expect(screen.getByText(site.capabilities.sourcesDifferNote)).toBeInTheDocument();
  });

  it('labels the Graph API as a preview', async () => {
    renderApp('/capabilities');
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
