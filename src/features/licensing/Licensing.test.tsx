import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { content, sourceById } from '../../lib/content/index.ts';
import { handoffText, populationViews } from '../../lib/content/licensing.ts';
import {
  baselineRequirements,
  byProductArea,
  capabilityRequirements,
} from '../../lib/content/requirements.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { DIAGNOSTIC_STORAGE_KEY } from '../../lib/state/diagnostic-storage.ts';
import { STORAGE_PREFIX } from '../../lib/state/storage.ts';
import { optionLabel, renderRoute, seedAssessment } from '../../test-support/playbook.tsx';
import './LicensingPage.tsx';

const { site, licensing: copy } = content;
const panel = copy.requirementsPanel;
const open = (path = '/licensing') => renderRoute(path, site.routes.licensing.title);
const part = (name: string) =>
  within(screen.getByRole('navigation', { name: site.ui.views.label })).getByRole('link', {
    name,
  });
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

    const external = copy.who.populations.find((p) => p.id === 'external-users')!;
    expect(
      within(
        screen.getByRole('heading', { level: 3, name: external.label }).closest('li')!,
      ).getByText(copy.who.appliesToYou),
    ).toBeInTheDocument();

    await user.click(part(copy.views.plans));
    const segment = copy.prerequisites.segments.find((s) => s.basePlans.includes('m365-e5'))!;
    const heading = screen
      .getAllByRole('heading', { level: 4 })
      .find((h) => h.textContent?.startsWith(segment.label))!;
    expect(within(heading.closest('li')!).getByText(copy.who.appliesToYou)).toBeInTheDocument();

    await user.click(part(copy.views.who));
    await user.selectOptions(screen.getByLabelText(copy.who.accessLabel), 'delegated');
    expect(stored()).toBe(before);
  });

  it('marks each prerequisite as in place, a gap or to confirm from the assessment', async () => {
    const answers = { basePlan: 'm365-e5', agent365Status: 'none' };
    const { assessment } = seedAssessment({ accessModel: 'delegated' }, answers);
    await open(`/licensing?view=needs&assessment=${assessment.id}`);
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
    const user = userEvent.setup();
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
    await user.click(part(copy.views.needs));
    const requirements = within(document.getElementById('requirements')!);
    for (const status of Object.values(panel.status))
      expect(requirements.queryByText(status)).not.toBeInTheDocument();
  });

  it('lists what each capability needs by product area, as tables, each area closed until opened', async () => {
    await open('/licensing?view=needs');
    const groups = byProductArea(content, capabilityRequirements(content, null));
    const tables = within(document.getElementById('requirements')!).getAllByRole('table');
    expect(tables).toHaveLength(groups.length);
    for (const [index, group] of groups.entries()) {
      expect(within(tables[index]!).getAllByRole('rowheader')).toHaveLength(group.views.length);
      const panelElement = document.getElementById(
        `needs-${group.console.id}`,
      ) as HTMLDetailsElement;
      expect(panelElement.open).toBe(false);
      expect(
        within(panelElement).getByText(
          renderTemplate(panel.areaSummary, {
            label: group.console.displayName,
            count: group.views.length,
          }),
        ),
      ).toBeInTheDocument();
    }
    const total = tables.flatMap((table) => within(table).getAllByRole('rowheader')).length;
    expect(total).toBe(content.capabilities.length);
  });

  it('opens the product area a link points at', async () => {
    const group = byProductArea(content, capabilityRequirements(content, null))[1]!;
    await open(`/licensing#needs-${group.console.id}`);
    const panelElement = document.getElementById(`needs-${group.console.id}`) as HTMLDetailsElement;
    await waitFor(() => expect(panelElement.open).toBe(true));
  });

  it('copies a note for the licensing specialist and keeps the customer name out of storage and the address', async () => {
    const user = userEvent.setup();
    const router = await open('/licensing?access=own-background&view=specialist');
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
    expect(within(document.getElementById('handoff')!).getByRole('status')).toHaveTextContent(
      copy.handoff.copied,
    );
    expect(router.state.location.search).not.toContain('Fictional');
    expect(stored() ?? '').not.toContain('Fictional');
  });

  it('shows the plans, the two tiers, sizing, regulated clouds and what stays unlicensed, one part at a time', async () => {
    const user = userEvent.setup();
    await open();
    const parts: [string, string[]][] = [
      [copy.views.who, [copy.who.heading, copy.tiers.heading]],
      [copy.views.size, [copy.calculator.heading, copy.sizing.heading]],
      [copy.views.plans, [copy.options.heading]],
      [copy.views.needs, [panel.heading]],
      [
        copy.views.specialist,
        [copy.regulated.heading, copy.other.heading, copy.help.heading, copy.handoff.heading],
      ],
    ];
    const agents = copy.who.populations.find((p) => p.need === 'not-licensed')!;
    expect(screen.getByRole('heading', { level: 3, name: agents.label })).toBeInTheDocument();
    for (const [label, headings] of parts) {
      await user.click(part(label));
      expect(part(label)).toHaveAttribute('aria-current', 'true');
      for (const heading of headings)
        expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
    await user.click(part(copy.views.plans));
    const plans = within(document.getElementById('plans')!);
    for (const item of copy.options.items)
      expect(plans.getAllByText(item, { selector: 'li' }).length).toBeGreaterThan(0);
  });

  it('shows what the Product Terms require and where public sources differ on the prerequisite', async () => {
    await open('/licensing?view=plans');
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
    await open('/licensing?view=needs');
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
    await open(`/licensing?view=needs&assessment=${assessment.id}`);
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
    await open('/licensing?view=specialist');
    const section = within(document.getElementById('help')!);
    for (const item of copy.help.items) {
      const line = section.getByText(item.text).closest('li')!;
      expect(within(line).getByText(sourceById(item.sourceIds[0]!)!.title)).toBeInTheDocument();
    }
  });
});

describe('the license calculator', () => {
  const calc = copy.calculator;
  const seatField = (id: string) =>
    screen.getByLabelText(calc.planFamilies.find((family) => family.id === id)!.label);
  const result = (label: string) =>
    within(document.getElementById('calculator')!).getByText(label).closest('div')!;

  it('sizes the licenses from the counts, and shows the sources behind the rules', async () => {
    const user = userEvent.setup();
    await open('/licensing?view=size');
    expect(screen.getByText(calc.waiting)).toBeInTheDocument();
    await user.type(screen.getByLabelText(calc.people.delegating.label), '100');
    await user.type(screen.getByLabelText(calc.people.owners.label), '10');
    await user.type(screen.getByLabelText(calc.people.overlap.label), '4');
    await user.type(screen.getByLabelText(calc.people.everyone.label), '200');
    await user.type(seatField('e7'), '30');
    await user.type(seatField('e5-a5-g5'), '50');
    expect(within(result(calc.results.required.label)).getByText('106')).toBeInTheDocument();
    expect(within(result(calc.results.recommended.label)).getByText('200')).toBeInTheDocument();
    expect(within(result(calc.results.included.label)).getByText('30')).toBeInTheDocument();
    expect(within(result(calc.results.qualifying.label)).getByText('50')).toBeInTheDocument();
    expect(within(result(calc.results.needsPlan.label)).getByText('26')).toBeInTheDocument();
    expect(within(result(calc.results.toAdd.label)).getByText('76')).toBeInTheDocument();
    expect(
      within(result(calc.results.required.label)).getByText(sourceById('lic-faq')!.title),
    ).toBeInTheDocument();
    expect(screen.queryByText(calc.waiting)).not.toBeInTheDocument();
  });

  it('labels every plan with whether it qualifies, in words', async () => {
    await open('/licensing?view=size');
    for (const family of calc.planFamilies) {
      const card = seatField(family.id).closest('li')!;
      expect(within(card).getByText(calc.standings[family.standing])).toBeInTheDocument();
      expect(within(card).getByText(family.text)).toBeInTheDocument();
    }
  });

  it('lowers an overlap that is more than either group and says so', async () => {
    const user = userEvent.setup();
    await open('/licensing?view=size');
    await user.type(screen.getByLabelText(calc.people.delegating.label), '5');
    await user.type(screen.getByLabelText(calc.people.owners.label), '3');
    await user.type(screen.getByLabelText(calc.people.overlap.label), '9');
    expect(within(result(calc.results.required.label)).getByText('5')).toBeInTheDocument();
    expect(screen.getByText(calc.warnings.overlapReduced.replace('{n}', '3'))).toBeInTheDocument();
  });

  it('lets the seller correct an estimate, and keeps it within what the seats allow', async () => {
    const user = userEvent.setup();
    await open('/licensing?view=size');
    await user.type(screen.getByLabelText(calc.people.delegating.label), '100');
    await user.type(seatField('e5-a5-g5'), '50');
    await user.type(
      screen.getByLabelText(`${calc.estimateLabel}: ${calc.results.qualifying.label}`),
      '20',
    );
    expect(within(result(calc.results.qualifying.label)).getByText('20')).toBeInTheDocument();
    expect(within(result(calc.results.needsPlan.label)).getByText('80')).toBeInTheDocument();
  });

  it('asks what a person needs first only while people still need a plan', async () => {
    const user = userEvent.setup();
    await open('/licensing?view=size');
    expect(screen.queryByText(calc.firstHeading)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(calc.people.delegating.label), '10');
    expect(screen.getByRole('heading', { level: 3, name: calc.firstHeading })).toBeInTheDocument();
    for (const plan of copy.prerequisites.productTerms.plans)
      expect(
        within(screen.getByRole('heading', { name: calc.firstHeading }).parentElement!).getByText(
          plan,
        ),
      ).toBeInTheDocument();
    await user.type(seatField('e7'), '10');
    expect(screen.queryByText(calc.firstHeading)).not.toBeInTheDocument();
  });

  it('copies the sizing as Markdown and clears the numbers, and stores nothing', async () => {
    const user = userEvent.setup();
    await open('/licensing?view=size');
    const before = window.localStorage.length;
    await user.type(screen.getByLabelText(calc.people.delegating.label), '12');
    await user.click(screen.getByRole('button', { name: calc.copy }));
    const text = await navigator.clipboard.readText();
    expect(text).toContain(`# ${calc.export.title}`);
    expect(text).toContain(`- ${calc.results.required.label}: 12`);
    expect(
      within(document.getElementById('calculator')!).getByText(calc.copied),
    ).toBeInTheDocument();
    expect(window.localStorage.length).toBe(before);
    await user.click(screen.getByRole('button', { name: calc.reset }));
    expect(screen.getByLabelText(calc.people.delegating.label)).toHaveValue('');
    expect(screen.getByText(calc.waiting)).toBeInTheDocument();
  });
});

describe('licensing: one part at a time', () => {
  it('offers the five parts as links and opens on who needs a license', async () => {
    await open();
    const links = within(
      screen.getByRole('navigation', { name: site.ui.views.label }),
    ).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      copy.views.who,
      copy.views.size,
      copy.views.plans,
      copy.views.needs,
      copy.views.specialist,
    ]);
    expect(links[0]).toHaveAttribute('aria-current', 'true');
    expect(links[1]).toHaveAttribute('href', '/licensing?view=size');
    expect(
      screen.queryByRole('heading', { level: 2, name: panel.heading }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['calculator', copy.views.size],
    ['plans', copy.views.plans],
    ['requirements', copy.views.needs],
    ['regulated', copy.views.specialist],
    ['handoff', copy.views.specialist],
  ])('keeps the address that points at #%s opening the part that holds it', async (id, label) => {
    await open(`/licensing#${id}`);
    expect(part(label)).toHaveAttribute('aria-current', 'true');
    expect(document.getElementById(id)).toBeVisible();
  });

  it('keeps the numbers typed into the calculator while the seller looks at another part', async () => {
    const user = userEvent.setup();
    await open('/licensing?view=size');
    await user.type(screen.getByLabelText(copy.calculator.people.delegating.label), '42');
    await user.click(part(copy.views.plans));
    expect(screen.getByLabelText(copy.calculator.people.delegating.label)).not.toBeVisible();
    await user.click(part(copy.views.size));
    expect(screen.getByLabelText(copy.calculator.people.delegating.label)).toHaveValue('42');
  });

  it('keeps the chosen agent while the seller moves between parts', async () => {
    const user = userEvent.setup();
    const { assessment } = seedAssessment({ accessModel: 'delegated' }, { basePlan: 'm365-e5' });
    await open(`/licensing?assessment=${assessment.id}`);
    await user.click(part(copy.views.needs));
    expect(part(copy.views.who)).toHaveAttribute('href', `/licensing?assessment=${assessment.id}`);
    expect(part(copy.views.plans)).toHaveAttribute(
      'href',
      `/licensing?assessment=${assessment.id}&view=plans`,
    );
  });
});
