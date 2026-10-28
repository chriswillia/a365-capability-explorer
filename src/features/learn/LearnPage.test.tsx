import { FluentProvider } from '@fluentui/react-components';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '../../app/routes.tsx';
import { content } from '../../lib/content/index.ts';
import { StateProviders } from '../../lib/state/StateProviders.tsx';
import { fluentTheme } from '../../theme/fluentTheme.ts';
import '../value/ValuePage.tsx';
import './LearnPage.tsx';

function renderPage(path = '/learn') {
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
const copy = site.learn;

// The first mention of a glossary term carries its definition as a tooltip, which is not part of the prose.
function withoutTooltips(element: HTMLElement): HTMLElement {
  const prose = element.cloneNode(true);
  if (!(prose instanceof HTMLElement)) throw new Error('Expected an element');
  prose.querySelectorAll('[role="tooltip"]').forEach((tooltip) => tooltip.remove());
  return prose;
}

describe('Phase 2 learning experience', () => {
  it('gives every persona a live starting path and shows the Frontier phases', async () => {
    const router = renderPage('/learn');
    await screen.findByRole('heading', { level: 2, name: copy.sections.roles });
    for (const persona of content.personas) {
      expect(screen.getByRole('link', { name: persona.startLabel })).toHaveAttribute(
        'href',
        persona.href,
      );
    }
    for (const phase of content.learn.frontier)
      expect(screen.getByRole('heading', { name: phase.title })).toBeInTheDocument();
    const executive = content.personas.find((p) => p.id === 'executive')!;
    await userEvent.click(screen.getByRole('link', { name: executive.startLabel }));
    expect(
      await screen.findByRole('heading', { level: 1, name: site.routes.pitch.title }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/pitch');
    expect(screen.queryByText(site.ui.comingSoon.status)).not.toBeInTheDocument();
  });

  it('starts a seller on the pitch', async () => {
    const router = renderPage('/learn');
    await screen.findByRole('heading', { level: 2, name: copy.sections.roles });
    expect(content.personas[0]!.id).toBe('seller-partner');
    await userEvent.click(screen.getByRole('link', { name: content.personas[0]!.startLabel }));
    expect(
      await screen.findByRole('heading', { level: 1, name: site.routes.pitch.title }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/pitch');
  });

  it('orders the page from positioning to glossary, links the seller guide and ends with next steps', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: site.routes.learn.title });
    const main = within(screen.getByRole('main'));
    expect(main.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      copy.sections.positioning,
      copy.sections.myths,
      copy.sections.concepts,
      copy.sections.integration,
      copy.sections.buildingBlocks,
      copy.sections.frontier,
      copy.sections.roles,
      copy.sections.glossary,
      copy.nextHeading,
    ]);
    expect(main.getByRole('link', { name: site.routes.conversation.title })).toHaveAttribute(
      'href',
      '/pitch#conversation',
    );
    for (const item of copy.next)
      expect(main.getByRole('link', { name: item.label })).toHaveAttribute('href', item.to);
  });

  it('lists every concept in one table with matching capabilities and no stepper', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: site.routes.learn.title });
    expect(screen.queryByRole('button', { name: /^(previous|next)/i })).not.toBeInTheDocument();
    const table = screen.getByRole('table', { name: copy.flowTable });
    expect(within(table).getAllByRole('row')).toHaveLength(content.learn.flow.length + 1);
    for (const current of content.learn.flow) {
      const row = within(table).getByRole('heading', { name: current.title }).closest('tr')!;
      expect(withoutTooltips(row)).toHaveTextContent(current.summary!);
      expect(row).not.toHaveTextContent(site.ui.badges.draft);
      for (const id of current.capabilityIds) {
        expect(
          within(row).getByRole('link', {
            name: content.capabilities.find((c) => c.id === id)!.shortName,
          }),
        ).toHaveAttribute('href', `/capabilities/${id}`);
      }
    }
  });

  it('shows technical guidance only in Technical and preserves explicit verification gaps', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: site.routes.learn.title });
    const row = within(screen.getByRole('table', { name: copy.flowTable }))
      .getByRole('heading', { name: content.learn.flow[0]!.title })
      .closest('tr')!;
    expect(row).not.toHaveTextContent(content.learn.flow[0]!.technical!);
    await userEvent.click(screen.getByRole('button', { name: site.ui.depth.technical }));
    expect(withoutTooltips(row)).toHaveTextContent(content.learn.flow[0]!.technical!);
    const missing =
      content.faq.filter((item) => item.fact === null).length +
      content.buildingBlocks.filter((item) => item.summary === null).length +
      content.learn.positioning.filter((item) => item.summary === null).length;
    expect(screen.getAllByText(copy.pending)).toHaveLength(missing);
    for (const item of content.faq) {
      const card = screen.getByRole('heading', { name: item.myth }).closest('article')!;
      expect(withoutTooltips(card)).toHaveTextContent(item.fact ?? copy.pending);
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
