import { FluentProvider } from '@fluentui/react-components';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes.tsx';
import { content, contentMeta, pillarName } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { evaluateAssessment } from '../../lib/engine/evaluate.ts';
import { evaluateGuardrails } from '../../lib/engine/guardrails.ts';
import { pillarRows, questionPillars } from '../../lib/engine/pillars.ts';
import { StateProviders } from '../../lib/state/StateProviders.tsx';
import { emptyWorkspace } from '../../lib/state/diagnostic-model.ts';
import {
  DIAGNOSTIC_STORAGE_KEY,
  loadDiagnostics,
  saveDiagnostics,
} from '../../lib/state/diagnostic-storage.ts';
import { writeStored } from '../../lib/state/storage.ts';
import { fluentTheme } from '../../theme/fluentTheme.ts';
import './DiagnosticHome.tsx';
import './DiagnosticLayout.tsx';
import './DiagnosticWizard.tsx';
import { diagnosticSections } from './questions.ts';

// Fluent's focus trapping needs real layout; browser tests cover the actual dialog.
vi.mock('./ConfirmDialog.tsx', async () => {
  const { content } = await import('../../lib/content/index.ts');
  return {
    ConfirmDialog: ({
      open,
      title,
      body,
      confirmLabel,
      onConfirm,
      onCancel,
    }: Parameters<(typeof import('./ConfirmDialog.tsx'))['ConfirmDialog']>[0]) =>
      open ? (
        <div role="alertdialog" aria-label={title}>
          <p>{body}</p>
          <button type="button" onClick={onCancel}>
            {content.site.diagnostic.cancel}
          </button>
          <button type="button" onClick={onConfirm}>
            {confirmLabel ?? content.site.diagnostic.confirm}
          </button>
        </div>
      ) : null,
  };
});

const copy = content.site.diagnostic;
const questionLabel = (id: string) => content.questions.find((q) => q.id === id)!.label;
const questionCount = (mode: 'quick' | 'full') =>
  diagnosticSections(content, mode, {}).reduce((sum, section) => sum + section.questions.length, 0);
async function dialogAction(name: string) {
  const dialog = await screen.findByRole('alertdialog');
  return within(dialog).getByRole('button', { name });
}
function renderPage(path = '/diagnostic') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <FluentProvider theme={fluentTheme}>
      <StateProviders>
        <RouterProvider router={router} />
      </StateProviders>
    </FluentProvider>,
  );
  return { ...view, router };
}
function seed() {
  const data = emptyWorkspace();
  const now = new Date().toISOString();
  const metadata = { createdAt: now, updatedAt: now, contentVersion: contentMeta.contentVersion };
  const organizationId = crypto.randomUUID();
  const id = crypto.randomUUID();
  data.organizations.push({
    ...metadata,
    id: organizationId,
    answers: { orgName: 'Fictional organization', cloudEnvironment: 'gcc' },
  });
  data.assessments.push({
    ...metadata,
    id,
    organizationId,
    answers: { useCaseName: 'Fictional use case' },
    mode: 'quick',
    sectionId: 'profile',
    patternId: null,
    sampleId: null,
  });
  return data;
}
afterEach(() => vi.restoreAllMocks());

describe('local diagnostic', () => {
  it('starts from the customer name, seeds a scenario and does not leak neutral organization answers', async () => {
    const user = userEvent.setup();
    const { router } = renderPage('/diagnostic?pattern=ai-teammate');
    await screen.findByRole('heading', { level: 1, name: content.site.routes.diagnostic.title });
    expect(screen.getByRole('button', { name: copy.start })).toBeDisabled();
    await user.type(
      screen.getByRole('textbox', { name: copy.newOrganization }),
      'Fictional organization',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: questionLabel('cloudEnvironment') }),
      'gcc',
    );
    await user.click(screen.getByRole('button', { name: copy.start }));
    await screen.findByRole('heading', { level: 1, name: 'AI teammate' });
    const saved = loadDiagnostics().data;
    expect(saved.organizations[0]!.answers).toEqual({
      orgName: 'Fictional organization',
      cloudEnvironment: 'gcc',
    });
    expect(saved.assessments[0]!.answers.accessModel).toBe('own-teammate');
    expect(saved.assessments[0]!.organizationId).toBe(saved.organizations[0]!.id);
    expect(saved.assessments[0]!.sectionId).toBe('profile');
    expect(router.state.location.pathname).toBe(`/diagnostic/${saved.assessments[0]!.id}`);
    expect(router.state.location.search).toBe('');
    const rail = screen.getByRole('navigation', { name: copy.sectionRail });
    await user.click(within(rail).getByRole('button', { name: copy.review }));
    const expected = evaluateAssessment(
      content,
      { org: saved.organizations[0]!.answers, useCase: saved.assessments[0]!.answers },
      contentMeta.contentVersion,
    );
    expect(expected.inScope.length).toBeGreaterThan(0);
    expect(screen.getByText(copy.reviewNote)).toBeInTheDocument();
    const rows = pillarRows(content, expected.inScope);
    for (const row of rows) {
      const card = screen
        .getByRole('heading', { level: 3, name: pillarName(row.pillar) })
        .closest('li')!;
      expect(card).toHaveTextContent(
        renderTemplate(content.site.mapping.pillarCount, {
          count: row.items.length,
          total: row.catalogTotal,
        }),
      );
    }
    expect(rows.reduce((total, row) => total + row.items.length, 0)).toBe(expected.inScope.length);
    const reads = screen.getAllByRole('link', { name: content.site.readout.open });
    expect(reads.length).toBeGreaterThan(0);
    for (const link of reads)
      expect(link).toHaveAttribute('href', `/diagnostic/${saved.assessments[0]!.id}/readout`);
    expect(
      screen.queryByRole('table', { name: content.site.mapping.inScope }),
    ).not.toBeInTheDocument();
  });
  it('starts a quick scan for an existing customer at the use case without creating another customer', async () => {
    const user = userEvent.setup();
    const data = seed();
    saveDiagnostics(loadDiagnostics(), data);
    renderPage();
    const startSection = within(await screen.findByRole('region', { name: copy.startHeading }));
    expect(startSection.getByRole('combobox', { name: copy.selectOrganization })).toHaveValue(
      data.organizations[0]!.id,
    );
    expect(
      startSection.queryByRole('textbox', { name: copy.newOrganization }),
    ).not.toBeInTheDocument();
    await user.click(startSection.getByRole('button', { name: copy.start }));
    await screen.findByRole('textbox', { name: questionLabel('useCaseName') });
    const saved = loadDiagnostics().data;
    expect(saved.organizations).toHaveLength(1);
    expect(saved.assessments).toHaveLength(2);
    const started = saved.assessments.find((a) => a.id !== data.assessments[0]!.id)!;
    expect(started.organizationId).toBe(data.organizations[0]!.id);
    expect(started.sectionId).toBe('profile');
    expect(started.assumedQuestionIds).toBeUndefined();
  });
  it('shows what each mode asks before starting', async () => {
    const user = userEvent.setup();
    renderPage();
    const mode = await screen.findByRole('combobox', { name: copy.mode });
    const options = within(mode).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      renderTemplate(copy.modeOptions.quick, { count: questionCount('quick') }),
      renderTemplate(copy.modeOptions.full, { count: questionCount('full') }),
    ]);
    expect(questionCount('quick')).toBeLessThan(questionCount('full'));
    expect(screen.getByText(copy.quickNote)).toBeInTheDocument();
    await user.selectOptions(mode, 'full');
    expect(screen.getByText(copy.fullNote)).toBeInTheDocument();
  });
  it('marks scenario answers as assumed until the seller confirms or changes them', async () => {
    const user = userEvent.setup();
    renderPage('/diagnostic?pattern=ai-teammate');
    await user.type(
      await screen.findByRole('textbox', { name: copy.newOrganization }),
      'Fictional organization',
    );
    await user.click(screen.getByRole('button', { name: copy.start }));
    await screen.findByRole('heading', { level: 1, name: 'AI teammate' });
    const assumedIds = () => loadDiagnostics().data.assessments[0]!.assumedQuestionIds ?? [];
    const assumedInScan = () =>
      assumedIds().filter((id) => content.diagnostic.quickQuestionIds.includes(id)).length;
    const statusText = () =>
      screen.getByText(renderTemplate(copy.assumedStatus, { assumed: assumedInScan() }), {
        exact: false,
      });
    expect(assumedIds()).toEqual(expect.arrayContaining(['stage', 'buildPlatform', 'accessModel']));
    expect(assumedIds()).not.toContain('useCaseName');
    expect(assumedInScan()).toBeGreaterThan(2);
    expect(statusText()).toBeInTheDocument();
    expect(screen.getByText(copy.assumedBadge)).toBeInTheDocument();

    const confirm = `${copy.confirmAnswer} — ${questionLabel('stage')}`;
    await user.click(screen.getByRole('button', { name: confirm }));
    expect(assumedIds()).not.toContain('stage');
    expect(assumedIds()).toContain('buildPlatform');
    expect(screen.queryByRole('button', { name: confirm })).not.toBeInTheDocument();
    expect(loadDiagnostics().data.assessments[0]!.answers.stage).toBe('pilot');
    expect(statusText()).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('navigation', { name: copy.sectionRail })).getByRole('button', {
        name: 'Build and run',
      }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: questionLabel('buildPlatform') }),
      'copilot-studio',
    );
    expect(assumedIds()).not.toContain('buildPlatform');
    expect(assumedIds()).toContain('channels');
    expect(loadDiagnostics().data.assessments[0]!.answers.buildPlatform).toBe('copilot-studio');
    expect(statusText()).toBeInTheDocument();
  });
  it('asks each question in plain language and names the requirement areas it informs', async () => {
    const user = userEvent.setup();
    const data = seed();
    saveDiagnostics(loadDiagnostics(), data);
    renderPage(`/diagnostic/${data.assessments[0]!.id}`);
    await screen.findByRole('textbox', { name: questionLabel('useCaseName') });
    await user.click(
      within(screen.getByRole('navigation', { name: copy.sectionRail })).getByRole('button', {
        name: 'How the agent acts',
      }),
    );
    const field = within(screen.getByRole('group', { name: questionLabel('accessModel') }));
    expect(
      field.getByText(content.diagnostic.askPrompts.accessModel!, { exact: false }),
    ).toBeInTheDocument();
    const pillars = content.pillars
      .filter((p) => questionPillars(content).get('accessModel')?.has(p.id) === true)
      .sort((a, b) => a.order - b.order);
    expect(pillars.length).toBeGreaterThan(0);
    expect(
      field.getByText(
        renderTemplate(content.site.mapping.informs, {
          label: pillars.map((p) => p.requirement).join(', '),
        }),
      ),
    ).toBeInTheDocument();
  });
  it('links the access question to the page that explains the ways an agent can act', async () => {
    const user = userEvent.setup();
    const data = seed();
    saveDiagnostics(loadDiagnostics(), data);
    renderPage(`/diagnostic/${data.assessments[0]!.id}`);
    await screen.findByRole('textbox', { name: questionLabel('useCaseName') });
    expect(screen.queryByRole('link', { name: copy.accessHelp })).not.toBeInTheDocument();
    await user.click(
      within(screen.getByRole('navigation', { name: copy.sectionRail })).getByRole('button', {
        name: 'How the agent acts',
      }),
    );
    expect(screen.getByRole('link', { name: copy.accessHelp })).toHaveAttribute(
      'href',
      `/access?assessment=${data.assessments[0]!.id}`,
    );
  });
  it('shows the production guardrails and the next steps in the review, from the answers given', async () => {
    const user = userEvent.setup();
    const data = seed();
    data.assessments[0]!.answers = { ...data.assessments[0]!.answers, sponsor: 'yes' };
    data.organizations[0]!.answers.agent365Status = 'none';
    saveDiagnostics(loadDiagnostics(), data);
    const id = data.assessments[0]!.id;
    renderPage(`/diagnostic/${id}`);
    await screen.findByRole('textbox', { name: questionLabel('useCaseName') });
    await user.click(
      within(screen.getByRole('navigation', { name: copy.sectionRail })).getByRole('button', {
        name: copy.review,
      }),
    );
    const plan = evaluateGuardrails(content, {
      ...data.organizations[0]!.answers,
      ...data.assessments[0]!.answers,
    });
    expect(
      screen.getByRole('heading', { level: 3, name: content.guardrails.heading }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(renderTemplate(content.guardrails.summary, plan.counts)),
    ).toBeInTheDocument();
    for (const { gate, items } of plan.gates)
      if (items.length > 0)
        expect(screen.getByRole('heading', { level: 4, name: gate.title })).toBeInTheDocument();
    const status = (guardrailId: string) => {
      const item = content.guardrails.items.find((g) => g.id === guardrailId)!;
      return within(screen.getByText(item.title).closest('li')!);
    };
    expect(
      status('registered-owner').getByText(content.guardrails.statusLabels.ready),
    ).toBeInTheDocument();
    expect(
      status('licensed-people').getByText(content.guardrails.statusLabels.gap),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.licensingLink })).toHaveAttribute(
      'href',
      `/licensing?assessment=${id}`,
    );
    expect(screen.getByRole('link', { name: copy.accessLink })).toHaveAttribute(
      'href',
      `/access?assessment=${id}`,
    );
  });
  it('preserves full-only inputs across mode switches and resumes the saved section after remount', async () => {
    const user = userEvent.setup();
    const data = seed();
    saveDiagnostics(loadDiagnostics(), data);
    const view = renderPage(`/diagnostic/${data.assessments[0]!.id}`);
    await screen.findByRole('textbox', { name: questionLabel('useCaseName') });
    await user.selectOptions(screen.getByRole('combobox', { name: copy.mode }), 'full');
    await user.type(
      screen.getByRole('textbox', { name: questionLabel('businessOutcome') }),
      'Keep this outcome',
    );
    await user.click(
      within(screen.getByRole('navigation', { name: copy.sectionRail })).getByRole('button', {
        name: 'Build and run',
      }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: questionLabel('buildPlatform') }),
      'pro-code-microsoft',
    );
    expect(screen.getByRole('combobox', { name: questionLabel('codeStack') })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: copy.mode }), 'quick');
    expect(
      screen.queryByRole('combobox', { name: questionLabel('codeStack') }),
    ).not.toBeInTheDocument();
    expect(loadDiagnostics().data.assessments[0]!.answers.businessOutcome).toBe(
      'Keep this outcome',
    );
    view.unmount();
    renderPage(`/diagnostic/${data.assessments[0]!.id}`);
    const build = await screen.findByRole('combobox', { name: questionLabel('buildPlatform') });
    expect(build).toHaveValue('pro-code-microsoft');
    expect(screen.getByRole('combobox', { name: copy.mode })).toHaveValue('quick');
    expect(loadDiagnostics().data.assessments[0]!.sectionId).toBe('build');
  });
  it('duplicates, renames and confirms deletion without deleting a linked organization', async () => {
    const user = userEvent.setup();
    saveDiagnostics(loadDiagnostics(), seed());
    renderPage();
    await user.click(await screen.findByText(copy.manageCustomers));
    expect(screen.getByRole('button', { name: copy.deleteOrganization })).toBeDisabled();
    await user.click(screen.getByText(copy.more));
    await user.click(screen.getByRole('button', { name: copy.duplicate }));
    expect(loadDiagnostics().data.assessments).toHaveLength(2);
    const duplicateHeading = screen.getByRole('heading', {
      level: 3,
      name: 'Fictional use case — copy',
    });
    const card = within(duplicateHeading.closest('li')!);
    await user.click(card.getByText(copy.more));
    await user.click(card.getByRole('button', { name: copy.rename }));
    const name = screen.getByRole('textbox', { name: copy.assessmentName });
    await user.clear(name);
    await user.type(name, 'Renamed assessment');
    await user.click(screen.getByRole('button', { name: copy.save }));
    expect(
      loadDiagnostics().data.assessments.some(
        (a) => a.answers.useCaseName === 'Renamed assessment',
      ),
    ).toBe(true);
    await user.click(card.getByText(copy.more));
    await user.click(card.getByRole('button', { name: copy.delete }));
    await user.click(await dialogAction(copy.cancel));
    expect(loadDiagnostics().data.assessments).toHaveLength(2);
    await user.click(card.getByRole('button', { name: copy.delete }));
    await user.click(await dialogAction(copy.confirm));
    expect(loadDiagnostics().data.assessments).toHaveLength(1);
    expect(loadDiagnostics().data.organizations).toHaveLength(1);
  });
  it('requires explicit incompatible-answer recovery and preserves valid saved answers', async () => {
    const user = userEvent.setup();
    const data = seed();
    data.assessments[0]!.answers.tools = ['retired-tool'];
    data.assessments[0]!.contentVersion = 'old-version';
    saveDiagnostics(loadDiagnostics(), data);
    renderPage(`/diagnostic/${data.assessments[0]!.id}`);
    await screen.findByText(copy.incompatible);
    expect(screen.getByText(copy.oldContent)).toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: content.site.mapping.inScope }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.clearIncompatible }));
    expect(screen.queryByText(copy.incompatible)).not.toBeInTheDocument();
    expect(loadDiagnostics().data.assessments[0]!.answers).toEqual({
      useCaseName: 'Fictional use case',
    });
  });
  it('keeps corrupt recovery data blocked after a failed reset', async () => {
    const user = userEvent.setup();
    writeStored(DIAGNOSTIC_STORAGE_KEY, '{corrupt');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    renderPage();
    await screen.findByText(copy.storageInvalid);
    expect(screen.queryByRole('button', { name: copy.start })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.reset }));
    await user.click(await dialogAction(copy.confirm));
    expect(screen.getByText(copy.storageInvalid)).toBeInTheDocument();
    expect(screen.getByText(copy.storageUnavailable)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.retry })).not.toBeInTheDocument();
    expect(loadDiagnostics().recoveryRaw).toBe('{corrupt');
  });
  it('warns on failed saves, allows retry and blocks navigation until explicitly confirmed', async () => {
    const user = userEvent.setup();
    saveDiagnostics(loadDiagnostics(), seed());
    const fail = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { router } = renderPage();
    await user.click(await screen.findByText(copy.manageCustomers));
    await screen.findByRole('textbox', { name: questionLabel('orgName') });
    await user.type(screen.getByRole('textbox', { name: questionLabel('orgName') }), ' draft');
    expect(screen.getByRole('alert')).toHaveTextContent(copy.storageQuota);
    await user.click(screen.getByRole('link', { name: content.site.routes.learn.title }));
    await screen.findByRole('alertdialog');
    expect(router.state.location.pathname).toBe('/diagnostic');
    await user.click(await dialogAction(copy.cancel));
    fail.mockRestore();
    await user.click(screen.getByRole('button', { name: copy.retry }));
    expect(screen.queryByText(copy.storageQuota)).not.toBeInTheDocument();
    expect(loadDiagnostics().data.organizations[0]!.answers.orgName).toBe(
      'Fictional organization draft',
    );
  });
  it('reports invalid starter links without creating data and missing assessments explicitly', async () => {
    const view = renderPage('/diagnostic?pattern=missing&sample=missing');
    await screen.findByText(copy.invalidStarter);
    expect(loadDiagnostics().data.assessments).toHaveLength(0);
    view.unmount();
    renderPage('/diagnostic/not-a-local-id');
    await screen.findByText(copy.notFound);
  });
});
