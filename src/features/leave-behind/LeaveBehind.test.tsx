import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '../../lib/content/index.ts';
import * as files from '../../lib/readout/files.ts';
import { loadDiagnostics, saveDiagnostics } from '../../lib/state/diagnostic-storage.ts';
import { renderRoute, seedAssessment } from '../../test-support/playbook.tsx';
import './LeaveBehindPage.tsx';

const { site, leaveBehind: copy } = content;
const open = (path: string) => renderRoute(path, site.routes.leaveBehind.title);
const six = {
  accessModel: 'own-teammate',
  buildPlatform: 'microsoft-foundry',
  dataSensitivity: 'confidential',
  tools: ['microsoft-mcp'],
  autonomy: 'approval-gated',
  audience: ['employees'],
  stage: 'pilot',
};
const section = (heading: string) =>
  within(screen.getByRole('heading', { level: 3, name: heading }).closest('section')!);

afterEach(() => vi.restoreAllMocks());

describe('leave-behind page', () => {
  it('shows the agent, how it acts and where it is built, with every part of the summary', async () => {
    const { assessment } = seedAssessment(six, { cloudEnvironment: 'commercial' });
    await open(`/leave-behind/${assessment.id}`);
    const article = within(screen.getByRole('article'));
    expect(
      article.getByRole('heading', { level: 2, name: 'Fictional agent for Fictional customer' }),
    ).toBeInTheDocument();
    expect(
      article.getByText(content.accessPatterns.answerLabels['own-teammate']!),
    ).toBeInTheDocument();
    expect(article.getByText('Microsoft Foundry', { exact: false })).toBeInTheDocument();
    for (const heading of [
      copy.page.whyHeading,
      copy.page.controlsHeading,
      copy.page.licensingHeading,
      copy.page.stepsHeading,
      copy.page.confirmHeading,
    ])
      expect(article.getByRole('heading', { level: 3, name: heading })).toBeInTheDocument();
    expect(article.getByText(site.disclaimer)).toBeInTheDocument();
  });

  it('says why it matters with the statements named in the content', async () => {
    const { assessment } = seedAssessment(six);
    await open(`/leave-behind/${assessment.id}`);
    const why = section(copy.page.whyHeading);
    for (const id of copy.whyStatementIds) {
      const statement = content.value.problem.statements.find((s) => s.id === id)!;
      expect(why.getByText(statement.text)).toBeInTheDocument();
    }
  });

  it('lists who to license for how the agent acts, with the licensing note', async () => {
    const { assessment } = seedAssessment(six);
    await open(`/leave-behind/${assessment.id}`);
    const license = section(copy.page.licensingHeading);
    expect(
      license.getByText('The owner, sponsor or manager of an agent with its own access', {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(license.getByText(copy.page.licensingNote)).toBeInTheDocument();
  });

  it('keeps every unknown under Questions to confirm, and out of the other parts', async () => {
    const { assessment } = seedAssessment({ ...six, autonomy: null });
    await open(`/leave-behind/${assessment.id}`);
    const question = content.questions.find((q) => q.id === 'autonomy')!.ifUnknown;
    expect(section(copy.page.confirmHeading).getByText(question)).toBeInTheDocument();
    for (const heading of [copy.page.whyHeading, copy.page.controlsHeading, copy.page.stepsHeading])
      expect(section(heading).queryByText(question)).not.toBeInTheDocument();
  });

  it('marks a stage the seller has not confirmed as assumed', async () => {
    const { assessment } = seedAssessment({ ...six });
    const state = loadDiagnostics();
    state.data.assessments[0]!.assumedQuestionIds = ['stage'];
    saveDiagnostics(state, state.data);
    await open(`/leave-behind/${assessment.id}`);
    expect(screen.getByText(`(${copy.page.stageAssumed})`, { exact: false })).toBeInTheDocument();
  });

  it('keeps the toolbar out of the printout and prints the page', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { assessment } = seedAssessment(six);
    await open(`/leave-behind/${assessment.id}`);
    const toolbar = screen.getByRole('group', { name: copy.toolbar.heading });
    expect(toolbar.closest('[data-no-print]')).not.toBeNull();
    expect(screen.getByRole('article')).toHaveAttribute('data-print-document');
    await userEvent.click(within(toolbar).getByRole('button', { name: copy.toolbar.print }));
    expect(print).toHaveBeenCalledOnce();
  });

  it('downloads the three slides as a PowerPoint file', async () => {
    const download = vi.spyOn(files, 'downloadBlob').mockImplementation(() => undefined);
    const { assessment } = seedAssessment(six);
    await open(`/leave-behind/${assessment.id}`);
    await userEvent.click(screen.getByRole('button', { name: copy.toolbar.powerpoint }));
    await waitFor(() => expect(download).toHaveBeenCalledOnce(), { timeout: 20000 });
    expect(download.mock.calls[0]![0]).toBe(`${copy.deck.fileName}.pptx`);
    expect(download.mock.calls[0]![1]).toBeInstanceOf(Blob);
  }, 30000);

  it('links back to the passport for the same agent', async () => {
    const { assessment } = seedAssessment(six);
    await open(`/leave-behind/${assessment.id}`);
    expect(screen.getByRole('link', { name: copy.toolbar.back })).toHaveAttribute(
      'href',
      `/map?assessment=${assessment.id}`,
    );
  });

  it('says when the agent is not saved here', async () => {
    await open(`/leave-behind/${crypto.randomUUID()}`);
    expect(screen.getByRole('alert')).toHaveTextContent(copy.missing);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('does not build a summary from answers it cannot read', async () => {
    const { assessment } = seedAssessment({ accessModel: 'not-a-real-answer' });
    await open(`/leave-behind/${assessment.id}`);
    expect(screen.getByRole('alert')).toHaveTextContent(copy.incompatible);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});
