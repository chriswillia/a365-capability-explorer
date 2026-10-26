import { FluentProvider } from '@fluentui/react-components';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '../../app/routes.tsx';
import { content, contentMeta } from '../../lib/content/index.ts';
import { evaluateAssessment, evaluatePatterns, patternAnswers } from '../../lib/engine/evaluate.ts';
import { DepthProvider } from '../../lib/state/DepthProvider.tsx';
import { fluentTheme } from '../../theme/fluentTheme.ts';

const { site } = content;
const copy = site.mapping;
function renderPage(path: string) {
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

describe('Phase 3 mapping views', () => {
  it('generates exactly one matrix row per capability and one column per canonical pattern', async () => {
    renderPage('/patterns');
    await screen.findByRole('heading', { level: 1, name: site.routes.patterns.title });
    expect(screen.getByText(copy.neutralNote)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: copy.matrix });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(content.capabilities.length + 1);
    expect(within(rows[0]!).getAllByRole('columnheader')).toHaveLength(content.patterns.length + 1);
    const patterns = evaluatePatterns(content, contentMeta.contentVersion);
    for (const [i, capability] of content.capabilities.entries()) {
      const cells = within(rows[i + 1]!).getAllByRole('cell');
      for (const [j, { result }] of patterns.entries()) {
        const match = result.inScope.find((r) => r.capability.id === capability.id);
        expect(cells[j]).toHaveTextContent(
          match ? copy.levels[match.level] : site.capabilities.explorer.notApplicable,
        );
      }
    }
    expect(screen.queryByText(site.ui.comingSoon.status)).not.toBeInTheDocument();
  });
  it('shows generated recommendations, labeled assumptions, explicit unknown readiness and licensing', async () => {
    renderPage('/patterns/ai-teammate');
    await screen.findByRole('heading', {
      level: 1,
      name: content.patterns.find((p) => p.id === 'ai-teammate')!.title,
    });
    const expected = evaluateAssessment(
      content,
      patternAnswers(content, 'ai-teammate'),
      contentMeta.contentVersion,
    );
    const table = screen.getByRole('table', { name: copy.inScope });
    expect(within(table).getAllByRole('row')).toHaveLength(expected.inScope.length + 1);
    expect(screen.getByText(copy.readinessNote)).toBeInTheDocument();
    expect(screen.getByText(content.mappingConfig.licensingNote)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI teammate preview gate' })).toBeInTheDocument();
    await userEvent.click(screen.getByText(copy.answers, { selector: 'summary' }));
    expect(screen.getByText('Own access as an AI teammate', { selector: 'dd' })).toBeVisible();
    const observability = within(table)
      .getByRole('rowheader', { name: 'Agent observability & monitoring' })
      .closest('tr')!;
    await userEvent.click(within(observability).getByText(copy.why, { selector: 'summary' }));
    expect(
      within(observability).getByText(
        'Registration provides catalog visibility; telemetry needs instrumentation.',
      ),
    ).toBeVisible();
    expect(within(observability).getByText(site.learn.evidence.stated)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: site.ui.depth.technical }));
    expect(screen.getByRole('table', { name: copy.operatingModel })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: copy.anatomy })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: copy.whatIfs })).toBeInTheDocument();
    expect(within(observability).getByRole('link', { name: 'pro-code' })).toHaveAttribute(
      'href',
      '/methodology#rule-pro-code',
    );
  });
  it('merges sample overrides visibly without creating an assessment or adding storage', async () => {
    const router = renderPage('/patterns/process-agent');
    await screen.findByRole('heading', { level: 1, name: 'Process agent' });
    await userEvent.click(screen.getByRole('link', { name: 'AskHR' }));
    await screen.findByRole('heading', { level: 1, name: 'AskHR' });
    expect(router.state.location.search).toBe('?sample=askhr');
    await userEvent.click(screen.getByText(copy.answers, { selector: 'summary' }));
    expect(screen.getByText('Employee data', { selector: 'dd' })).toBeVisible();
    expect(window.localStorage.length).toBe(0);
  });
  it.each([
    '/patterns/missing',
    '/patterns/knowledge-agent?sample=askhr',
    '/patterns/knowledge-agent?sample=missing',
    '/patterns/knowledge-agent?sample=store-operations&sample=store-operations',
  ])('rejects an invalid pattern/sample link: %s', async (path) => {
    renderPage(path);
    expect(
      await screen.findByRole('heading', { level: 1, name: site.routes.notFound.title }),
    ).toBeInTheDocument();
  });
  it('makes every rule and risk inspectable and reports SME review separately from automated tests', async () => {
    renderPage('/methodology');
    await screen.findByRole('heading', { level: 1, name: site.routes.methodology.title });
    for (const rule of content.rules)
      expect(screen.getByRole('heading', { level: 3, name: rule.id })).toBeInTheDocument();
    for (const risk of content.risks)
      expect(screen.getByRole('heading', { level: 3, name: risk.title })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: copy.golden });
    expect(within(table).getAllByRole('row')).toHaveLength(content.goldenScenarios.length + 1);
    expect(within(table).getAllByText(copy.pendingReview)).toHaveLength(
      content.goldenScenarios.length,
    );
  });
  it('adds plain-language scope, rules, risk associations and generated typical patterns to capability briefs', async () => {
    renderPage('/capabilities/registry-sync');
    await screen.findByRole('heading', { level: 1, name: 'External registry sync' });
    expect(screen.getByRole('heading', { name: copy.whenInScope })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Build platform is one of Amazon Bedrock or Google Vertex AI, SaaS platform',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'External-platform agent' })).toHaveAttribute(
      'href',
      '/patterns/external-platform-agent',
    );
    expect(screen.getByRole('link', { name: 'Agent sprawl and ownerless agents' })).toHaveAttribute(
      'href',
      '/capabilities?lens=risk&group=agent-sprawl',
    );
  });
});
