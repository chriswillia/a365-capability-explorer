import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { content } from '../../lib/content/index.ts';
import { renderRoute, seedAssessment } from '../../test-support/playbook.tsx';
import './DeployPage.tsx';

const { site, deploy: copy, guardrails } = content;
const open = (path = '/deploy') => renderRoute(path, site.routes.deploy.title);
const gate = (title: string) =>
  within(screen.getByRole('heading', { level: 3, name: title }).closest('div')!);
const answers = {
  accessModel: 'own-background',
  buildPlatform: 'microsoft-foundry',
  dataSensitivity: 'confidential',
  tools: ['third-party-mcp'],
  autonomy: 'autonomous',
  audience: ['employees'],
  stage: 'production',
  sponsor: 'not-yet',
};

describe('deploy', () => {
  it('lists every gate and step for any agent, saying how to show each works', async () => {
    await open();
    expect(screen.getByText(copy.noAssessmentNote)).toBeInTheDocument();
    for (const g of guardrails.gates) {
      const section = gate(g.title);
      for (const item of guardrails.items.filter((i) => i.gate === g.id)) {
        const step = within(
          section.getByRole('heading', { level: 4, name: item.title }).closest('li')!,
        );
        expect(step.getByText(item.why)).toBeInTheDocument();
        expect(step.getByText(item.action)).toBeInTheDocument();
        expect(step.getByText(item.proveIt)).toBeInTheDocument();
        expect(step.getByText(copy.baseline.proveLabel)).toBeInTheDocument();
      }
    }
    expect(screen.queryByText(guardrails.statusLabels.ready)).not.toBeInTheDocument();
  });

  it('says where a step is configured, who owns it and which controls it brings in', async () => {
    await open();
    const step = within(
      screen
        .getByRole('heading', { level: 4, name: 'Keep audit evidence of what the agent does' })
        .closest('li')!,
    );
    expect(step.getByText(copy.baseline.whereLabel)).toBeInTheDocument();
    expect(step.getAllByText('Microsoft Purview', { exact: false }).length).toBeGreaterThan(0);
    expect(step.getByText(copy.baseline.ownerLabel)).toBeInTheDocument();
    const audit = content.capabilities.find((c) => c.id === 'purview-audit-ediscovery')!;
    expect(step.getByRole('link', { name: audit.shortName })).toHaveAttribute(
      'href',
      '/capabilities/purview-audit-ediscovery',
    );
  });

  it('marks the steps from a saved agent, with the gaps first and a count', async () => {
    const { assessment } = seedAssessment(answers, { cloudEnvironment: 'commercial' });
    await open(`/deploy?assessment=${assessment.id}`);
    expect(screen.getByLabelText(copy.assessmentLabel)).toHaveValue(assessment.id);
    const pilot = gate(guardrails.gates[0]!.title);
    const first = pilot.getAllByRole('heading', { level: 4 })[0]!;
    expect(first).toHaveTextContent('Register the agent and name an accountable owner and sponsor');
    const card = within(first.closest('li')!);
    expect(card.getByText(guardrails.statusLabels.gap)).toBeInTheDocument();
    expect(document.getElementById('baseline')).toHaveTextContent(
      /\d+ in place, \d+ gaps?, \d+ to confirm/,
    );
  });

  it('sets out a plan for 30, 60 and 90 days as a table, with the controls to bring in', async () => {
    const { assessment } = seedAssessment(answers, { cloudEnvironment: 'commercial' });
    await open(`/deploy?assessment=${assessment.id}`);
    const table = within(within(document.getElementById('plan')!).getByRole('table'));
    expect(table.getAllByRole('row')).toHaveLength(copy.plan.periods.length + 1);
    expect(table.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      copy.plan.columns.period,
      copy.plan.columns.steps,
      copy.plan.columns.controls,
    ]);
    for (const period of copy.plan.periods) {
      const row = within(
        table.getByRole('rowheader', { name: new RegExp(period.title) }).closest('tr')!,
      );
      const items = guardrails.items.filter((i) => i.gate === period.gate);
      expect(row.getByText(items[0]!.title, { exact: false })).toBeInTheDocument();
    }
    expect(table.getAllByRole('link').length).toBeGreaterThan(0);
  });

  it('keeps the plan without controls when no agent is chosen', async () => {
    await open();
    const table = within(within(document.getElementById('plan')!).getByRole('table'));
    expect(table.getAllByText(copy.plan.none)).toHaveLength(copy.plan.periods.length);
  });

  it('changes agent from the picker and keeps the choice in the address', async () => {
    const user = userEvent.setup();
    const { assessment } = seedAssessment(answers);
    const router = await open();
    await user.selectOptions(screen.getByLabelText(copy.assessmentLabel), assessment.id);
    expect(router.state.location.search).toBe(`?assessment=${assessment.id}`);
    expect(document.getElementById('baseline')).toHaveTextContent(/\d+ in place/);
  });

  it('says when the agent is not saved here, and ignores answers it cannot read', async () => {
    await open(`/deploy?assessment=${crypto.randomUUID()}`);
    expect(screen.getByRole('alert')).toHaveTextContent(copy.missing);
  });

  it('ignores saved answers that no longer fit the questions, and links to fix them', async () => {
    const { assessment } = seedAssessment({ accessModel: 'not-a-real-answer' });
    await open(`/deploy?assessment=${assessment.id}`);
    expect(screen.getByRole('alert')).toHaveTextContent(copy.incompatible);
    expect(screen.getByRole('link', { name: site.routes.diagnostic.title })).toHaveAttribute(
      'href',
      `/diagnostic/${assessment.id}`,
    );
  });
});
