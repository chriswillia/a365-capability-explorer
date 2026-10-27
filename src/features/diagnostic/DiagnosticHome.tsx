import { useState } from 'react';
import { useRestoreFocusTarget } from '@fluentui/react-components';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content, contentMeta } from '../../lib/content/index.ts';
import type { Answers } from '../../lib/content/schemas.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { knownAnswer } from '../../lib/engine/answers.ts';
import { seededAssumptions } from '../../lib/state/assumptions.ts';
import { useDiagnostics } from '../../lib/state/diagnostics.ts';
import {
  displayName,
  type Assessment,
  type DiagnosticMode,
} from '../../lib/state/diagnostic-model.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { QuestionInput } from './QuestionInput.tsx';
import { DiagnosticTransfer } from './DiagnosticTransfer.tsx';
import { diagnosticSections } from './questions.ts';
import styles from './Diagnostic.module.css';

const NEW_CUSTOMER = 'new';
const questionCount = (mode: DiagnosticMode) =>
  diagnosticSections(content, mode, {}).reduce((sum, section) => sum + section.questions.length, 0);

export function Component() {
  usePageTitle('diagnostic');
  const store = useDiagnostics();
  const copy = content.site.diagnostic;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const patternId = params.get('pattern');
  const sampleId = params.get('sample');
  const requestedPattern = content.patterns.find((p) => p.id === patternId);
  const requestedSample = content.samples.find(
    (s) => s.id === sampleId && s.patternId === patternId,
  );
  const invalidStarter =
    (patternId !== null && !requestedPattern) ||
    (sampleId !== null && !requestedSample) ||
    params.getAll('pattern').length > 1 ||
    params.getAll('sample').length > 1;
  const [starter, setStarter] = useState(() =>
    invalidStarter
      ? ''
      : requestedSample
        ? `sample:${requestedSample.id}`
        : requestedPattern
          ? `pattern:${requestedPattern.id}`
          : '',
  );
  const [mode, setMode] = useState<DiagnosticMode>('quick');
  const [choice, setChoice] = useState('');
  const [newName, setNewName] = useState('');
  const [newCloud, setNewCloud] = useState<Answers[string]>(null);
  const [manageId, setManageId] = useState('');
  const [deleting, setDeleting] = useState<{
    kind: 'assessment' | 'organization';
    id: string;
    label: string;
  } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const restoreFocusTarget = useRestoreFocusTarget();
  const customers = [...store.data.organizations].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const orgName = (id: string) =>
    displayName(
      store.data.organizations.find((o) => o.id === id)!.answers,
      'orgName',
      copy.untitledOrganization,
    );
  const assessmentName = (a: Assessment) =>
    displayName(a.answers, 'useCaseName', copy.untitledAssessment);
  const isNew = customers.length === 0 || choice === NEW_CUSTOMER;
  const selected = isNew ? undefined : (customers.find((o) => o.id === choice) ?? customers[0]);
  const managed = customers.find((o) => o.id === manageId) ?? customers[0];
  const canStart = isNew ? newName.trim() !== '' : selected !== undefined;
  const hasSaved = store.data.assessments.length > 0;
  const startFirst = !hasSaved || requestedPattern !== undefined || invalidStarter;
  const modeLabel = (value: DiagnosticMode) =>
    renderTemplate(copy.modeOptions[value], { count: questionCount(value) });

  const createAssessment = () => {
    if (!canStart) throw new Error('Name a customer before creating an assessment');
    const sample = starter.startsWith('sample:')
      ? content.samples.find((s) => s.id === starter.slice(7))
      : undefined;
    const pattern = content.patterns.find((p) => p.id === (sample?.patternId ?? starter.slice(8)));
    const id = crypto.randomUUID();
    const organizationId = selected?.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const answers = pattern
      ? { ...pattern.answers, ...sample?.answers, useCaseName: sample?.title ?? pattern.title }
      : {};
    store.change((draft) => {
      if (isNew)
        draft.organizations.push({
          id: organizationId,
          answers: {
            orgName: newName.trim(),
            ...(knownAnswer(newCloud) ? { cloudEnvironment: newCloud } : {}),
          },
          contentVersion: contentMeta.contentVersion,
          createdAt: now,
          updatedAt: now,
        });
      draft.assessments.push({
        id,
        organizationId,
        answers,
        mode,
        // The customer's name and cloud were just given, so a quick scan starts at the use case.
        sectionId: mode === 'quick' ? 'profile' : 'organization',
        patternId: pattern?.id ?? null,
        sampleId: sample?.id ?? null,
        ...(pattern && { assumedQuestionIds: seededAssumptions(answers) }),
        contentVersion: contentMeta.contentVersion,
        createdAt: now,
        updatedAt: now,
      });
    });
    navigate(`/diagnostic/${id}`);
  };
  const duplicate = (assessment: Assessment) => {
    const now = new Date().toISOString();
    store.change((draft) => {
      draft.assessments.push({
        ...structuredClone(assessment),
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        answers: {
          ...assessment.answers,
          useCaseName: renderTemplate(copy.duplicateName, {
            label: assessmentName(assessment),
          }).slice(0, 120),
        },
      });
    });
  };

  const startSection = (
    <section aria-labelledby="start-heading" className={styles.section}>
      <h2 id="start-heading">{copy.startHeading}</h2>
      <form
        className={styles.controls}
        onSubmit={(e) => {
          e.preventDefault();
          if (canStart) createAssessment();
        }}
      >
        {customers.length > 0 && (
          <div>
            <label htmlFor="customer">{copy.selectOrganization}</label>
            <select
              id="customer"
              value={isNew ? NEW_CUSTOMER : selected!.id}
              onChange={(e) => setChoice(e.target.value)}
            >
              {customers.map((o) => (
                <option key={o.id} value={o.id}>
                  {orgName(o.id)}
                </option>
              ))}
              <option value={NEW_CUSTOMER}>{copy.newCustomerOption}</option>
            </select>
          </div>
        )}
        {isNew && (
          <>
            <div>
              <label htmlFor="new-org-name">{copy.newOrganization}</label>
              <input
                id="new-org-name"
                maxLength={120}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <QuestionInput
              question={content.questions.find((q) => q.id === 'cloudEnvironment')!}
              answer={newCloud}
              onChange={setNewCloud}
              compact
            />
          </>
        )}
        <div>
          <label htmlFor="starter">{copy.starter}</label>
          <select id="starter" value={starter} onChange={(e) => setStarter(e.target.value)}>
            <option value="">{copy.blank}</option>
            <optgroup label={content.site.routes.patterns.title}>
              {content.patterns.map((p) => (
                <option key={p.id} value={`pattern:${p.id}`}>
                  {p.title}
                </option>
              ))}
            </optgroup>
            <optgroup label={content.site.mapping.samples}>
              {content.samples.map((s) => (
                <option key={s.id} value={`sample:${s.id}`}>
                  {s.title}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label htmlFor="diagnostic-mode">{copy.mode}</label>
          <select
            id="diagnostic-mode"
            value={mode}
            onChange={(e) => {
              if (e.target.value === 'quick' || e.target.value === 'full') setMode(e.target.value);
            }}
          >
            <option value="quick">{modeLabel('quick')}</option>
            <option value="full">{modeLabel('full')}</option>
          </select>
        </div>
        <button type="submit" className={styles.primary} disabled={!canStart}>
          {copy.start}
        </button>
      </form>
      <p className={styles.note}>{mode === 'quick' ? copy.quickNote : copy.fullNote}</p>
      <p className={styles.note}>{copy.startPrivacy}</p>
      <p>
        <Link to="/canvas/blank">{content.site.readout.blankCanvas}</Link>
      </p>
    </section>
  );

  const savedSection = (
    <section aria-labelledby="saved-heading" className={styles.section}>
      <h2 id="saved-heading">{copy.assessments}</h2>
      {!hasSaved && <p>{copy.empty}</p>}
      <ul className={styles.cards}>
        {[...store.data.assessments]
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map((assessment) => (
            <li className={styles.card} key={assessment.id}>
              <h3>{assessmentName(assessment)}</h3>
              <p>{orgName(assessment.organizationId)}</p>
              <p>{copy.modes[assessment.mode]}</p>
              <p>
                {copy.updated}:{' '}
                <time dateTime={assessment.updatedAt}>
                  {new Date(assessment.updatedAt).toLocaleString()}
                </time>
              </p>
              {renaming === assessment.id ? (
                <form
                  className={styles.controls}
                  onSubmit={(e) => {
                    e.preventDefault();
                    store.change((draft) => {
                      const a = draft.assessments.find((a) => a.id === assessment.id)!;
                      a.answers.useCaseName = renameValue.trim();
                      a.updatedAt = new Date().toISOString();
                      a.contentVersion = contentMeta.contentVersion;
                    });
                    setRenaming(null);
                  }}
                >
                  <div>
                    <label htmlFor={`rename-${assessment.id}`}>{copy.assessmentName}</label>
                    <input
                      id={`rename-${assessment.id}`}
                      maxLength={120}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                    />
                  </div>
                  <button type="submit">{copy.save}</button>
                  <button type="button" onClick={() => setRenaming(null)}>
                    {copy.cancel}
                  </button>
                </form>
              ) : (
                <>
                  <div className={styles.actions}>
                    <Link to={`/diagnostic/${assessment.id}`}>{copy.resume}</Link>
                    <Link to={`/diagnostic/${assessment.id}/readout`}>
                      {content.site.readout.open}
                    </Link>
                  </div>
                  <details className={styles.overflow}>
                    <summary>
                      {copy.more}{' '}
                      <span className="visually-hidden">— {assessmentName(assessment)}</span>
                    </summary>
                    <div className={styles.actions}>
                      <button type="button" onClick={() => duplicate(assessment)}>
                        {copy.duplicate}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenaming(assessment.id);
                          setRenameValue(assessmentName(assessment));
                        }}
                      >
                        {copy.rename}
                      </button>
                      <button
                        {...restoreFocusTarget}
                        type="button"
                        onClick={() =>
                          setDeleting({
                            kind: 'assessment',
                            id: assessment.id,
                            label: assessmentName(assessment),
                          })
                        }
                      >
                        {copy.delete}
                      </button>
                    </div>
                  </details>
                </>
              )}
            </li>
          ))}
      </ul>
    </section>
  );

  return (
    <PageContainer>
      <PageHeading>{content.site.routes.diagnostic.title}</PageHeading>
      <p className={styles.intro}>{copy.intro}</p>
      <p className={styles.note}>{copy.privacy}</p>
      {invalidStarter && <p role="alert">{copy.invalidStarter}</p>}
      {startFirst ? (
        <>
          {startSection}
          {hasSaved && savedSection}
        </>
      ) : (
        <>
          {savedSection}
          {startSection}
        </>
      )}
      <details className={styles.section}>
        <summary>{copy.manageCustomers}</summary>
        {managed ? (
          <>
            <div className={styles.controls}>
              <div>
                <label htmlFor="saved-org">{copy.selectOrganization}</label>
                <select
                  id="saved-org"
                  value={managed.id}
                  onChange={(e) => setManageId(e.target.value)}
                >
                  {customers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {orgName(o.id)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className={styles.note}>{copy.sharedOrganization}</p>
            {['orgName', 'cloudEnvironment'].map((id) => (
              <QuestionInput
                key={`${managed.id}-${id}`}
                question={content.questions.find((q) => q.id === id)!}
                answer={managed.answers[id]}
                onChange={(answer) =>
                  store.change((draft) => {
                    const org = draft.organizations.find((o) => o.id === managed.id)!;
                    org.answers[id] = answer;
                    org.updatedAt = new Date().toISOString();
                    org.contentVersion = contentMeta.contentVersion;
                  })
                }
              />
            ))}
            <div className={styles.actions}>
              <button
                {...restoreFocusTarget}
                type="button"
                disabled={store.data.assessments.some((a) => a.organizationId === managed.id)}
                onClick={() =>
                  setDeleting({
                    kind: 'organization',
                    id: managed.id,
                    label: orgName(managed.id),
                  })
                }
              >
                {copy.deleteOrganization}
              </button>
            </div>
            {store.data.assessments.some((a) => a.organizationId === managed.id) && (
              <p className={styles.note}>{copy.organizationInUse}</p>
            )}
          </>
        ) : (
          <p>{copy.noOrganization}</p>
        )}
      </details>
      <details className={styles.section}>
        <summary>{copy.backup}</summary>
        <DiagnosticTransfer />
      </details>
      <p role="status">{store.dirty || store.error ? copy.unsaved : copy.saved}</p>
      <ConfirmDialog
        open={deleting !== null}
        title={copy.deleteTitle}
        body={renderTemplate(copy.deleteBody, { label: deleting?.label ?? '' })}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          store.change((draft) => {
            if (deleting.kind === 'assessment')
              draft.assessments = draft.assessments.filter((a) => a.id !== deleting.id);
            else {
              if (draft.assessments.some((a) => a.organizationId === deleting.id))
                throw new Error('Cannot delete a customer with linked assessments');
              draft.organizations = draft.organizations.filter((o) => o.id !== deleting.id);
            }
          });
          setDeleting(null);
        }}
      />
    </PageContainer>
  );
}
