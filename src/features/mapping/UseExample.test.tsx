import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { content } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { loadDiagnostics } from '../../lib/state/diagnostic-storage.ts';
import { addSampleCustomer } from '../../lib/state/sample.ts';
import { renderRoute, seedAssessment } from '../../test-support/playbook.tsx';
import '../diagnostic/DiagnosticLayout.tsx';
import '../passport/PassportPage.tsx';
import './PatternPage.tsx';

const { site } = content;
const copy = site.mapping.use;
const pattern = content.patterns.find((p) => p.id === 'customer-agent')!;
const saved = () => loadDiagnostics().data;
const open = (path = `/patterns/${pattern.id}`, title = pattern.title) => renderRoute(path, title);

describe('using an example for the customer agent', () => {
  it('saves nothing when the page opens, and only on the click', async () => {
    await open();
    expect(saved().assessments).toHaveLength(0);
    expect(screen.getByRole('button', { name: copy.button })).toBeInTheDocument();
    expect(screen.getByText(copy.hint)).toBeInTheDocument();
  });

  it("saves the example as the customer's agent and opens its passport with the answers filled in", async () => {
    const user = userEvent.setup();
    const router = await open();
    // Nobody is saved yet, so there is no customer to choose.
    expect(screen.queryByLabelText(copy.customerLabel)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.button }));

    await screen.findByRole('heading', { level: 1, name: site.routes.map.title });
    const agent = saved().assessments[0]!;
    expect(router.state.location.pathname).toBe('/map');
    expect(router.state.location.search).toBe(`?assessment=${agent.id}`);
    expect(agent.patternId).toBe(pattern.id);
    expect(agent.answers.useCaseName).toBe(pattern.title);
    // The single-choice questions show the example's answer, and every question is marked as an assumption.
    for (const id of ['accessModel', 'buildPlatform', 'dataSensitivity', 'autonomy'] as const) {
      const ask = content.passport.questions.find((candidate) => candidate.id === id)!.ask;
      expect(screen.getByRole('combobox', { name: ask })).toHaveValue(
        pattern.answers[id] as string,
      );
    }
    expect(screen.getAllByText(content.passport.assumed.badge)).toHaveLength(
      content.passport.questions.length,
    );
    expect(
      screen.getByText(renderTemplate(content.passport.assumed.note, { example: pattern.title })),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: content.passport.result.heading }),
    ).toBeInTheDocument();
  });

  it('starts from a sample with its title, and asks which customer once one is saved', async () => {
    const user = userEvent.setup();
    const { organization } = seedAssessment({ accessModel: 'delegated' });
    const sample = content.samples[0]!;
    await open(`/patterns/${sample.patternId}?sample=${sample.id}`, sample.title);
    const select = screen.getByLabelText(copy.customerLabel);
    // The real customer saved most recently is the default.
    expect(select).toHaveValue(organization.id);
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Fictional customer', copy.newCustomer]);
    await user.click(screen.getByRole('button', { name: copy.button }));
    await screen.findByRole('heading', { level: 1, name: site.routes.map.title });
    const data = saved();
    expect(data.organizations).toHaveLength(1);
    expect(data.assessments).toHaveLength(2);
    expect(data.assessments[1]!.organizationId).toBe(organization.id);
    expect(data.assessments[1]!.sampleId).toBe(sample.id);
    expect(data.assessments[1]!.answers.useCaseName).toBe(sample.title);
  });

  it('starts a new customer when asked', async () => {
    const user = userEvent.setup();
    seedAssessment();
    await open();
    await user.selectOptions(screen.getByLabelText(copy.customerLabel), copy.newCustomer);
    await user.click(screen.getByRole('button', { name: copy.button }));
    await screen.findByRole('heading', { level: 1, name: site.routes.map.title });
    expect(saved().organizations).toHaveLength(2);
  });

  it('does not put the agent in the sample customer unless asked to', async () => {
    const user = userEvent.setup();
    addSampleCustomer();
    await open();
    const select = screen.getByLabelText(copy.customerLabel);
    expect(select).toHaveValue('new');
    expect(
      within(select).getByRole('option', {
        name: `${site.ui.sample.customerName} (${site.ui.sample.chip})`,
      }),
    ).toBeInTheDocument();
    const before = saved().organizations.length;
    await user.click(screen.getByRole('button', { name: copy.button }));
    await screen.findByRole('heading', { level: 1, name: site.routes.map.title });
    expect(saved().organizations).toHaveLength(before + 1);
  });

  it('says so, and stays on the example, when it cannot be saved', async () => {
    const user = userEvent.setup();
    await open();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    await user.click(screen.getByRole('button', { name: copy.button }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.error);
    expect(screen.getByRole('heading', { level: 1, name: pattern.title })).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
