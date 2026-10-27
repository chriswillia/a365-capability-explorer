import { FluentProvider } from '@fluentui/react-components';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '../../app/routes.tsx';
import { content, contentMeta, pillarById } from '../../lib/content/index.ts';
import { patternAnswers } from '../../lib/engine/evaluate.ts';
import { DepthProvider } from '../../lib/state/DepthProvider.tsx';
import { emptyWorkspace } from '../../lib/state/diagnostic-model.ts';
import { loadDiagnostics, saveDiagnostics } from '../../lib/state/diagnostic-storage.ts';
import { fluentTheme } from '../../theme/fluentTheme.ts';
import '../diagnostic/DiagnosticLayout.tsx';
import './PortfolioPage.tsx';

const { site } = content;
const copy = site.portfolio;

function seed() {
  const data = emptyWorkspace();
  const entity = {
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    contentVersion: contentMeta.contentVersion,
  };
  const other = crypto.randomUUID();
  const customer = crypto.randomUUID();
  data.organizations.push(
    { ...entity, id: other, answers: { orgName: 'Fictional other customer' } },
    {
      ...entity,
      id: customer,
      answers: {
        ...patternAnswers(content, 'process-agent', 'askhr').org,
        orgName: 'Fictional customer',
      },
    },
  );
  for (const [i, patternId] of ['process-agent', 'ai-teammate'].entries())
    data.assessments.push({
      ...entity,
      id: crypto.randomUUID(),
      organizationId: customer,
      answers: {
        ...patternAnswers(content, patternId).useCase,
        useCaseName: `Fictional use case ${i + 1}`,
        businessValue: '4',
      },
      mode: 'full',
      sectionId: 'review',
      patternId: null,
      sampleId: null,
    });
  saveDiagnostics(loadDiagnostics(), data);
  return { customer, other };
}

async function renderPage(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <FluentProvider theme={fluentTheme}>
      <DepthProvider>
        <RouterProvider router={router} />
      </DepthProvider>
    </FluentProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: site.routes.portfolio.title });
  return router;
}

describe('portfolio page', () => {
  it('opens on the customer named in the link, not the first one saved', async () => {
    const { customer, other } = seed();
    const user = userEvent.setup();
    await renderPage(`/portfolio?customer=${customer}`);
    const select = screen.getByRole('combobox', { name: copy.organization });
    expect(select).toHaveValue(customer);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Fictional customer' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Fictional use case 1' })).toBeChecked();
    await user.selectOptions(select, other);
    expect(screen.getByText(copy.empty)).toBeInTheDocument();
  });

  it('falls back to the first customer when the link names one that does not exist', async () => {
    const { other } = seed();
    await renderPage('/portfolio?customer=missing');
    expect(screen.getByRole('combobox', { name: copy.organization })).toHaveValue(other);
  });

  it('groups the capability heatmap by requirement area and names each use case in the header', async () => {
    const { customer } = seed();
    await renderPage(`/portfolio?customer=${customer}`);
    const table = screen.getByRole('table', { name: copy.matrix });
    const rows = within(table).getAllByRole('row');
    const headers = within(rows[0]!)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toEqual([
      site.capabilities.columns.capability,
      site.capabilities.columns.pillar,
      'Fictional use case 1',
      'Fictional use case 2',
    ]);
    const body = rows.slice(1);
    expect(body.length).toBeGreaterThan(0);
    const orders = body.map((row) => {
      const requirement = within(row).getAllByRole('cell')[0]!.textContent;
      const pillar = content.pillars.find((p) => p.requirement === requirement);
      expect(pillar, requirement ?? '').toBeDefined();
      const capability = content.capabilities.find(
        (c) => c.shortName === within(row).getByRole('rowheader').textContent,
      )!;
      expect(capability.pillar).toBe(pillar!.id);
      return pillarById(capability.pillar)!.order;
    });
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it('labels the first column of the use case table with the question it answers', async () => {
    const { customer } = seed();
    await renderPage(`/portfolio?customer=${customer}`);
    const table = screen.getByRole('table', { name: copy.table });
    expect(within(table).getAllByRole('columnheader')[1]).toHaveTextContent(
      content.questions.find((q) => q.id === 'useCaseName')!.label,
    );
  });
});
