import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { content } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { loadDiagnostics, saveDiagnostics } from '../../lib/state/diagnostic-storage.ts';
import { optionLabel, renderRoute, seedAssessment } from '../../test-support/playbook.tsx';
import './PassportPage.tsx';

const { site, passport: copy } = content;
const open = (path = '/map') => renderRoute(path, site.routes.map.title);
const saved = () => loadDiagnostics().data;
const question = (id: string) => copy.questions.find((q) => q.id === id)!;
const resultRegion = () => screen.getByRole('region', { name: copy.result.heading });

describe('agent passport', () => {
  it('asks the six questions in the seller words, in order', async () => {
    await open();
    expect(copy.questions.map((q) => q.id)).toEqual([
      'accessModel',
      'buildPlatform',
      'dataSensitivity',
      'tools',
      'autonomy',
      'audience',
    ]);
    for (const q of copy.questions) {
      expect(screen.getByText(q.ask, { exact: false })).toBeInTheDocument();
      expect(screen.getByText(q.hint)).toBeInTheDocument();
    }
    expect(screen.queryByRole('region', { name: copy.result.heading })).not.toBeInTheDocument();
  });

  it('saves the customer and the agent on the first answer, and assumes a pilot', async () => {
    const user = userEvent.setup();
    const router = await open();
    await user.type(screen.getByLabelText(copy.setup.customerNameLabel), 'Fictional Customer');
    expect(saved().assessments).toHaveLength(0);
    await user.selectOptions(
      screen.getByRole('combobox', { name: question('accessModel').ask }),
      'delegated',
    );
    const workspace = saved();
    expect(workspace.organizations).toHaveLength(1);
    expect(workspace.organizations[0]!.answers).toMatchObject({
      orgName: 'Fictional Customer',
      cloudEnvironment: 'commercial',
    });
    expect(workspace.assessments).toHaveLength(1);
    expect(workspace.assessments[0]).toMatchObject({
      answers: { accessModel: 'delegated', stage: 'pilot' },
      assumedQuestionIds: ['stage'],
      mode: 'quick',
    });
    expect(router.state.location.search).toBe(`?assessment=${workspace.assessments[0]!.id}`);
    expect(router.state.location.search).not.toContain('Fictional');
  });

  it('shows the passport once an agent is saved, and updates it as answers change', async () => {
    const user = userEvent.setup();
    await open();
    await user.selectOptions(
      screen.getByRole('combobox', { name: question('accessModel').ask }),
      'delegated',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: question('buildPlatform').ask }),
      'copilot-studio',
    );
    const region = within(resultRegion());
    expect(region.getByText(content.accessPatterns.answerLabels.delegated)).toBeInTheDocument();
    expect(
      region.getByRole('heading', { level: 3, name: copy.result.controlsHeading }),
    ).toBeInTheDocument();
    const platform = content.fit.platforms.items.find((item) =>
      item.buildPlatforms.includes('copilot-studio'),
    )!;
    expect(region.getByText(platform.label)).toBeInTheDocument();
    expect(region.getByText('Users who delegate their access to the agent')).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: question('accessModel').ask }),
      'own-background',
    );
    const after = within(resultRegion());
    expect(
      after.queryByText('Users who delegate their access to the agent'),
    ).not.toBeInTheDocument();
    expect(
      after.getByText('The owner, sponsor or manager of an agent with its own access'),
    ).toBeInTheDocument();
  });

  it('lets the seller say the agent is going to production, and stops calling the pilot an assumption', async () => {
    const user = userEvent.setup();
    await open();
    await user.selectOptions(
      screen.getByRole('combobox', { name: question('autonomy').ask }),
      'autonomous',
    );
    expect(screen.getByText(copy.setup.stageAssumed, { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: copy.setup.stageLabel }));
    const agent = saved().assessments[0]!;
    expect(agent.answers.stage).toBe('production');
    expect(agent.assumedQuestionIds).toBeUndefined();
    expect(screen.queryByText(copy.setup.stageAssumed, { exact: false })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: copy.setup.stageLabel }));
    expect(saved().assessments[0]!.answers.stage).toBe('pilot');
  });

  it('suggests how the agent acts from three questions, and uses it only when asked', async () => {
    const user = userEvent.setup();
    await open();
    const helper = copy.helper;
    await user.click(screen.getByText(helper.heading));
    const ask = (text: string, answer: string) =>
      user.click(within(screen.getByRole('group', { name: text })).getByLabelText(answer));
    await ask(helper.questions.actsForPerson, helper.yes);
    await ask(helper.questions.runsAlone, helper.no);
    expect(screen.queryByRole('button', { name: /Use this answer/ })).not.toBeInTheDocument();
    await ask(helper.questions.ownAccount, helper.no);
    expect(screen.getByText(helper.outcomes.delegated)).toBeInTheDocument();
    expect(saved().assessments).toHaveLength(0);
    await ask(helper.questions.runsAlone, helper.yes);
    expect(screen.getByText(helper.outcomes.mixed)).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: helper.use.replace('{label}', optionLabel('accessModel', 'mixed')),
      }),
    );
    expect(saved().assessments[0]!.answers.accessModel).toBe('mixed');
    expect(screen.getByRole('combobox', { name: question('accessModel').ask })).toHaveValue(
      'mixed',
    );
  });

  it('says so when none of the three questions apply, and offers nothing to use', async () => {
    const user = userEvent.setup();
    await open();
    const helper = copy.helper;
    await user.click(screen.getByText(helper.heading));
    for (const text of Object.values(helper.questions))
      await user.click(within(screen.getByRole('group', { name: text })).getByLabelText(helper.no));
    expect(screen.getByText(helper.outcomes.unclear)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Use this answer/ })).not.toBeInTheDocument();
  });

  it('lets none of the tools exclude the others', async () => {
    const user = userEvent.setup();
    await open();
    const tools = screen.getByRole('group', { name: new RegExp(question('tools').ask) });
    await user.click(within(tools).getByLabelText(optionLabel('tools', 'code-execution')));
    await user.click(within(tools).getByLabelText(optionLabel('tools', 'web-browsing')));
    expect(saved().assessments[0]!.answers.tools).toEqual(['code-execution', 'web-browsing']);
    await user.click(within(tools).getByLabelText(optionLabel('tools', 'none')));
    expect(saved().assessments[0]!.answers.tools).toEqual(['none']);
    await user.click(within(tools).getByLabelText(optionLabel('tools', 'microsoft-mcp')));
    expect(saved().assessments[0]!.answers.tools).toEqual(['microsoft-mcp']);
  });

  it('treats what is not answered as to confirm, never as a gap', async () => {
    const user = userEvent.setup();
    await open();
    await user.selectOptions(
      screen.getByRole('combobox', { name: question('accessModel').ask }),
      'delegated',
    );
    const region = within(resultRegion());
    expect(
      region.queryByText(content.licensing.requirementsPanel.status.gap, { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      region.getAllByText(content.licensing.requirementsPanel.status.unknown).length,
    ).toBeGreaterThan(0);
    expect(
      region.getAllByText(content.licensing.requirementsPanel.askLabel + ':', { exact: false })
        .length,
    ).toBeGreaterThan(0);
  });

  it('starts the result with the next steps for that agent, in the order a seller takes them', async () => {
    const user = userEvent.setup();
    await open();
    await user.selectOptions(
      screen.getByRole('combobox', { name: question('accessModel').ask }),
      'own-teammate',
    );
    const id = saved().assessments[0]!.id;
    const region = within(resultRegion());
    // The steps come before the details, so the way on is in view as soon as the result is.
    const steps = region.getByRole('heading', { level: 3, name: copy.result.actionsHeading });
    const first = region.getByRole('heading', { level: 3, name: copy.result.accessHeading });
    expect(steps.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const list = within(steps.parentElement!.querySelector('ul')!);
    expect(list.getAllByRole('link').map((link) => link.textContent)).toEqual([
      copy.result.actions.licensing,
      copy.result.actions.deploy,
      copy.result.actions.leaveBehind,
      copy.result.actions.readout,
    ]);
    for (const key of ['licensing', 'deploy', 'leaveBehind', 'readout'] as const)
      expect(list.getByText(copy.result.actionNotes[key])).toBeInTheDocument();
    expect(region.getByRole('link', { name: copy.result.actions.leaveBehind })).toHaveAttribute(
      'href',
      `/leave-behind/${id}`,
    );
    expect(region.getByRole('link', { name: copy.result.actions.licensing })).toHaveAttribute(
      'href',
      `/licensing?assessment=${id}`,
    );
    expect(region.getByRole('link', { name: copy.result.actions.deploy })).toHaveAttribute(
      'href',
      `/deploy?assessment=${id}`,
    );
    expect(region.getByRole('link', { name: copy.result.actions.readout })).toHaveAttribute(
      'href',
      `/diagnostic/${id}/readout`,
    );
    // The rest is one line of links.
    expect(region.getByRole('link', { name: copy.result.actions.canvas })).toHaveAttribute(
      'href',
      `/canvas/${id}`,
    );
    expect(region.getByRole('link', { name: copy.result.actions.discovery })).toHaveAttribute(
      'href',
      `/diagnostic/${id}`,
    );
  });

  it("offers comparing the customer's agents only once there is more than one", async () => {
    const { organization, assessment } = seedAssessment({ accessModel: 'delegated' });
    await open(`/map?assessment=${assessment.id}`);
    expect(
      within(resultRegion()).queryByRole('link', { name: copy.result.actions.portfolio }),
    ).not.toBeInTheDocument();

    const data = saved();
    data.assessments.push({
      ...structuredClone(assessment),
      id: crypto.randomUUID(),
      answers: { ...assessment.answers, useCaseName: 'Second fictional agent' },
    });
    saveDiagnostics(loadDiagnostics(), data);
    cleanup();
    await open(`/map?assessment=${assessment.id}`);
    expect(
      within(resultRegion()).getByRole('link', { name: copy.result.actions.portfolio }),
    ).toHaveAttribute('href', `/portfolio?customer=${organization.id}`);
  });

  it('marks answers that came from an example, and confirms them one at a time', async () => {
    const user = userEvent.setup();
    const { assessment } = seedAssessment({
      accessModel: 'delegated',
      buildPlatform: 'copilot-studio',
      stage: 'production',
    });
    const data = saved();
    const agent = data.assessments[0]!;
    agent.patternId = 'knowledge-agent';
    agent.assumedQuestionIds = ['accessModel', 'buildPlatform', 'stage'];
    saveDiagnostics(loadDiagnostics(), data);
    await open(`/map?assessment=${assessment.id}`);

    const note = renderTemplate(copy.assumed.note, {
      example: content.patterns.find((p) => p.id === 'knowledge-agent')!.title,
    });
    expect(screen.getByText(note)).toBeInTheDocument();
    expect(screen.getAllByText(copy.assumed.badge)).toHaveLength(2);
    expect(screen.getByText(copy.setup.stageAssumed, { exact: false })).toBeInTheDocument();

    const confirm = (ask: string) =>
      user.click(screen.getByRole('button', { name: `${copy.assumed.confirm} — ${ask}` }));
    await confirm(question('accessModel').ask);
    expect(saved().assessments[0]!.assumedQuestionIds).toEqual(['buildPlatform', 'stage']);
    expect(saved().assessments[0]!.answers.accessModel).toBe('delegated');
    expect(screen.getAllByText(copy.assumed.badge)).toHaveLength(1);

    await confirm(question('buildPlatform').ask);
    // The stage is still assumed, but the six questions are all confirmed, so the note goes.
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    await confirm(copy.setup.stageLabel);
    expect(saved().assessments[0]!.assumedQuestionIds).toBeUndefined();
    expect(screen.queryByText(copy.setup.stageAssumed, { exact: false })).not.toBeInTheDocument();
  });

  it('changing an answer confirms it too', async () => {
    const user = userEvent.setup();
    const { assessment } = seedAssessment({ accessModel: 'delegated' });
    const data = saved();
    data.assessments[0]!.assumedQuestionIds = ['accessModel'];
    saveDiagnostics(loadDiagnostics(), data);
    await open(`/map?assessment=${assessment.id}`);
    await user.selectOptions(
      screen.getByRole('combobox', { name: question('accessModel').ask }),
      'own-teammate',
    );
    expect(saved().assessments[0]!.assumedQuestionIds).toBeUndefined();
    expect(screen.queryByText(copy.assumed.badge)).not.toBeInTheDocument();
  });

  it('opens a saved agent, and adds another agent to the same customer', async () => {
    const user = userEvent.setup();
    const { assessment } = seedAssessment({ accessModel: 'delegated', stage: 'production' });
    await open(`/map?assessment=${assessment.id}`);
    expect(screen.getByLabelText(copy.setup.agentLabel)).toHaveValue('Fictional agent');
    expect(screen.getByLabelText(copy.setup.customerNameLabel)).toHaveValue('Fictional customer');
    expect(screen.getByRole('checkbox', { name: copy.setup.stageLabel })).toBeChecked();
    expect(resultRegion()).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(copy.setup.openLabel), '');
    expect(screen.queryByRole('region', { name: copy.result.heading })).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText(copy.setup.customerLabel),
      saved().organizations[0]!.id,
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: question('accessModel').ask }),
      'own-background',
    );
    const workspace = saved();
    expect(workspace.organizations).toHaveLength(1);
    expect(workspace.assessments).toHaveLength(2);
  });

  it('says when the agent in the address is not saved here', async () => {
    await open(`/map?assessment=${crypto.randomUUID()}`);
    expect(screen.getByRole('alert')).toHaveTextContent(copy.setup.missing);
  });

  it('keeps saved answers it cannot read out of the passport, and points to full discovery', async () => {
    const { assessment } = seedAssessment({ accessModel: 'not-a-real-answer' });
    await open(`/map?assessment=${assessment.id}`);
    expect(screen.getByRole('alert')).toHaveTextContent(copy.setup.incompatible);
    expect(screen.queryByRole('region', { name: copy.result.heading })).not.toBeInTheDocument();
  });

  it('keeps the customer name out of the address', async () => {
    const user = userEvent.setup();
    const router = await open();
    await user.type(screen.getByLabelText(copy.setup.customerNameLabel), 'Fictional Customer');
    await user.type(screen.getByLabelText(copy.setup.agentLabel), 'Fictional Agent');
    expect(router.state.location.search).not.toContain('Fictional');
  });

  it('does not start a second agent when answers arrive faster than the page can update', async () => {
    await open();
    const access = screen.getByRole('combobox', { name: question('accessModel').ask });
    const platform = screen.getByRole('combobox', { name: question('buildPlatform').ask });
    act(() => {
      fireEvent.change(access, { target: { value: 'delegated' } });
      fireEvent.change(platform, { target: { value: 'copilot-studio' } });
    });
    const workspace = saved();
    expect(workspace.organizations).toHaveLength(1);
    expect(workspace.assessments).toHaveLength(1);
    expect(workspace.assessments[0]!.answers).toMatchObject({
      accessModel: 'delegated',
      buildPlatform: 'copilot-studio',
    });
  });
});
