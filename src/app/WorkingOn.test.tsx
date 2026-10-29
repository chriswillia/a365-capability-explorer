import { FluentProvider } from '@fluentui/react-components';
import { act, render, screen, within } from '@testing-library/react';
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
import '../features/passport/PassportPage.tsx';
import './WorkingOn.tsx';
import { routes } from './routes.tsx';

const label = content.site.ui.working.label;

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <FluentProvider theme={fluentTheme}>
      <StateProviders>
        <RouterProvider router={router} />
      </StateProviders>
    </FluentProvider>,
  );
}

function workspace(options: { sample?: boolean } = {}) {
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
      ...(options.sample === true ? { sample: true as const } : {}),
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
const chip = () => screen.findByRole('link', { name: new RegExp(`^${label}:`) });

describe('working-on link', () => {
  it('stays out of the way until an agent exists', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1, name: content.site.productName });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('link', { name: new RegExp(`^${label}:`) })).not.toBeInTheDocument();
  });

  it('names the agent changed most recently with its customer, and opens its passport', async () => {
    const ids = workspace();
    renderApp();
    const link = await chip();
    expect(link).toHaveTextContent(
      `${label}: Fictional newer customer · Fictional second use case`,
    );
    expect(link).toHaveAttribute('href', `/map?assessment=${ids.newerSecond}#passport-heading`);
    // The old menu of per-agent links is gone: one link, and the passport lists the steps.
    expect(within(screen.getByRole('banner')).queryByRole('link', { name: 'Readout' })).toBeNull();
  });

  it('follows the agent that is open, whichever page it is on', async () => {
    const ids = workspace();
    const paths = [
      `/diagnostic/${ids.olderCase}`,
      `/diagnostic/${ids.olderCase}/readout`,
      `/canvas/${ids.olderCase}`,
      `/leave-behind/${ids.olderCase}`,
      `/licensing?assessment=${ids.olderCase}`,
      `/deploy?assessment=${ids.olderCase}`,
    ];
    for (const path of paths) {
      const { unmount } = renderApp(path);
      const link = await chip();
      expect(link, path).toHaveTextContent('Fictional older customer · Fictional older use case');
      unmount();
    }
  });

  it('falls back to the newest agent when the address names one that is not saved', async () => {
    workspace();
    renderApp('/diagnostic/not-a-local-id');
    expect(await chip()).toHaveTextContent('Fictional second use case');
  });

  it('shows the newest agent of the customer whose portfolio is open', async () => {
    const ids = workspace();
    renderApp(`/portfolio?customer=${ids.older}`);
    expect(await chip()).toHaveTextContent('Fictional older customer · Fictional older use case');
  });

  it('marks the fictional sample customer, so it is never mistaken for a real one', async () => {
    workspace({ sample: true });
    renderApp();
    const link = await chip();
    expect(within(link).getByText(content.site.ui.sample.chip)).toBeInTheDocument();
  });

  it('says it is the current page on the passport it links to', async () => {
    const ids = workspace();
    renderApp(`/map?assessment=${ids.newerFirst}`);
    expect(await chip()).toHaveAttribute('aria-current', 'page');
  });

  it('shows an agent added in another tab without a reload', async () => {
    const ids = workspace();
    renderApp();
    expect(await chip()).toHaveTextContent('Fictional second use case');
    const data = loadDiagnostics().data;
    data.assessments.find((a) => a.id === ids.newerSecond)!.answers.useCaseName =
      'Fictional renamed use case';
    saveDiagnostics(loadDiagnostics(), data);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: STORAGE_PREFIX + DIAGNOSTIC_STORAGE_KEY }),
      );
    });
    expect(await screen.findByText(/Fictional renamed use case/)).toBeInTheDocument();
  });
});
