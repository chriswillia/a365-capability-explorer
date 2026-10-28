import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { content, sourceById } from '../../lib/content/index.ts';
import { handoffText, populationViews } from '../../lib/content/licensing.ts';
import {
  baselineRequirements,
  byProductArea,
  capabilityRequirements,
} from '../../lib/content/requirements.ts';
import { DIAGNOSTIC_STORAGE_KEY } from '../../lib/state/diagnostic-storage.ts';
import { STORAGE_PREFIX } from '../../lib/state/storage.ts';
import { optionLabel, renderRoute, seedAssessment } from '../../test-support/playbook.tsx';
import './LicensingPage.tsx';

const { site, licensing: copy } = content;
const panel = copy.requirementsPanel;
const open = (path = '/licensing') => renderRoute(path, site.routes.licensing.title);
const stored = () => window.localStorage.getItem(`${STORAGE_PREFIX}${DIAGNOSTIC_STORAGE_KEY}`);

describe('licensing and prerequisites', () => {
  it('says who to license for how the agent acts and greys out what does not apply', async () => {
    await open('/licensing?access=delegated');
    const views = populationViews(content, { access: 'delegated', audience: null });
    expect(views.some((view) => view.relevant === false)).toBe(true);
    for (const { population, relevant } of views) {
      const card = screen.getByRole('heading', { level: 3, name: population.label }).closest('li')!;
      expect(within(card).getByText(copy.needs[population.need])).toBeInTheDocument();
      if (relevant === false)
        expect(within(card).getByText(copy.who.notApplicable)).toBeInTheDocument();
      if (relevant === true)
        expect(within(card).getByText(copy.who.appliesToYou)).toBeInTheDocument();
    }
  });

  it('shows what Microsoft does not state as a question for the licensing specialist', async () => {
    await open();
    const open_ = content.licensing.who.populations.filter(
      (population) => population.need === 'not-stated',
    );
    expect(open_.length).toBeGreaterThan(0);
    for (const population of open_) {
      const card = screen.getByRole('heading', { level: 3, name: population.label }).closest('li')!;
      expect(within(card).getByText(population.confirm!, { exact: false })).toBeInTheDocument();
    }
  });

  it('starts from a saved assessment without changing it', async () => {
    const { assessment } = seedAssessment(
      { accessModel: 'own-teammate', audience: ['partners'] },
      { basePlan: 'm365-e5' },
    );
    const before = stored();
    const user = userEvent.setup();
    await open(`/licensing?assessment=${assessment.id}`);
    expect(screen.getByLabelText(panel.assessmentLabel)).toHaveValue(assessment.id);
    expect(screen.getByLabelText(copy.who.accessLabel)).toHaveValue('own-teammate');

    const segment = copy.prerequisites.segments.find((s) => s.basePlans.includes('m365-e5'))!;
    const heading = screen
      .getAllByRole('heading', { level: 4 })
      .find((h) => h.textContent?.startsWith(segment.label))!;
    expect(within(heading.closest('li')!).getByText(copy.who.appliesToYou)).toBeInTheDocument();

    const external = copy.who.populations.find((p) => p.id === 'external-users')!;
    expect(
      within(
        screen.getByRole('heading', { level: 3, name: external.label }).closest('li')!,
      ).getByText(copy.who.appliesToYou),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(copy.who.accessLabel), 'delegated');
    expect(stored()).toBe(before);
  });

  it('marks each prerequisite as in place, a gap or to confirm from the assessment', async () => {
    const answers = { basePlan: 'm365-e5', agent365Status: 'none' };
    const { assessment } = seedAssessment({ accessModel: 'delegated' }, answers);
    await open(`/licensing?assessment=${assessment.id}`);
    const section = within(document.getElementById('requirements')!);
    const expected = baselineRequirements(content, { ...answers, accessModel: 'delegated' });
    expect(new Set(expected.map(({ status }) => status))).toEqual(
      new Set(['ready', 'gap', 'unknown']),
    );
    for (const { item, status } of expected) {
      const line = section.getByText(item.text, { exact: false }).closest('li')!;
      expect(within(line).getByText(panel.status[status])).toBeInTheDocument();
    }
  });

  it('does not treat an access answer recorded as unknown as a decision, and says what depends on it', async () => {
    const { assessment } = seedAssessment({ accessModel: 'unknown', audience: ['unknown'] });
    await open(`/licensing?assessment=${assessment.id}`);
    expect(screen.getByLabelText(copy.who.accessLabel)).toHaveValue('any');
    for (const id of ['delegating-users', 'own-access-owners', 'external-users']) {
      const population = content.licensing.who.populations.find((p) => p.id === id)!;
      const card = screen.getByRole('heading', { level: 3, name: population.label }).closest('li')!;
      expect(within(card).queryByText(copy.who.notApplicable)).not.toBeInTheDocument();
      expect(within(card).queryByText(copy.who.appliesToYou)).not.toBeInTheDocument();
    }
  });

  it('ignores saved answers that no longer fit the questions, and links to fix them', async () => {
    const { assessment } = seedAssessment(
      { accessModel: 'a-removed-option' },
      { basePlan: 'm365-e5' },
    );
    await open(`/licensing?assessment=${assessment.id}`);
    const note = within(document.getElementById('who')!).getByRole('note');
    expect(note).toHaveTextContent(site.diagnostic.incompatible);
    expect(within(note).getByRole('link', { name: site.ui.customer.edit })).toHaveAttribute(
      'href',
      `/diagnostic/${assessment.id}`,
    );
    expect(screen.getByLabelText(copy.who.accessLabel)).toHaveValue('any');
    const requirements = within(document.getElementById('requirements')!);
    for (const status of Object.values(panel.status))
      expect(requirements.queryByText(status)).not.toBeInTheDocument();
  });

  it('lists what each capability needs by product area, as tables', async () => {
    await open();
    const groups = byProductArea(content, capabilityRequirements(content, null));
    const tables = within(document.getElementById('requirements')!).getAllByRole('table');
    expect(tables).toHaveLength(groups.length);
    for (const [index, group] of groups.entries())
      expect(within(tables[index]!).getAllByRole('rowheader')).toHaveLength(group.views.length);
    const total = tables.flatMap((table) => within(table).getAllByRole('rowheader')).length;
    expect(total).toBe(content.capabilities.length);
  });

  it('copies a note for the licensing specialist and keeps the customer name out of storage and the address', async () => {
    const user = userEvent.setup();
    const router = await open('/licensing?access=own-background');
    await user.type(screen.getByLabelText(content.value.brief.customerLabel), 'Fictional Customer');
    await user.click(screen.getByRole('button', { name: copy.handoff.copy }));
    const expected = handoffText(content, {
      customer: 'Fictional Customer',
      access: 'own-background',
      accessLabel: optionLabel('accessModel', 'own-background'),
      audience: null,
    });
    expect(await navigator.clipboard.readText()).toBe(expected);
    expect(expected).toContain('Fictional Customer');
    expect(screen.getByRole('status')).toHaveTextContent(copy.handoff.copied);
    expect(router.state.location.search).not.toContain('Fictional');
    expect(stored() ?? '').not.toContain('Fictional');
  });

  it('shows the plans, the two tiers, sizing, regulated clouds and what stays unlicensed', async () => {
    await open();
    for (const heading of [
      copy.who.heading,
      copy.options.heading,
      copy.tiers.heading,
      panel.heading,
      copy.sizing.heading,
      copy.regulated.heading,
      copy.other.heading,
      copy.help.heading,
      copy.handoff.heading,
    ])
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    const plans = within(document.getElementById('plans')!);
    for (const item of copy.options.items)
      expect(plans.getAllByText(item, { selector: 'li' }).length).toBeGreaterThan(0);
    const agents = copy.who.populations.find((p) => p.need === 'not-licensed')!;
    expect(screen.getByRole('heading', { level: 3, name: agents.label })).toBeInTheDocument();
  });

  it('shows what the Product Terms require and where public sources differ on the prerequisite', async () => {
    await open();
    const plans = within(document.getElementById('plans')!);
    const { productTerms, differs } = copy.prerequisites;
    expect(
      plans.getByRole('heading', { level: 4, name: productTerms.heading }),
    ).toBeInTheDocument();
    for (const plan of productTerms.plans)
      expect(plans.getByText(plan, { selector: 'li' })).toBeInTheDocument();
    expect(plans.getByRole('heading', { level: 4, name: differs.heading })).toBeInTheDocument();
    for (const item of differs.items) {
      const entry = plans.getByText(item.topic).closest('li')!;
      for (const statement of item.statements) {
        expect(within(entry).getByText(statement.text)).toBeInTheDocument();
        expect(
          within(entry).getByText(sourceById(statement.sourceId)!.title, { selector: 'dt' }),
        ).toBeInTheDocument();
      }
      expect(within(entry).getByText(item.advice)).toBeInTheDocument();
    }
  });

  it('says where each requirement applies and asks the customer while it is unconfirmed', async () => {
    await open();
    const section = within(document.getElementById('requirements')!);
    const license = baselineRequirements(content, null).find(
      ({ item }) => item.id === 'agent-365-license',
    )!.item;
    const line = section.getByText(license.text, { exact: false }).closest('li')!;
    expect(
      within(line).getByText(`${panel.levelLabel}: ${panel.levels[license.appliesTo!]}`),
    ).toBeInTheDocument();
    expect(within(line).getByText(license.askPrompt!, { exact: false })).toBeInTheDocument();
    expect(within(line).getByText(`${panel.askLabel}:`)).toBeInTheDocument();
  });

  it('stops asking about a requirement once the assessment answers it', async () => {
    const { assessment } = seedAssessment({ accessModel: 'delegated' }, { basePlan: 'm365-e7' });
    await open(`/licensing?assessment=${assessment.id}`);
    const section = within(document.getElementById('requirements')!);
    const baseline = baselineRequirements(content, null);
    const answered = baseline.find(({ item }) => item.id === 'agent-365-license')!.item;
    const answeredLine = section.getByText(answered.text, { exact: false }).closest('li')!;
    expect(
      within(answeredLine).queryByText(answered.askPrompt!, { exact: false }),
    ).not.toBeInTheDocument();
    const open_ = baseline.find(({ item }) => item.id === 'accept-terms')!.item;
    const openLine = section.getByText(open_.text, { exact: false }).closest('li')!;
    expect(within(openLine).getByText(open_.askPrompt!, { exact: false })).toBeInTheDocument();
  });

  it('lists public help with deployment, each with its source', async () => {
    await open();
    const section = within(document.getElementById('help')!);
    for (const item of copy.help.items) {
      const line = section.getByText(item.text).closest('li')!;
      expect(within(line).getByText(sourceById(item.sourceIds[0]!)!.title)).toBeInTheDocument();
    }
  });
});
