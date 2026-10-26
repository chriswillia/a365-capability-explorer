import { FluentProvider } from '@fluentui/react-components';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '../../app/routes.tsx';
import { content } from '../../lib/content/index.ts';
import { DepthProvider } from '../../lib/state/DepthProvider.tsx';
import { fluentTheme } from '../../theme/fluentTheme.ts';

function renderPage(path = '/learn') {
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
const copy = site.learn;

describe('Phase 2 learning experience', () => {
  it('gives every persona a live starting path and shows the north-star questions and Frontier phases', async () => {
    const router = renderPage('/');
    await screen.findByRole('heading', { level: 2, name: site.overview.personasHeading });
    for (const persona of content.personas) {
      expect(screen.getByRole('link', { name: persona.startLabel })).toHaveAttribute(
        'href',
        persona.href,
      );
    }
    for (const question of site.overview.questions)
      expect(screen.getByText(question)).toBeInTheDocument();
    for (const phase of content.learn.frontier)
      expect(screen.getByRole('heading', { name: phase.title })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: content.personas[0]!.startLabel }));
    expect(
      await screen.findByRole('heading', { level: 1, name: site.routes.learn.title }),
    ).toBeInTheDocument();
    expect(router.state.location.hash).toBe('#positioning');
    expect(screen.queryByText(site.ui.comingSoon.status)).not.toBeInTheDocument();
  });

  it('provides a bounded concept walkthrough with matching capabilities and a complete table alternative', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: site.routes.learn.title });
    expect(screen.getByRole('button', { name: copy.previous })).toBeDisabled();
    const table = screen.getByRole('table', { name: copy.flowTable });
    expect(within(table).getAllByRole('row')).toHaveLength(content.learn.flow.length + 1);
    for (let step = 0; step < content.learn.flow.length; step++) {
      const current = content.learn.flow[step]!;
      const heading = screen.getAllByRole('heading', { name: current.title })[0]!;
      const card = heading.closest('article')!;
      const prose = card.cloneNode(true);
      if (!(prose instanceof HTMLElement)) throw new Error('Expected an article');
      prose.querySelectorAll('[role="tooltip"]').forEach((tooltip) => tooltip.remove());
      expect(prose).toHaveTextContent(current.summary!);
      expect(card).toHaveTextContent(site.ui.badges.draft);
      for (const id of current.capabilityIds) {
        expect(
          within(card).getByRole('link', {
            name: content.capabilities.find((c) => c.id === id)!.shortName,
          }),
        ).toHaveAttribute('href', `/capabilities/${id}`);
      }
      if (step < content.learn.flow.length - 1)
        await userEvent.click(screen.getByRole('button', { name: copy.next }));
    }
    expect(screen.getByRole('button', { name: copy.next })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: copy.previous }));
    expect(screen.getByRole('button', { name: copy.next })).toBeEnabled();
  });

  it('shows technical guidance only in Technical and preserves explicit verification gaps', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: site.routes.learn.title });
    const article = screen
      .getAllByRole('heading', { name: content.learn.flow[0]!.title })[0]!
      .closest('article')!;
    expect(article).not.toHaveTextContent(content.learn.flow[0]!.technical!);
    await userEvent.click(screen.getByRole('button', { name: site.ui.depth.technical }));
    expect(article).toHaveTextContent(content.learn.flow[0]!.technical!);
    const missing =
      content.faq.filter((item) => item.fact === null).length +
      content.buildingBlocks.filter((item) => item.summary === null).length +
      content.learn.positioning.filter((item) => item.summary === null).length;
    expect(screen.getAllByText(copy.pending)).toHaveLength(missing);
    for (const item of content.faq) {
      const card = screen.getByRole('heading', { name: item.myth }).closest('article')!;
      expect(card).toHaveTextContent(item.fact ?? copy.pending);
    }
    expect(screen.getByText(copy.buildingBlocksNote)).toBeInTheDocument();
  });

  it('automatically links the first glossary mention and keeps definitions accessible', async () => {
    const router = renderPage('/capabilities/observability');
    await screen.findByRole('heading', {
      level: 1,
      name: content.capabilities.find((c) => c.id === 'observability')!.shortName,
    });
    await userEvent.click(screen.getByRole('button', { name: site.ui.depth.technical }));
    const links = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/learn#glossary-'));
    expect(links.length).toBeGreaterThan(0);
    const targets = links.map((link) => link.getAttribute('href'));
    expect(new Set(targets).size).toBe(targets.length);
    const link = links[0]!;
    expect(link).toHaveAttribute('aria-describedby');
    expect(document.getElementById(link.getAttribute('aria-describedby')!)).toHaveAttribute(
      'role',
      'tooltip',
    );
    await userEvent.click(link);
    expect(router.state.location.hash).toMatch(/^#glossary-/);
    expect(
      await screen.findByRole('heading', { level: 1, name: site.routes.learn.title }),
    ).toBeInTheDocument();
  });
});
