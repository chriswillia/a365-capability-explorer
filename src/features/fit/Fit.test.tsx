import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { content } from '../../lib/content/index.ts';
import { readList } from '../../lib/content/fit.ts';
import { renderRoute, seedAssessment } from '../../test-support/playbook.tsx';
import './FitPage.tsx';

const { site, fit: copy } = content;
const open = (path = '/fit') => renderRoute(path, site.routes.fit.title);
const platform = (id: string) => copy.platforms.items.find((item) => item.id === id)!;
const tool = (id: string) => copy.stack.items.find((item) => item.id === id)!;
const section = (id: string) => within(document.getElementById(id)!);

describe('stack fit', () => {
  it('opens with what stays where it is, what is new and what the page does not cover', async () => {
    await open();
    for (const statement of copy.statements.items)
      expect(screen.getByText(statement.text)).toBeInTheDocument();
    const added = section('new');
    for (const id of copy.netNew.capabilityIds) {
      const capability = content.capabilities.find((c) => c.id === id)!;
      expect(added.getByRole('link', { name: capability.shortName })).toHaveAttribute(
        'href',
        `/capabilities/${id}`,
      );
    }
    for (const item of copy.boundaries.items) expect(screen.getByText(item)).toBeInTheDocument();
  });

  it('shows how each chosen platform connects, in a table, and keeps the choice in the address', async () => {
    const user = userEvent.setup();
    const router = await open();
    const platforms = section('platforms');
    expect(platforms.getByText(copy.platforms.emptyNote)).toBeInTheDocument();
    expect(platforms.queryByRole('table')).not.toBeInTheDocument();

    await user.click(platforms.getByRole('checkbox', { name: platform('copilot-studio').label }));
    const chosen = () => new URLSearchParams(router.state.location.search).get('platforms');
    expect(chosen()).toBe('copilot-studio');
    let table = platforms.getByRole('table');
    expect(within(table).getByRole('rowheader', { name: 'Copilot Studio' })).toBeInTheDocument();
    expect(
      within(table).getByText(copy.platforms.routeLabels.native, { exact: false }),
    ).toBeVisible();

    await user.click(
      platforms.getByRole('checkbox', { name: platform('cloud-registry-sync').label }),
    );
    expect(chosen()).toBe('copilot-studio,cloud-registry-sync');
    table = platforms.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText(site.ui.badges.preview)).toBeInTheDocument();
    expect(
      within(table).getByText(platform('cloud-registry-sync').statusNote!),
    ).toBeInTheDocument();

    for (const checkbox of platforms
      .getAllByRole('checkbox')
      .filter((box) => (box as HTMLInputElement).checked))
      await user.click(checkbox);
    expect(router.state.location.search).toBe('?platforms=none');
    expect(platforms.getByText(copy.platforms.emptyNote)).toBeInTheDocument();
  });

  it('restores the choice from the address and ignores what it does not understand', async () => {
    await open('/fit?platforms=sdk-agents,microsoft-foundry&tools=stack-purview');
    const platforms = section('platforms');
    const checked = platforms
      .getAllByRole('checkbox')
      .filter((box) => (box as HTMLInputElement).checked)
      .map((box) => box.closest('label')!.textContent);
    expect(checked).toEqual([platform('microsoft-foundry').label, platform('sdk-agents').label]);
    expect(
      section('stack').getByRole('rowheader', { name: tool('stack-purview').label }),
    ).toBeVisible();
  });

  it('reads only known platform and tool ids from the address', () => {
    const known = ['a', 'b', 'c'];
    expect(readList('b,a,b', known)).toEqual(['b', 'a']);
    expect(readList('a,unknown', known)).toEqual(['a']);
    expect(readList('unknown', known)).toBeNull();
    expect(readList('none', known)).toEqual([]);
    expect(readList(null, known)).toBeNull();
  });

  it('starts from the build platform a saved assessment names', async () => {
    const { assessment } = seedAssessment({ buildPlatform: 'copilot-studio' });
    await open(`/fit?assessment=${assessment.id}`);
    const box = section('platforms').getByRole('checkbox', {
      name: platform('copilot-studio').label,
    }) as HTMLInputElement;
    expect(box.checked).toBe(true);
  });

  it('shows what Agent 365 adds to each Microsoft tool and what stays there, with its capabilities', async () => {
    const user = userEvent.setup();
    await open();
    const stack = section('stack');
    expect(stack.getByText(copy.stack.emptyNote)).toBeInTheDocument();
    await user.click(stack.getByRole('checkbox', { name: tool('stack-defender').label }));
    const row = stack.getByRole('rowheader', { name: tool('stack-defender').label }).closest('tr')!;
    expect(
      within(row).getByText(tool('stack-defender').adds, { exact: false }),
    ).toBeInTheDocument();
    expect(within(row).getByText(tool('stack-defender').stays)).toBeInTheDocument();
    const count = content.capabilities.filter((c) => c.source.console === 'Defender').length;
    expect(within(row).getByRole('link', { name: new RegExp(`^${count} ·`) })).toHaveAttribute(
      'href',
      '/capabilities?console=Defender',
    );
  });

  it('cites a Microsoft source for every statement it makes', async () => {
    await open();
    expect(
      screen.getAllByText(new RegExp(site.ui.exhibit.sourcePrefix)).length,
    ).toBeGreaterThanOrEqual(copy.statements.items.length);
  });

  it('lists every connected platform with its environment and observability, and what to tell the customer', async () => {
    await open();
    const section = within(document.getElementById('connected')!);
    const table = within(section.getByRole('table'));
    expect(table.getAllByRole('row')).toHaveLength(copy.connected.rows.length + 1);
    for (const row of copy.connected.rows) {
      const line = within(table.getByRole('rowheader', { name: row.platform }).closest('tr')!);
      expect(line.getByText(row.environment)).toBeInTheDocument();
      expect(line.getByText(copy.connected.observability[row.observability])).toBeInTheDocument();
    }
    for (const limit of copy.connected.limits) expect(section.getByText(limit)).toBeInTheDocument();
    expect(
      section.getByText(content.sources.find((s) => s.id === 'a365-connected-platforms')!.title),
    ).toBeInTheDocument();
  });

  it('names the platforms Microsoft names, and no others', () => {
    expect(copy.connected.rows.map((row) => row.platform).sort()).toEqual([
      'Amazon Bedrock',
      'Anthropic Claude',
      'Databricks Genie',
      'Google Vertex AI',
      'Oracle Generative AI Agents',
      'Salesforce Agentforce',
      'Snowflake Cortex',
    ]);
  });
});
