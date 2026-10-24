import { FluentProvider } from '@fluentui/react-components';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { content, contentMeta, metrics } from '../lib/content/index.ts';
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

  it('lists every main section and marks the current one', async () => {
    renderApp();
    const nav = await screen.findByRole('navigation', { name: site.ui.mainNavLabel });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(Object.values(site.ui.nav));
    expect(within(nav).getByRole('link', { name: site.ui.nav.overview })).toHaveAttribute(
      'aria-current',
      'page',
    );
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
    renderApp('/patterns');
    expect(
      await screen.findByRole('heading', { level: 1, name: site.routes.patterns.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(site.routes.patterns.description)).toBeInTheDocument();
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
  it('lists every capability, with a draft marker on each', async () => {
    renderApp('/capabilities');
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(content.capabilities.length + 1);
    expect(within(table).getAllByText(site.ui.badges.draft)).toHaveLength(
      content.capabilities.length,
    );
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
    await screen.findByRole('table');
    expect(screen.getAllByText(site.ui.badges.sourcesDiffer)).toHaveLength(5);
    expect(screen.getByText(site.capabilities.sourcesDifferNote)).toBeInTheDocument();
  });

  it('labels the Graph API as a preview', async () => {
    renderApp('/capabilities');
    await screen.findByRole('table');
    expect(screen.getAllByText(site.ui.badges.preview)).toHaveLength(1);
  });
});
