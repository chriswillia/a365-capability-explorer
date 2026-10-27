import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ButtonLink } from '../../components/ButtonLink.tsx';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { PillarSummary } from '../../components/PillarSummary.tsx';
import { content, contentMeta, pillarName } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import type { Answers, Question } from '../../lib/content/schemas.ts';
import { answerErrors, knownAnswer } from '../../lib/engine/answers.ts';
import { evaluateAssessment, type AssessmentResult } from '../../lib/engine/evaluate.ts';
import { pillarCoverage, pillarRows } from '../../lib/engine/pillars.ts';
import { standingAssumptions } from '../../lib/state/assumptions.ts';
import { useDiagnostics } from '../../lib/state/diagnostics.ts';
import {
  displayName,
  type Assessment,
  type Organization,
} from '../../lib/state/diagnostic-model.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { QuestionInput } from './QuestionInput.tsx';
import { compatibleAnswers, diagnosticSections } from './questions.ts';
import styles from './Diagnostic.module.css';

type AnatomyView = 'pillar' | 'layer';

function Requirements({
  result,
  coverage,
}: {
  result: AssessmentResult;
  coverage: ReturnType<typeof pillarCoverage>;
}) {
  const copy = content.site.mapping;
  const [by, setBy] = useState<AnatomyView>('pillar');
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
      <fieldset className={styles.segmented}>
        <legend>{copy.anatomyBy}</legend>
        {(['pillar', 'layer'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={by === option}
            onClick={() => setBy(option)}
          >
            {copy.anatomyByOptions[option]}
          </button>
        ))}
      </fieldset>
      {by === 'pillar' ? (
        <PillarSummary rows={pillarRows(content, result.inScope)} headingLevel={3} />
      ) : (
        <>
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
              caption={content.site.diagnostic.emerging}
              columns={columns}
              rows={result.anatomy}
              rowKey={(row) => row.point.id}
              scrollLabel={content.site.diagnostic.emerging}
            />
          </details>
        </>
      )}
      <section aria-labelledby="coverage-title">
        <h3 id="coverage-title">{copy.coverage}</h3>
        <ul className={styles.coverage}>
          {coverage.map((row) => (
            <li key={row.pillar.id}>
              {renderTemplate(copy.coverageRow, {
                label: pillarName(row.pillar),
                answered: row.answered,
                total: row.total,
              })}
              {row.assumed > 0 &&
                ` · ${renderTemplate(copy.coverageAssumed, { assumed: row.assumed })}`}
            </li>
          ))}
        </ul>
      </section>
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
  const assumed = new Set(standingAssumptions(assessment));
  const answered = visibleQuestions.filter((q) => knownAnswer(answers[q.id]));
  const assumedCount = answered.filter((q) => assumed.has(q.id)).length;
  const coverage = pillarCoverage(
    content,
    answers,
    new Set(visibleQuestions.map((q) => q.id)),
    assumed,
  );
  const setSection = (id: string) =>
    store.change((draft) => {
      const a = draft.assessments.find((a) => a.id === assessment.id)!;
      a.sectionId = id;
      a.updatedAt = new Date().toISOString();
    });
  const dropAssumption = (draft: { assessments: Assessment[] }, id: string) => {
    const a = draft.assessments.find((a) => a.id === assessment.id)!;
    const remaining = (a.assumedQuestionIds ?? []).filter((item) => item !== id);
    if (remaining.length > 0) a.assumedQuestionIds = remaining;
    else delete a.assumedQuestionIds;
  };
  const updateAnswer = (question: Question, value: Answers[string]) =>
    store.change((draft) => {
      const entity =
        question.scope === 'org'
          ? draft.organizations.find((o) => o.id === organization.id)!
          : draft.assessments.find((a) => a.id === assessment.id)!;
      entity.answers[question.id] = value;
      entity.updatedAt = new Date().toISOString();
      entity.contentVersion = contentMeta.contentVersion;
      if (question.scope === 'useCase') dropAssumption(draft, question.id);
    });
  const confirmAnswer = (question: Question) =>
    store.change((draft) => {
      dropAssumption(draft, question.id);
      draft.assessments.find((a) => a.id === assessment.id)!.updatedAt = new Date().toISOString();
    });
  const status = [
    renderTemplate(copy.answeredStatus, {
      answered: answered.length,
      total: visibleQuestions.length,
    }),
    ...(assumedCount > 0 ? [renderTemplate(copy.assumedStatus, { assumed: assumedCount })] : []),
  ].join(' · ');
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
      <div className={styles.toolbar}>
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
        <p className={styles.status} role="status">
          {status} · {store.dirty || store.error ? copy.unsaved : copy.saved} ·{' '}
          {copy.currentContent}: <code>{contentMeta.contentVersion}</code>
        </p>
        <span className={styles.spacer} />
        {result && (
          <>
            <Link to={`/canvas/${assessment.id}`}>{content.site.readout.canvas}</Link>
            <ButtonLink to={`/diagnostic/${assessment.id}/readout`}>
              {content.site.readout.open}
            </ButtonLink>
          </>
        )}
      </div>
      <p className={styles.note}>{assessment.mode === 'quick' ? copy.quickNote : copy.fullNote}</p>
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
      <div className={styles.layout} data-review={section === undefined ? '' : undefined}>
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
                  assumed={question.scope === 'useCase' && assumed.has(question.id)}
                  onConfirm={() => confirmAnswer(question)}
                />
              ))}
            </>
          ) : (
            <div className={styles.reviewSummary}>
              <p>{copy.reviewNote}</p>
              {result ? (
                <>
                  <PillarSummary rows={pillarRows(content, result.inScope)} />
                  <p>
                    {renderTemplate(content.site.readout.takeaways[2], {
                      count: result.openQuestions.length,
                    })}
                  </p>
                  {assumedCount > 0 && (
                    <p>{renderTemplate(copy.assumedStatus, { assumed: assumedCount })}</p>
                  )}
                  <div className={styles.actions}>
                    <ButtonLink to={`/diagnostic/${assessment.id}/readout`}>
                      {content.site.readout.open}
                    </ButtonLink>
                    <Link to={`/canvas/${assessment.id}`}>{content.site.readout.canvas}</Link>
                  </div>
                </>
              ) : (
                <p>{copy.noPreview}</p>
              )}
            </div>
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
        {section &&
          (result ? (
            <Requirements result={result} coverage={coverage} />
          ) : (
            <aside>
              <h2>{copy.emerging}</h2>
              <p>{copy.noPreview}</p>
            </aside>
          ))}
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
