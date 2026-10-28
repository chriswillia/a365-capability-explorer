import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { content, metrics, values } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { renderRoute } from '../../test-support/playbook.tsx';

const { site } = content;
const glance = site.capabilities.glance;

async function renderGlance(path = '/capabilities') {
  await renderRoute(path, site.routes.capabilities.title);
  const summary = screen.getByText(glance.heading, { selector: 'summary' });
  return within(summary.closest('details') as HTMLElement);
}

describe('the catalog at a glance', () => {
  it('sits on the Capabilities page, closed until a seller wants the numbers', async () => {
    await renderRoute('/capabilities', site.routes.capabilities.title);
    const summary = screen.getByText(glance.heading, { selector: 'summary' });
    expect((summary.closest('details') as HTMLDetailsElement).open).toBe(false);
  });

  it('shows KPIs that are computed from the content, not typed', async () => {
    const panel = await renderGlance();
    for (const kpi of glance.kpis) {
      const tile = panel.getByText(kpi.label).closest('div') as HTMLElement;
      expect(tile).toHaveTextContent(String(metrics[kpi.valueKey]));
    }
  });

  it('links every number to the capabilities it counts, and every area to its capabilities', async () => {
    const panel = await renderGlance();
    for (const kpi of glance.kpis)
      expect(panel.getByRole('link', { name: kpi.label })).toHaveAttribute('href', kpi.href);
    const gcc = glance.kpis.find((kpi) => kpi.noteHref !== undefined)!;
    expect(
      panel.getByRole('link', { name: renderTemplate(gcc.noteTemplate!, values) }),
    ).toHaveAttribute('href', gcc.noteHref);
    for (const pillar of content.pillars)
      expect(panel.getByRole('link', { name: pillar.label })).toHaveAttribute(
        'href',
        `/capabilities?pillar=${pillar.id}`,
      );
  });

  it('generates the exhibit title from the data, with the right verbs for the counts', async () => {
    const panel = await renderGlance();
    expect(
      panel.getByRole('heading', {
        level: 2,
        name: renderTemplate(glance.exhibits.glance.titleTemplate, values),
      }),
    ).toBeInTheDocument();
  });

  it('states that most of Agent 365 is a platform foundation, because the data supports it', async () => {
    const panel = await renderGlance();
    expect(panel.getByText(glance.insights.platformFoundation)).toBeInTheDocument();
  });

  it('adds where-it-is-configured and layer detail only in the Technical view', async () => {
    const panel = await renderGlance();
    expect(panel.queryByRole('table')).not.toBeInTheDocument();
    expect(panel.getByText(glance.technicalHint)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: site.ui.depth.technical }));
    const tables = await panel.findAllByRole('table');
    expect(tables).toHaveLength(2);
    expect(within(tables[0] as HTMLElement).getAllByRole('row')).toHaveLength(
      content.consoles.length + 1,
    );
    expect(panel.queryByText(glance.technicalHint)).not.toBeInTheDocument();
  });
});
