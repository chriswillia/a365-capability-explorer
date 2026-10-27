import { FluentProvider } from '@fluentui/react-components';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes.tsx';
import { content, consoleById, pillarName } from '../../lib/content/index.ts';
import { licensingTier } from '../../lib/content/derive.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { DepthProvider } from '../../lib/state/DepthProvider.tsx';
import { fluentTheme } from '../../theme/fluentTheme.ts';
import './WorkshopPage.tsx';

const { site, workshop: copy } = content;
const pillars = [...content.pillars].sort((a, b) => a.order - b.order);

async function renderPage() {
  const router = createMemoryRouter(routes, { initialEntries: ['/workshop'] });
  render(
    <FluentProvider theme={fluentTheme}>
      <DepthProvider>
        <RouterProvider router={router} />
      </DepthProvider>
    </FluentProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: site.routes.workshop.title });
  return router;
}
afterEach(() => vi.restoreAllMocks());

describe('workshop kit', () => {
  it('has a requirements checklist with one table per requirement area and one row per capability', async () => {
    await renderPage();
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

  it('links to the checklist, the customer conversation guide and the blank canvas', async () => {
    await renderPage();
    const tools = within(screen.getByRole('main'));
    expect(tools.getByRole('link', { name: copy.checklistTitle })).toHaveAttribute(
      'href',
      '#checklist',
    );
    expect(tools.getByRole('link', { name: site.routes.conversation.title })).toHaveAttribute(
      'href',
      '/conversation',
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
