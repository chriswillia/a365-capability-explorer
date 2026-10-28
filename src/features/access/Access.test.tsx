import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { content } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { renderRoute, seedAssessment } from '../../test-support/playbook.tsx';
import './AccessPage.tsx';

const { site, accessPatterns: copy } = content;
const open = (path = '/access') => renderRoute(path, site.routes.access.title);
const section = (id: string) => within(document.getElementById(id)!);
const nameOf = (id: string) => content.capabilities.find((c) => c.id === id)!.shortName;

// "Own access" is a prefix of "Own access with an agent account", so match the heading's own text.
const card = (label: string) => {
  const heading = [...document.querySelectorAll('#patterns h3')].find(
    (h) => h.firstChild?.textContent === label,
  );
  if (heading === undefined) throw new Error(`No card for ${label}`);
  return heading.closest('li')!;
};

describe('how an agent acts', () => {
  it('explains the three ways in Microsoft terms, with who to license for each', async () => {
    await open();
    expect(screen.getByText(copy.termsNote)).toBeInTheDocument();
    for (const pattern of copy.patterns) {
      const item = within(card(pattern.label));
      expect(item.getByText(pattern.plain)).toBeInTheDocument();
      expect(item.getByText(pattern.terms.join('; '), { exact: false })).toBeInTheDocument();
      for (const id of pattern.licensingIds) {
        const population = content.licensing.who.populations.find((p) => p.id === id)!;
        expect(
          item.getByText(`${population.label} (${content.licensing.needs[population.need]})`),
        ).toBeInTheDocument();
      }
      expect(item.getByRole('link', { name: copy.openLicensing }).getAttribute('href')).toMatch(
        /^\/licensing\?access=(delegated|own-)/,
      );
    }
  });

  it('calls it own access, as Microsoft describes it, and never "owned access"', async () => {
    await open();
    expect(copy.patterns.map((p) => p.label)).toContain('Own access');
    expect(document.getElementById('main')!.textContent).not.toMatch(/\bowned access\b/i);
  });

  it('asks for an assessment before it shows what changes', async () => {
    await open();
    expect(section('change').getByText(copy.viewNoAssessment)).toBeInTheDocument();
    expect(section('change').getByLabelText(copy.assessmentLabel)).toHaveValue('');
  });

  it('shows what changes for an assessment, marks the way it acts and does not overstate the difference', async () => {
    const user = userEvent.setup();
    const { assessment } = seedAssessment({ accessModel: 'delegated' });
    const router = await open();
    await user.selectOptions(section('change').getByLabelText(copy.assessmentLabel), assessment.id);
    expect(router.state.location.search).toBe(`?assessment=${assessment.id}`);

    expect(within(card('Delegated access')).getByText(copy.currentBadge)).toBeInTheDocument();
    expect(
      within(card('Own access with an agent account')).queryByText(copy.currentBadge),
    ).toBeNull();

    const change = section('change');
    const only = change.getByRole('heading', {
      level: 3,
      name: new RegExp(`^${renderTemplate(copy.changeOnly, { label: 'Delegated access' })}`),
    });
    expect(
      within(only.closest('section')!).getByRole('link', {
        name: nameOf('entra-conditional-access'),
      }),
    ).toBeInTheDocument();
    expect(
      change.getByText(
        renderTemplate(copy.changeAlso, {
          label: 'Own access or Own access with an agent account',
        }),
      ),
    ).toBeInTheDocument();
    expect(
      change.getByRole('heading', { level: 3, name: new RegExp(`^${copy.changeBoth}`) }),
    ).toBeInTheDocument();
  });

  it('says so when the assessment has not said how the agent acts, and still compares', async () => {
    const { assessment } = seedAssessment({});
    await open(`/access?assessment=${assessment.id}`);
    const change = section('change');
    expect(change.getByText(copy.thisAgentUnknown)).toBeInTheDocument();
    expect(
      change.getByRole('heading', { level: 3, name: new RegExp(`^${copy.changeBoth}`) }),
    ).toBeInTheDocument();
  });

  it('declines to compare saved answers that no longer fit the questions, and links to fix them', async () => {
    const { assessment } = seedAssessment({ accessModel: 'a-removed-option' });
    await open(`/access?assessment=${assessment.id}`);
    const note = section('change').getByRole('note');
    expect(note).toHaveTextContent(site.diagnostic.incompatible);
    expect(within(note).getByRole('link', { name: site.ui.customer.edit })).toHaveAttribute(
      'href',
      `/diagnostic/${assessment.id}`,
    );
    expect(section('change').queryByRole('heading', { level: 3 })).toBeNull();
  });

  it('shows what Microsoft documents by way of acting as a table, and says where the sources differ', async () => {
    await open();
    const stated = section('stated');
    const table = stated.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(copy.capabilities.length + 1);
    for (const row of copy.capabilities) {
      const tr = within(table)
        .getByRole('rowheader', { name: nameOf(row.capabilityId) })
        .closest('tr')!;
      expect(within(tr).getAllByText(copy.applicability[row.own]).length).toBeGreaterThan(0);
      expect(within(tr).getByText(row.note, { exact: false })).toBeInTheDocument();
    }
    expect(stated.getByText(copy.unsplit)).toBeInTheDocument();
    expect(section('sources-differ').getByText(copy.tension.text)).toBeInTheDocument();
  });

  it('says whether each availability statement is generally available, preview or Frontier preview', async () => {
    await open();
    const availability = section('availability');
    for (const entry of copy.statuses) {
      const line = availability.getByText(entry.label, { exact: false }).closest('li')!;
      expect(within(line).getByText(copy.statusNames[entry.status])).toBeInTheDocument();
    }
  });
});
