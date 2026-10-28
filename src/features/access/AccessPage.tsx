import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AccessChange } from '../../components/AccessChange.tsx';
import { AccessTable } from '../../components/AccessTable.tsx';
import { AssessmentPicker } from '../../components/AssessmentPicker.tsx';
import { Badge } from '../../components/Badge.tsx';
import { ReviewBadge } from '../../components/VerifiedBadge.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { SourceNote } from '../../components/SourceNote.tsx';
import { content, contentMeta } from '../../lib/content/index.ts';
import { evaluateAccessChange, PATTERN_ANSWER, patternsFor } from '../../lib/engine/access.ts';
import { answerErrors } from '../../lib/engine/answers.ts';
import { loadDiagnostics } from '../../lib/state/diagnostic-storage.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './AccessPage.module.css';

const accessQuestion = content.questions.find((question) => question.id === 'accessModel');

export function Component() {
  usePageTitle('access');
  const copy = content.accessPatterns;
  const { site } = content;
  const [params, setParams] = useSearchParams();
  const workspace = useMemo(() => loadDiagnostics().data, []);

  const assessment = workspace.assessments.find((a) => a.id === params.get('assessment'));
  const organization = workspace.organizations.find((o) => o.id === assessment?.organizationId);
  const answers =
    assessment !== undefined && organization !== undefined
      ? { org: organization.answers, useCase: assessment.answers }
      : null;
  // Saved answers can predate the current questions; the engine refuses those, so the page says so instead.
  const incompatible =
    answers !== null &&
    [
      ...answerErrors(content.questions, answers.org, 'org'),
      ...answerErrors(content.questions, answers.useCase, 'useCase'),
    ].length > 0;
  const view =
    answers !== null && !incompatible
      ? evaluateAccessChange(content, answers, contentMeta.contentVersion)
      : null;
  const current = patternsFor(content, assessment?.answers.accessModel);

  const setAssessment = (id: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (id === '') next.delete('assessment');
        else next.set('assessment', id);
        return next;
      },
      { replace: true, preventScrollReset: true, flushSync: true },
    );

  const jump: [string, string][] = [
    ['patterns', copy.patternsHeading],
    ['change', copy.changeHeading],
    ['stated', copy.statedHeading],
    ['sources-differ', copy.tensionHeading],
    ['availability', copy.statusHeading],
  ];

  return (
    <PageContainer>
      <PageHeading>{site.routes.access.title}</PageHeading>
      <p className={styles.intro}>{copy.intro}</p>
      <p className={styles.notice}>
        <ReviewBadge reviewStatus={copy.reviewStatus} /> {copy.notice}
      </p>
      <p className={styles.notice}>{copy.termsNote}</p>
      <nav aria-label={copy.jumpLabel}>
        <ul className={styles.jump}>
          {jump.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`}>{label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <section id="patterns" aria-labelledby="patterns-heading" className={styles.section}>
        <h2 id="patterns-heading">{copy.patternsHeading}</h2>
        <ul className={styles.cards}>
          {copy.patterns.map((pattern) => {
            const populations = pattern.licensingIds.flatMap((id) => {
              const population = content.licensing.who.populations.find((p) => p.id === id);
              return population === undefined ? [] : [population];
            });
            const answerLabels = (accessQuestion?.options ?? [])
              .filter((option) => (pattern.answers as readonly string[]).includes(option.value))
              .map((option) => option.label);
            const licensingLink = new URLSearchParams({ access: PATTERN_ANSWER[pattern.id] });
            if (assessment !== undefined) licensingLink.set('assessment', assessment.id);
            return (
              <li
                key={pattern.id}
                className={
                  current.includes(pattern.id) ? `${styles.card} ${styles.mine}` : styles.card
                }
              >
                <h3>
                  {pattern.label}{' '}
                  {current.includes(pattern.id) && <Badge tone="info">{copy.currentBadge}</Badge>}
                </h3>
                <p>{pattern.plain}</p>
                <p>
                  <strong>{copy.termsLabel}:</strong> {pattern.terms.join('; ')}
                </p>
                <p>
                  <strong>{copy.questionLabel}:</strong> {answerLabels.join('; ')}
                </p>
                <p>
                  <strong>{copy.licenseLabel}:</strong>
                </p>
                <ul className={styles.plain}>
                  {populations.map((population) => (
                    <li key={population.id}>
                      {population.label} ({content.licensing.needs[population.need]})
                    </li>
                  ))}
                </ul>
                <p>
                  <Link to={`/licensing?${licensingLink.toString()}`}>{copy.openLicensing}</Link>
                </p>
                <SourceNote
                  sourceIds={pattern.sourceIds}
                  evidence={pattern.evidence}
                  lastVerified={pattern.lastVerified}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section id="change" aria-labelledby="change-heading" className={styles.section}>
        <h2 id="change-heading">{copy.changeHeading}</h2>
        <p>{copy.viewIntro}</p>
        <div className={styles.controls}>
          <AssessmentPicker
            workspace={workspace}
            id="access-assessment"
            label={copy.assessmentLabel}
            none={copy.noAssessment}
            value={assessment?.id ?? ''}
            onChange={setAssessment}
          />
        </div>
        {assessment === undefined && <p className={styles.muted}>{copy.viewNoAssessment}</p>}
        {assessment !== undefined && incompatible && (
          <p role="note">
            {site.diagnostic.incompatible}{' '}
            <Link to={`/diagnostic/${assessment.id}`}>{site.ui.customer.edit}</Link>
          </p>
        )}
        {view !== null && (
          <>
            {current.length === 0 && <p>{copy.thisAgentUnknown}</p>}
            <AccessChange view={view} showIntro={false} />
          </>
        )}
      </section>

      <section id="stated" aria-labelledby="stated-heading" className={styles.section}>
        <h2 id="stated-heading">{copy.statedHeading}</h2>
        <AccessTable />
        <h3>{copy.unsplitHeading}</h3>
        <p>{copy.unsplit}</p>
      </section>

      <section id="sources-differ" aria-labelledby="differ-heading" className={styles.section}>
        <h2 id="differ-heading">{copy.tensionHeading}</h2>
        <p>{copy.tension.text}</p>
        <SourceNote
          sourceIds={copy.tension.sourceIds}
          evidence={copy.tension.evidence}
          lastVerified={copy.tension.lastVerified}
        />
      </section>

      <section id="availability" aria-labelledby="availability-heading" className={styles.section}>
        <h2 id="availability-heading">{copy.statusHeading}</h2>
        <ul className={styles.statements}>
          {copy.statuses.map((entry) => (
            <li key={entry.id}>
              <p>
                <strong>{copy.patterns.find((p) => p.id === entry.patternId)?.label}:</strong>{' '}
                {entry.label} <Badge tone="outline">{copy.statusNames[entry.status]}</Badge>
              </p>
              <SourceNote
                sourceIds={entry.sourceIds}
                evidence={entry.evidence}
                lastVerified={entry.lastVerified}
              />
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
