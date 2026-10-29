import { FluentProvider } from '@fluentui/react-components';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes.tsx';
import { content, consoleById, pillarName } from '../../lib/content/index.ts';
import { licensingTier } from '../../lib/content/derive.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { StateProviders } from '../../lib/state/StateProviders.tsx';
import { fluentTheme } from '../../theme/fluentTheme.ts';
import './WorkshopPage.tsx';

const { site, workshop: copy } = content;
const pillars = [...content.pillars].sort((a, b) => a.order - b.order);

async function renderPage(path = '/workshop') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <FluentProvider theme={fluentTheme}>
      <StateProviders>
        <RouterProvider router={router} />
      </StateProviders>
    </FluentProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: site.routes.workshop.title });
  return router;
}
afterEach(() => vi.restoreAllMocks());

describe('workshop kit', () => {
  it('has a requirements checklist with one table per requirement area and one row per capability', async () => {
    await renderPage('/workshop?view=checklist');
    const section = document.getElementById('checklist')!;
    expect(section).toHaveAttribute('data-workshop-part', 'checklist');
    const checklist = within(section);
    let rowTotal = 0;
    for (const pillar of pillars) {
      const capabilities = content.capabilities.filter((c) => c.pillar === pillar.id);
      expect(
        checklist.getByRole('heading', {
          level: 3,
          name: renderTemplate(copy.checklistPillar, {
            label: pillarName(pillar),
            count: capabilities.length,
          }),
        }),
      ).toBeInTheDocument();
      const table = within(checklist.getByRole('table', { name: pillarName(pillar) }));
      const rows = table.getAllByRole('row');
      expect(rows).toHaveLength(capabilities.length + 1);
      expect(table.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
        copy.checklistColumns.discuss,
        copy.checklistColumns.capability,
        copy.checklistColumns.productArea,
        copy.checklistColumns.availability,
        copy.checklistColumns.requirement,
        copy.checklistColumns.owner,
        copy.checklistColumns.priority,
      ]);
      for (const [i, capability] of capabilities.entries()) {
        const row = within(rows[i + 1]!);
        expect(row.getByRole('rowheader', { name: capability.shortName })).toBeInTheDocument();
        const cells = row.getAllByRole('cell');
        expect(cells[1]).toHaveTextContent(consoleById(capability.source.console)!.displayName);
        expect(cells[2]).toHaveTextContent(
          `${
            licensingTier(capability) === 'foundational'
              ? site.ui.badges.foundational
              : site.ui.badges.premium
          } · ${capability.source.gccAvailable ? site.ui.badges.gccAvailable : site.ui.badges.gccUnavailable}`,
        );
        for (const writeIn of cells.slice(3)) expect(writeIn).toBeEmptyDOMElement();
      }
      rowTotal += capabilities.length;
    }
    expect(rowTotal).toBe(content.capabilities.length);
  });

  it('offers four print targets and prints only the one that was asked for', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await renderPage();
    const page = document.querySelector('[data-workshop-print]')!;
    expect(page).toHaveAttribute('data-workshop-print', 'all');
    const parts = [...document.querySelectorAll('[data-workshop-part]')].map((part) =>
      part.getAttribute('data-workshop-part'),
    );
    expect(parts).toEqual(['guide', 'checklist', 'patterns', 'capabilities']);
    const targets = [
      [copy.printGuide, 'guide'],
      [copy.printChecklist, 'checklist'],
      [copy.printPatterns, 'patterns'],
      [copy.printCapabilities, 'capabilities'],
    ] as const;
    for (const [i, [name, target]] of targets.entries()) {
      await user.click(screen.getByRole('button', { name }));
      expect(print).toHaveBeenCalledTimes(i + 1);
      expect(page).toHaveAttribute('data-workshop-print', target);
      expect(parts).toContain(target);
      act(() => {
        window.dispatchEvent(new Event('afterprint'));
      });
      expect(page).toHaveAttribute('data-workshop-print', 'all');
    }
  });

  it('returns to printing everything and says so when the browser blocks printing', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'print').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    await renderPage();
    await user.click(screen.getByRole('button', { name: copy.printChecklist }));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.printError);
    expect(document.querySelector('[data-workshop-print]')).toHaveAttribute(
      'data-workshop-print',
      'all',
    );
  });

  it('shows one part at a time, keeps every part in the page so each still prints, and folds the capability cards by area', async () => {
    await renderPage('/workshop?view=capabilities');
    const links = within(
      screen.getByRole('navigation', { name: site.ui.views.label }),
    ).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      copy.views.guide,
      copy.views.checklist,
      copy.views.patterns,
      copy.views.capabilities,
    ]);
    expect(links[3]).toHaveAttribute('aria-current', 'true');
    expect(links[1]).toHaveAttribute('href', '/workshop?view=checklist');
    for (const part of document.querySelectorAll('[data-workshop-part]')) {
      const shown = part.getAttribute('data-workshop-part') === 'capabilities';
      const pane = part.closest('[data-print-visible]') as HTMLElement;
      expect(pane.hidden, part.getAttribute('data-workshop-part')!).toBe(!shown);
    }
    expect(document.querySelectorAll('[data-pattern-card]')).toHaveLength(content.patterns.length);
    expect(document.querySelectorAll('[data-capability-card]')).toHaveLength(
      content.capabilities.length,
    );
    for (const pillar of pillars) {
      const panel = document.getElementById(`cards-${pillar.id}`) as HTMLDetailsElement;
      expect(panel.open).toBe(false);
      expect(panel.querySelectorAll('[data-capability-card]')).toHaveLength(
        content.capabilities.filter((c) => c.pillar === pillar.id).length,
      );
    }
  });

  it('opens the area of capability cards that a link points at', async () => {
    await renderPage('/workshop#cards-secure');
    const panel = document.getElementById('cards-secure') as HTMLDetailsElement;
    await waitFor(() => expect(panel.open).toBe(true));
    expect(screen.getByRole('link', { name: copy.views.capabilities })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('links to the parts, the customer conversation guide and the blank canvas', async () => {
    await renderPage();
    const tools = within(screen.getByRole('main'));
    expect(tools.getByRole('link', { name: copy.views.checklist })).toHaveAttribute(
      'href',
      '/workshop?view=checklist',
    );
    expect(tools.getByRole('link', { name: site.routes.conversation.title })).toHaveAttribute(
      'href',
      '/patterns?view=conversation',
    );
    expect(tools.getByRole('link', { name: site.readout.blankCanvas })).toHaveAttribute(
      'href',
      '/canvas/blank',
    );
    expect(tools.getByRole('link', { name: site.routes.portfolio.title })).toHaveAttribute(
      'href',
      '/portfolio',
    );
  });
});
