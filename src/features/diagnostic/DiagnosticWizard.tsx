import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content, contentMeta } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import type { Answers, Question } from '../../lib/content/schemas.ts';
import { answerErrors, knownAnswer } from '../../lib/engine/answers.ts';
import { evaluateAssessment, type AssessmentResult } from '../../lib/engine/evaluate.ts';
import { useDiagnostics } from '../../lib/state/diagnostics.ts';
import {
  displayName,
  type Assessment,
  type Organization,
} from '../../lib/state/diagnostic-model.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { MappingReport } from '../mapping/MappingReport.tsx';
import { QuestionInput } from './QuestionInput.tsx';
import { compatibleAnswers, diagnosticSections } from './questions.ts';
import styles from './Diagnostic.module.css';

function Anatomy({ result }: { result: AssessmentResult }) {
  const copy = content.site.mapping;
  type Layer = AssessmentResult['anatomy'][number];
  const columns: Column<Layer>[] = [
    {
      key: 'layer',
      header: content.site.capabilities.columns.layer,
      rowHeader: true,
      render: (row) => row.point.layer,
    },
    {
      key: 'controls',
      header: copy.inScope,
      render: (row) =>
        row.capabilities.length === 0 ? (
          copy.unknownAnswer
        ) : (
          <ul>
            {row.capabilities.map(({ capability, level }) => (
              <li key={capability.id}>
                {capability.shortName} — {copy.levels[level]}
              </li>
            ))}
          </ul>
        ),
    },
  ];
  return (
    <aside className={styles.blueprint} aria-labelledby="emerging-title">
      <h2 id="emerging-title">{content.site.diagnostic.emerging}</h2>
      <p>{content.site.diagnostic.emergingNote}</p>
      <ol className={styles.layerList}>
        {result.anatomy.map(({ point, capabilities }) => (
          <li key={point.id}>
            <strong>{point.layer}</strong>
            {capabilities.length === 0 ? (
              <p>{copy.unknownAnswer}</p>
            ) : (
              <ul>
                {capabilities.map(({ capability, level }) => (
                  <li key={capability.id}>
                    <Link to={`/capabilities/${capability.id}`}>{capability.shortName}</Link> —{' '}
                    {copy.levels[level]}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <details>
        <summary>{copy.anatomy}</summary>
        <DataTable
          caption={copy.anatomy}
          columns={columns}
          rows={result.anatomy}
          rowKey={(row) => row.point.id}
          scrollLabel={copy.anatomy}
        />
      </details>
    </aside>
  );
}

function Wizard({
  assessment,
  organization,
}: {
  assessment: Assessment;
  organization: Organization;
}) {
  const store = useDiagnostics();
  const copy = content.site.diagnostic;
  usePageTitle(
    'assessment',
    displayName(assessment.answers, 'useCaseName', copy.untitledAssessment),
  );
  const answers = { ...organization.answers, ...assessment.answers };
  const sections = diagnosticSections(content, assessment.mode, answers);
  const sectionIndex =
    assessment.sectionId === 'review'
      ? sections.length
      : Math.max(
          0,
          sections.findIndex((s) => s.id === assessment.sectionId),
        );
  const section = sections[sectionIndex];
  const activeId = section?.id ?? 'review';
  const heading = useRef<HTMLHeadingElement>(null);
  const lastSection = useRef(activeId);
  useEffect(() => {
    if (lastSection.current !== activeId) heading.current?.focus();
    lastSection.current = activeId;
  }, [activeId]);
  const errors = [
    ...answerErrors(content.questions, organization.answers, 'org'),
    ...answerErrors(content.questions, assessment.answers, 'useCase'),
  ];
  const result =
    errors.length === 0
      ? evaluateAssessment(
          content,
          { org: organization.answers, useCase: assessment.answers },
          contentMeta.contentVersion,
        )
      : null;
  const visibleQuestions = sections.flatMap((s) => s.questions);
  const setSection = (id: string) =>
    store.change((draft) => {
      const a = draft.assessments.find((a) => a.id === assessment.id)!;
      a.sectionId = id;
      a.updatedAt = new Date().toISOString();
    });
  const updateAnswer = (question: Question, value: Answers[string]) =>
    store.change((draft) => {
      const entity =
        question.scope === 'org'
          ? draft.organizations.find((o) => o.id === organization.id)!
          : draft.assessments.find((a) => a.id === assessment.id)!;
      entity.answers[question.id] = value;
      entity.updatedAt = new Date().toISOString();
      entity.contentVersion = contentMeta.contentVersion;
    });
  return (
    <PageContainer>
      <Link to="/diagnostic">{copy.back}</Link>
      <PageHeading>
        {displayName(assessment.answers, 'useCaseName', copy.untitledAssessment)}
      </PageHeading>
      <p>
        {displayName(organization.answers, 'orgName', copy.untitledOrganization)} ·{' '}
        {copy.savedLocally}
      </p>
      <div className={styles.controls}>
        <div>
          <label htmlFor="wizard-mode">{copy.mode}</label>
          <select
            id="wizard-mode"
            value={assessment.mode}
            onChange={(e) => {
              const mode = e.target.value;
              if (mode === 'quick' || mode === 'full')
                store.change((draft) => {
                  const a = draft.assessments.find((a) => a.id === assessment.id)!;
                  a.mode = mode;
                  a.updatedAt = new Date().toISOString();
                });
            }}
          >
            <option value="quick">{copy.modes.quick}</option>
            <option value="full">{copy.modes.full}</option>
          </select>
        </div>
      </div>
      <p>{assessment.mode === 'quick' ? copy.quickNote : copy.fullNote}</p>
      <p>
        {copy.knownAnswers}: {visibleQuestions.filter((q) => knownAnswer(answers[q.id])).length} /{' '}
        {visibleQuestions.length}
      </p>
      <p role="status">{store.dirty || store.error ? copy.unsaved : copy.saved}</p>
      <p className={styles.note}>
        {copy.currentContent}: <code>{contentMeta.contentVersion}</code>
      </p>
      {(assessment.contentVersion !== contentMeta.contentVersion ||
        organization.contentVersion !== contentMeta.contentVersion) && (
        <p role="note">{copy.oldContent}</p>
      )}
      {errors.length > 0 && (
        <div role="alert">
          <p>{copy.incompatible}</p>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() =>
                store.change((draft) => {
                  const a = draft.assessments.find((a) => a.id === assessment.id)!;
                  const org = draft.organizations.find((o) => o.id === organization.id)!;
                  a.answers = compatibleAnswers(content.questions, a.answers, 'useCase');
                  org.answers = compatibleAnswers(content.questions, org.answers, 'org');
                  a.updatedAt = org.updatedAt = new Date().toISOString();
                  a.contentVersion = org.contentVersion = contentMeta.contentVersion;
                })
              }
            >
              {copy.clearIncompatible}
            </button>
          </div>
        </div>
      )}
      <div className={styles.layout}>
        <nav className={styles.rail} aria-label={copy.sectionRail}>
          <ol>
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={activeId === s.id ? 'step' : undefined}
                  onClick={() => setSection(s.id)}
                >
                  {s.title}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                aria-current={activeId === 'review' ? 'step' : undefined}
                onClick={() => setSection('review')}
              >
                {copy.review}
              </button>
            </li>
          </ol>
        </nav>
        <section>
          <p>
            {renderTemplate(copy.progress, { n: sectionIndex + 1, count: sections.length + 1 })}
          </p>
          <h2 ref={heading} tabIndex={-1}>
            {section?.title ?? copy.review}
          </h2>
          {section ? (
            <>
              <p>{section.description}</p>
              {section.scope === 'org' && <p className={styles.note}>{copy.sharedOrganization}</p>}
              {section.questions.map((question) => (
                <QuestionInput
                  key={question.id}
                  question={question}
                  answer={answers[question.id]}
                  onChange={(value) => updateAnswer(question, value)}
                />
              ))}
            </>
          ) : (
            <>
              <h3>{copy.preview}</h3>
              <p>{copy.previewNote}</p>
              {result ? <MappingReport result={result} /> : <p>{copy.noPreview}</p>}
            </>
          )}
          <div className={styles.actions}>
            {sectionIndex > 0 && (
              <button type="button" onClick={() => setSection(sections[sectionIndex - 1]!.id)}>
                {copy.previous}
              </button>
            )}
            {sectionIndex < sections.length && (
              <button
                type="button"
                onClick={() => setSection(sections[sectionIndex + 1]?.id ?? 'review')}
              >
                {copy.next}
              </button>
            )}
          </div>
        </section>
        {result ? (
          <Anatomy result={result} />
        ) : (
          <aside>
            <h2>{copy.emerging}</h2>
            <p>{copy.noPreview}</p>
          </aside>
        )}
      </div>
    </PageContainer>
  );
}

function MissingAssessment() {
  usePageTitle('assessment');
  return (
    <PageContainer>
      <PageHeading>{content.site.routes.assessment.title}</PageHeading>
      <p role="alert">{content.site.diagnostic.notFound}</p>
      <Link to="/diagnostic">{content.site.diagnostic.back}</Link>
    </PageContainer>
  );
}

export function Component() {
  const { id } = useParams();
  const { data } = useDiagnostics();
  const assessment = data.assessments.find((a) => a.id === id);
  const organization = data.organizations.find((o) => o.id === assessment?.organizationId);
  return assessment && organization ? (
    <Wizard key={assessment.id} assessment={assessment} organization={organization} />
  ) : (
    <MissingAssessment />
  );
}
