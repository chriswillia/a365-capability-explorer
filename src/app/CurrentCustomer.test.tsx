import { FluentProvider } from '@fluentui/react-components';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { content, contentMeta } from '../lib/content/index.ts';
import { StateProviders } from '../lib/state/StateProviders.tsx';
import { emptyWorkspace } from '../lib/state/diagnostic-model.ts';
import {
  DIAGNOSTIC_STORAGE_KEY,
  loadDiagnostics,
  saveDiagnostics,
} from '../lib/state/diagnostic-storage.ts';
import { STORAGE_PREFIX } from '../lib/state/storage.ts';
import { fluentTheme } from '../theme/fluentTheme.ts';
import '../features/diagnostic/DiagnosticLayout.tsx';
import '../features/diagnostic/DiagnosticWizard.tsx';
import '../features/portfolio/PortfolioPage.tsx';
import './CurrentCustomer.tsx';
import { routes } from './routes.tsx';

const copy = content.site.ui.customer;

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

function workspace() {
  const data = emptyWorkspace();
  const entity = (updatedAt: string) => ({
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt,
    contentVersion: contentMeta.contentVersion,
  });
  const ids = {
    older: crypto.randomUUID(),
    newer: crypto.randomUUID(),
    olderCase: crypto.randomUUID(),
    newerFirst: crypto.randomUUID(),
    newerSecond: crypto.randomUUID(),
  };
  data.organizations.push(
    {
      ...entity('2026-10-02T09:00:00.000Z'),
      id: ids.older,
      answers: { orgName: 'Fictional older customer' },
    },
    {
      ...entity('2026-10-05T09:00:00.000Z'),
      id: ids.newer,
      answers: { orgName: 'Fictional newer customer' },
    },
  );
  const assessment = (id: string, organizationId: string, name: string, updatedAt: string) => ({
    ...entity(updatedAt),
    id,
    organizationId,
    answers: { useCaseName: name },
    mode: 'quick' as const,
    sectionId: 'profile',
    patternId: null,
    sampleId: null,
  });
  data.assessments.push(
    assessment(ids.olderCase, ids.older, 'Fictional older use case', '2026-10-03T09:00:00.000Z'),
    assessment(ids.newerFirst, ids.newer, 'Fictional first use case', '2026-10-04T09:00:00.000Z'),
    assessment(ids.newerSecond, ids.newer, 'Fictional second use case', '2026-10-06T09:00:00.000Z'),
  );
  saveDiagnostics(loadDiagnostics(), data);
  return ids;
}
const label = `${copy.label}:`;

describe('current customer shortcut', () => {
  it('stays out of the way until a customer exists', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1, name: content.site.productName });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it('names the customer touched most recently and lists their use cases, newest first', async () => {
    const ids = workspace();
    const user = userEvent.setup();
    renderApp();
    const summary = await screen.findByText(label);
    expect(within(summary).getByText('Fictional newer customer')).toBeInTheDocument();
    await user.click(summary);
    const panel = within(summary.closest('details')!);
    const items = panel.getAllByRole('listitem');
    expect(items.map((item) => item.firstElementChild!.textContent)).toEqual([
      'Fictional second use case',
      'Fictional first use case',
    ]);
    const first = within(items[0]!);
    expect(first.getByRole('link', { name: copy.edit })).toHaveAttribute(
      'href',
      `/diagnostic/${ids.newerSecond}`,
    );
    expect(first.getByRole('link', { name: copy.readout })).toHaveAttribute(
      'href',
      `/diagnostic/${ids.newerSecond}/readout`,
    );
    expect(first.getByRole('link', { name: copy.licensing })).toHaveAttribute(
      'href',
      `/licensing?assessment=${ids.newerSecond}`,
    );
    expect(first.getByRole('link', { name: copy.canvas })).toHaveAttribute(
      'href',
      `/canvas/${ids.newerSecond}`,
    );
    expect(panel.getByRole('link', { name: copy.compare })).toHaveAttribute(
      'href',
      `/portfolio?customer=${ids.newer}`,
    );
    expect(panel.getByRole('link', { name: copy.switch })).toHaveAttribute('href', '/diagnostic');
  });

  it('follows the assessment that is open, not the most recent customer', async () => {
    const ids = workspace();
    renderApp(`/diagnostic/${ids.olderCase}`);
    const summary = await screen.findByText(label);
    expect(within(summary).getByText('Fictional older customer')).toBeInTheDocument();
  });

  it('falls back to the most recent customer when the open assessment does not exist', async () => {
    workspace();
    renderApp('/diagnostic/not-a-local-id');
    const summary = await screen.findByText(label);
    expect(within(summary).getByText('Fictional newer customer')).toBeInTheDocument();
  });

  it('opens the comparison for that customer', async () => {
    const ids = workspace();
    const user = userEvent.setup();
    const router = renderApp(`/diagnostic/${ids.olderCase}`);
    const summary = await screen.findByText(label);
    await user.click(summary);
    await user.click(within(summary.closest('details')!).getByRole('link', { name: copy.compare }));
    await screen.findByRole('heading', { level: 1, name: content.site.routes.portfolio.title });
    expect(router.state.location.search).toBe(`?customer=${ids.older}`);
    expect(screen.getByRole('combobox', { name: content.site.portfolio.organization })).toHaveValue(
      ids.older,
    );
    expect(screen.getByText(label).closest('details')).not.toHaveAttribute('open');
  });

  it('closes with Escape and returns focus to the button that opened it', async () => {
    workspace();
    const user = userEvent.setup();
    renderApp();
    const summary = await screen.findByText(label);
    const details = summary.closest('details')!;
    await user.click(summary);
    expect(details).toHaveAttribute('open');
    await user.keyboard('{Escape}');
    expect(details).not.toHaveAttribute('open');
    expect(summary).toHaveFocus();
  });

  it('shows a customer added in another tab without a reload', async () => {
    const ids = workspace();
    renderApp();
    const summary = await screen.findByText(label);
    expect(within(summary).getByText('Fictional newer customer')).toBeInTheDocument();
    const data = loadDiagnostics().data;
    data.organizations.find((o) => o.id === ids.newer)!.answers.orgName =
      'Fictional renamed customer';
    saveDiagnostics(loadDiagnostics(), data);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: STORAGE_PREFIX + DIAGNOSTIC_STORAGE_KEY }),
      );
    });
    expect(
      await within(screen.getByText(label)).findByText('Fictional renamed customer'),
    ).toBeInTheDocument();
  });
});
