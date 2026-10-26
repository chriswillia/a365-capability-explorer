import { FluentProvider } from '@fluentui/react-components';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes.tsx';
import { content, contentMeta } from '../../lib/content/index.ts';
import { evaluateAssessment } from '../../lib/engine/evaluate.ts';
import { DepthProvider } from '../../lib/state/DepthProvider.tsx';
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
async function dialogAction(name: string) {
  const dialog = await screen.findByRole('alertdialog');
  return within(dialog).getByRole('button', { name });
}
function renderPage(path = '/diagnostic') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <FluentProvider theme={fluentTheme}>
      <DepthProvider>
        <RouterProvider router={router} />
      </DepthProvider>
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
  it('creates a profile first and seeds a pattern without leaking neutral organization answers', async () => {
    const user = userEvent.setup();
    const { router } = renderPage('/diagnostic?pattern=ai-teammate');
    await screen.findByRole('heading', { level: 1, name: content.site.routes.diagnostic.title });
    expect(screen.getByRole('button', { name: copy.start })).toBeDisabled();
    await user.type(
      screen.getByRole('textbox', { name: copy.newOrganization }),
      'Fictional organization',
    );
    await user.click(screen.getByRole('button', { name: copy.createOrganization }));
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
    expect(router.state.location.pathname).toBe(`/diagnostic/${saved.assessments[0]!.id}`);
    expect(router.state.location.search).toBe('');
    const rail = screen.getByRole('navigation', { name: copy.sectionRail });
    await user.click(within(rail).getByRole('button', { name: copy.review }));
    const expected = evaluateAssessment(
      content,
      { org: saved.organizations[0]!.answers, useCase: saved.assessments[0]!.answers },
      contentMeta.contentVersion,
    );
    expect(
      within(screen.getByRole('table', { name: content.site.mapping.inScope })).getAllByRole('row'),
    ).toHaveLength(expected.inScope.length + 1);
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
    await screen.findByRole('button', { name: copy.duplicate });
    expect(screen.getByRole('button', { name: copy.deleteOrganization })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: copy.duplicate }));
    expect(loadDiagnostics().data.assessments).toHaveLength(2);
    const duplicateHeading = screen.getByRole('heading', {
      level: 3,
      name: 'Fictional use case — copy',
    });
    const card = within(duplicateHeading.closest('li')!);
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
    expect(screen.queryByRole('button', { name: copy.createOrganization })).not.toBeInTheDocument();
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
