import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content, contentMeta } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { useDiagnostics } from '../../lib/state/diagnostics.ts';
import {
  displayName,
  type Assessment,
  type DiagnosticMode,
} from '../../lib/state/diagnostic-model.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { QuestionInput } from './QuestionInput.tsx';
import styles from './Diagnostic.module.css';

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
  const [selectedId, setSelectedId] = useState('');
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<{
    kind: 'assessment' | 'organization';
    id: string;
    label: string;
  } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const organization =
    store.data.organizations.find((o) => o.id === selectedId) ?? store.data.organizations[0];
  const orgName = (id: string) =>
    displayName(
      store.data.organizations.find((o) => o.id === id)!.answers,
      'orgName',
      copy.untitledOrganization,
    );
  const assessmentName = (a: Assessment) =>
    displayName(a.answers, 'useCaseName', copy.untitledAssessment);
  const createOrganization = () => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    store.change((draft) => {
      draft.organizations.push({
        id,
        answers: { orgName: newName.trim() },
        contentVersion: contentMeta.contentVersion,
        createdAt: now,
        updatedAt: now,
      });
    });
    setSelectedId(id);
    setNewName('');
  };
  const createAssessment = () => {
    if (!organization) throw new Error('Choose an organization before creating an assessment');
    const sample = starter.startsWith('sample:')
      ? content.samples.find((s) => s.id === starter.slice(7))
      : undefined;
    const pattern = content.patterns.find((p) => p.id === (sample?.patternId ?? starter.slice(8)));
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const answers = pattern
      ? { ...pattern.answers, ...sample?.answers, useCaseName: sample?.title ?? pattern.title }
      : {};
    store.change((draft) => {
      draft.assessments.push({
        id,
        organizationId: organization.id,
        answers,
        mode,
        sectionId: 'organization',
        patternId: pattern?.id ?? null,
        sampleId: sample?.id ?? null,
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
  return (
    <PageContainer>
      <PageHeading>{content.site.routes.diagnostic.title}</PageHeading>
      <p className={styles.intro}>{copy.intro}</p>
      <p className={styles.note}>{copy.privacy}</p>
      {invalidStarter && <p role="alert">{copy.invalidStarter}</p>}
      <section>
        <h2>{copy.organization}</h2>
        <form
          className={styles.controls}
          onSubmit={(e) => {
            e.preventDefault();
            createOrganization();
          }}
        >
          <div>
            <label htmlFor="new-org-name">{copy.newOrganization}</label>
            <input
              id="new-org-name"
              maxLength={120}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <button type="submit">{copy.createOrganization}</button>
        </form>
        {organization ? (
          <>
            <div className={styles.controls}>
              <div>
                <label htmlFor="saved-org">{copy.selectOrganization}</label>
                <select
                  id="saved-org"
                  value={organization.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {store.data.organizations.map((o) => (
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
                key={id}
                question={content.questions.find((q) => q.id === id)!}
                answer={organization.answers[id]}
                onChange={(answer) =>
                  store.change((draft) => {
                    const org = draft.organizations.find((o) => o.id === organization.id)!;
                    org.answers[id] = answer;
                    org.updatedAt = new Date().toISOString();
                    org.contentVersion = contentMeta.contentVersion;
                  })
                }
              />
            ))}
            <div className={styles.actions}>
              <button
                type="button"
                disabled={store.data.assessments.some((a) => a.organizationId === organization.id)}
                onClick={() =>
                  setDeleting({
                    kind: 'organization',
                    id: organization.id,
                    label: orgName(organization.id),
                  })
                }
              >
                {copy.deleteOrganization}
              </button>
            </div>
            {store.data.assessments.some((a) => a.organizationId === organization.id) && (
              <p className={styles.note}>{copy.organizationInUse}</p>
            )}
          </>
        ) : (
          <p>{copy.noOrganization}</p>
        )}
      </section>
      <section>
        <h2>{copy.start}</h2>
        <div className={styles.controls}>
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
                if (e.target.value === 'quick' || e.target.value === 'full')
                  setMode(e.target.value);
              }}
            >
              <option value="quick">{copy.modes.quick}</option>
              <option value="full">{copy.modes.full}</option>
            </select>
          </div>
          <button type="button" disabled={!organization} onClick={createAssessment}>
            {copy.start}
          </button>
        </div>
        <p>{mode === 'quick' ? copy.quickNote : copy.fullNote}</p>
      </section>
      <section>
        <h2>{copy.assessments}</h2>
        {store.data.assessments.length === 0 && <p>{copy.empty}</p>}
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
                  <div className={styles.actions}>
                    <Link to={`/diagnostic/${assessment.id}`}>{copy.resume}</Link>
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
                )}
              </li>
            ))}
        </ul>
      </section>
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
                throw new Error('Cannot delete an organization with linked assessments');
              draft.organizations = draft.organizations.filter((o) => o.id !== deleting.id);
            }
          });
          setDeleting(null);
        }}
      />
    </PageContainer>
  );
}
