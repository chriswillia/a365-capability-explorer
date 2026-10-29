import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Badge } from '../../components/Badge.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { ReviewBadge } from '../../components/VerifiedBadge.tsx';
import { content, contentMeta, pillarName } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { answerErrors } from '../../lib/engine/answers.ts';
import {
  CONTROL_LIMIT,
  QUESTION_LIMIT,
  buildLeaveBehind,
  stepLimit,
} from '../../lib/engine/leave-behind.ts';
import { downloadBlob } from '../../lib/readout/files.ts';
import { standingAssumptions } from '../../lib/state/assumptions.ts';
import { displayName } from '../../lib/state/diagnostic-model.ts';
import { useDiagnostics } from '../../lib/state/diagnostics.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './LeaveBehindPage.module.css';

/**
 * The page to print or save as PDF, and the source of the three slides. Both are built from the answers saved for
 * one agent by the same code, so the page and the slides say the same thing.
 */
export function Component() {
  usePageTitle('leaveBehind');
  const { id } = useParams();
  const store = useDiagnostics();
  const { site, leaveBehind: copy } = content;
  const [exporting, setExporting] = useState<'idle' | 'busy' | 'error'>('idle');

  const assessment = store.data.assessments.find((candidate) => candidate.id === id);
  const organization = store.data.organizations.find((o) => o.id === assessment?.organizationId);

  const heading = <PageHeading>{site.routes.leaveBehind.title}</PageHeading>;
  if (assessment === undefined || organization === undefined)
    return (
      <PageContainer>
        {heading}
        <p role="alert" className={styles.missing}>
          {copy.missing} <Link to="/map">{site.routes.map.title}</Link>
        </p>
      </PageContainer>
    );
  const incompatible =
    answerErrors(content.questions, organization.answers, 'org').length > 0 ||
    answerErrors(content.questions, assessment.answers, 'useCase').length > 0;
  if (incompatible)
    return (
      <PageContainer>
        {heading}
        <p role="alert" className={styles.missing}>
          {copy.incompatible}{' '}
          <Link to={`/diagnostic/${assessment.id}`}>{site.routes.diagnostic.title}</Link>
        </p>
      </PageContainer>
    );

  const plan = buildLeaveBehind(
    content,
    { org: organization.answers, useCase: assessment.answers },
    contentMeta.contentVersion,
  );
  const { passport } = plan;
  const page = copy.page;
  const customer = displayName(
    organization.answers,
    'orgName',
    site.diagnostic.untitledOrganization,
  );
  const agent = displayName(assessment.answers, 'useCaseName', page.untitledAgent);
  const prepared = [
    renderTemplate(page.prepared, { date: new Date().toISOString().slice(0, 10) }),
    ...(organization.sample === true ? [site.ui.sample.chip] : []),
  ].join(' · ');
  const stageLabel =
    plan.stage === null
      ? page.accessUnknown
      : (content.questions
          .find((question) => question.id === 'stage')
          ?.options.find((option) => option.value === plan.stage)?.label ?? plan.stage);
  const stageAssumed = standingAssumptions(assessment).includes('stage');
  const titles = new Map(content.sources.map((source) => [source.id, source.title]));

  const download = async () => {
    setExporting('busy');
    try {
      const { leaveBehindPowerPoint } = await import('../../lib/readout/leave-behind.ts');
      const blob = await leaveBehindPowerPoint({ data: content, plan, customer, agent, prepared });
      downloadBlob(`${copy.deck.fileName}.pptx`, blob);
      setExporting('idle');
    } catch {
      setExporting('error');
    }
  };

  return (
    <PageContainer>
      <div data-no-print>
        {heading}
        <p className={styles.intro}>{copy.intro}</p>
        <p className={styles.notice}>
          <ReviewBadge reviewStatus={copy.reviewStatus} /> {copy.notice}
        </p>
        <div className={styles.toolbar} role="group" aria-label={copy.toolbar.heading}>
          <button type="button" onClick={() => window.print()}>
            {copy.toolbar.print}
          </button>
          <button type="button" onClick={() => void download()} disabled={exporting === 'busy'}>
            {copy.toolbar.powerpoint}
          </button>
          <Link to={`/map?assessment=${assessment.id}#passport-heading`}>{copy.toolbar.back}</Link>
          <span role="status" className={styles.status}>
            {exporting === 'busy' ? copy.toolbar.exporting : ''}
          </span>
          {exporting === 'error' && <span role="alert">{copy.toolbar.exportError}</span>}
        </div>
      </div>

      <article className={styles.page} data-print-document aria-labelledby="leave-behind-title">
        <header className={styles.block}>
          <p className={styles.eyebrow}>{page.eyebrow}</p>
          <h2 id="leave-behind-title" className={styles.title}>
            {renderTemplate(page.title, { agent, customer })}
          </h2>
          <p className={styles.muted}>{prepared}</p>
        </header>

        <dl className={styles.facts}>
          <div>
            <dt>{page.accessLabel}</dt>
            <dd>{passport.accessLabel ?? page.accessUnknown}</dd>
          </div>
          <div>
            <dt>{page.platformLabel}</dt>
            <dd>{passport.platform?.label ?? page.accessUnknown}</dd>
          </div>
          <div>
            <dt>{page.stageLabel}</dt>
            <dd>
              {stageLabel}
              {stageAssumed && <> ({page.stageAssumed})</>}
            </dd>
          </div>
        </dl>

        <section aria-labelledby="lb-why" className={styles.block}>
          <h3 id="lb-why">{page.whyHeading}</h3>
          <ul className={styles.list}>
            {plan.why.map((statement) => (
              <li key={statement.id}>{statement.text}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="lb-controls" className={styles.block}>
          <h3 id="lb-controls">{page.controlsHeading}</h3>
          {passport.areas.length === 0 ? (
            <p>{page.controlsNone}</p>
          ) : (
            <div className={styles.columns}>
              {passport.areas.map((area) => (
                <div key={area.pillar.id} className={styles.column}>
                  <h4>{pillarName(area.pillar)}</h4>
                  <ul className={styles.list}>
                    {area.essential.slice(0, CONTROL_LIMIT).map((entry) => (
                      <li key={entry.capability.id}>{entry.capability.shortName}</li>
                    ))}
                  </ul>
                  {area.essential.length > CONTROL_LIMIT && (
                    <p className={styles.muted}>
                      {renderTemplate(page.controlsEssentialMore, {
                        count: area.essential.length - CONTROL_LIMIT,
                      })}
                    </p>
                  )}
                  {area.recommended.length > 0 && (
                    <p className={styles.muted}>
                      {renderTemplate(page.controlsMore, { count: area.recommended.length })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className={styles.pair}>
          <section aria-labelledby="lb-license" className={styles.block}>
            <h3 id="lb-license">{page.licensingHeading}</h3>
            {passport.access === null ? (
              <p>{page.licensingUnknown}</p>
            ) : (
              <ul className={styles.list}>
                {[...plan.license.required, ...plan.license.recommended].map(({ population }) => (
                  <li key={population.id}>
                    {population.label}{' '}
                    <Badge tone={population.need === 'required' ? 'info' : 'outline'}>
                      {content.licensing.needs[population.need]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.muted}>{page.licensingNote}</p>
          </section>

          <section aria-labelledby="lb-steps" className={styles.block}>
            <h3 id="lb-steps">{page.stepsHeading}</h3>
            {plan.steps.length === 0 && <p>{page.stepsNone}</p>}
            {plan.steps.map((step) => {
              const perGate = stepLimit(plan.steps.length);
              return (
                <div key={step.gate.id} className={styles.block}>
                  <h4>{step.gate.title}</h4>
                  <ul className={styles.list}>
                    {step.items.slice(0, perGate).map((view) => (
                      <li key={view.item.id}>
                        <strong>{content.guardrails.statusLabels[view.status]}:</strong>{' '}
                        {view.item.title}
                      </li>
                    ))}
                  </ul>
                  {step.items.length > perGate && (
                    <p className={styles.muted}>
                      {renderTemplate(page.stepsMore, { count: step.items.length - perGate })}
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        </div>

        <section aria-labelledby="lb-confirm" className={styles.block}>
          <h3 id="lb-confirm">{page.confirmHeading}</h3>
          {plan.questions.length === 0 ? (
            <p>{page.confirmNone}</p>
          ) : (
            <ul className={styles.list}>
              {plan.questions.slice(0, QUESTION_LIMIT).map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          )}
          {plan.questions.length > QUESTION_LIMIT && (
            <p className={styles.muted}>
              {renderTemplate(page.confirmMore, { count: plan.questions.length - QUESTION_LIMIT })}
            </p>
          )}
        </section>

        {/* A div, not a footer: the print styles hide every footer, and these lines must reach the paper. */}
        <div className={styles.block}>
          <p className={styles.sources}>
            {page.sourcesHeading}:{' '}
            {plan.sourceIds.flatMap((sourceId) => titles.get(sourceId) ?? []).join('; ')}
          </p>
          <p className={styles.sources}>{site.disclaimer}</p>
        </div>
      </article>
    </PageContainer>
  );
}
