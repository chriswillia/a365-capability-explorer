import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Badge, type BadgeTone } from '../../components/Badge.tsx';
import { ReviewBadge } from '../../components/VerifiedBadge.tsx';
import { AssessmentPicker } from '../../components/AssessmentPicker.tsx';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { PageIntro } from '../../components/PageIntro.tsx';
import { RequirementLine } from '../../components/RequirementLine.tsx';
import { SourceNote } from '../../components/SourceNote.tsx';
import { licensingTier, sourcesDiffer } from '../../lib/content/derive.ts';
import { content, sourceById } from '../../lib/content/index.ts';
import { handoffText, populationViews, segmentFor } from '../../lib/content/licensing.ts';
import {
  baselineRequirements,
  byProductArea,
  capabilityRequirements,
  summarizeStatuses,
  type CapabilityRequirementView,
  type RequirementItemView,
} from '../../lib/content/requirements.ts';
import type { Answers } from '../../lib/content/schemas.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { answerErrors, knownAnswer } from '../../lib/engine/answers.ts';
import { loadDiagnostics } from '../../lib/state/diagnostic-storage.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { SeatCalculator } from './SeatCalculator.tsx';
import styles from './LicensingPage.module.css';

const NEED_TONE: Record<'required' | 'recommended' | 'not-licensed' | 'not-stated', BadgeTone> = {
  required: 'info',
  recommended: 'outline',
  'not-licensed': 'neutral',
  'not-stated': 'amber',
};

const accessQuestion = content.questions.find((question) => question.id === 'accessModel');
const accessOptions = accessQuestion?.options ?? [];
const asStrings = (value: Answers[string] | undefined): string[] | null =>
  Array.isArray(value) && value.length > 0 ? value : null;

export function Component() {
  usePageTitle('licensing');
  const copy = content.licensing;
  const panel = copy.requirementsPanel;
  const { site } = content;
  const { badges } = site.ui;
  const [params, setParams] = useSearchParams();
  const [customer, setCustomer] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const workspace = useMemo(() => loadDiagnostics().data, []);

  const assessment = workspace.assessments.find(
    (candidate) => candidate.id === params.get('assessment'),
  );
  const organization = workspace.organizations.find((o) => o.id === assessment?.organizationId);
  // Answers saved under older questions cannot be read reliably, so the page ignores them and says so.
  const incompatible =
    assessment !== undefined &&
    organization !== undefined &&
    [
      ...answerErrors(content.questions, organization.answers, 'org'),
      ...answerErrors(content.questions, assessment.answers, 'useCase'),
    ].length > 0;
  const answers: Answers | null =
    assessment !== undefined && organization !== undefined && !incompatible
      ? { ...organization.answers, ...assessment.answers }
      : null;

  const accessParam = params.get('access');
  const answeredAccess =
    typeof answers?.accessModel === 'string' && knownAnswer(answers.accessModel)
      ? answers.accessModel
      : null;
  const access = accessOptions.some((option) => option.value === accessParam)
    ? accessParam
    : accessParam === 'any'
      ? null
      : answeredAccess;
  const accessLabel = accessOptions.find((option) => option.value === access)?.label ?? null;
  const audience = asStrings(answers?.audience);
  const basePlan = typeof answers?.basePlan === 'string' ? answers.basePlan : null;
  const customerSegment = segmentFor(content, basePlan);

  const update = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === '') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true, preventScrollReset: true, flushSync: true },
    );

  const views = populationViews(content, { access, audience });
  const baseline = baselineRequirements(content, answers);
  const requirementViews = capabilityRequirements(content, answers);
  const groups = byProductArea(content, requirementViews);
  const differing = content.capabilities.filter(sourcesDiffer);
  const note = handoffText(content, { customer, access, accessLabel, audience });

  const copyNote = async () => {
    try {
      await navigator.clipboard.writeText(note);
      setCopiedText(note);
    } catch {
      setCopiedText(null);
    }
  };

  const itemLine = (view: RequirementItemView) => (
    <RequirementLine key={view.item.id} view={view} showStatus={answers !== null} />
  );

  const capabilityColumns: Column<CapabilityRequirementView>[] = [
    {
      key: 'capability',
      header: site.capabilities.columns.capability,
      rowHeader: true,
      render: (view) => (
        <>
          <Link to={`/capabilities/${view.capability.id}`}>{view.capability.shortName}</Link>
          <br />
          <Badge tone={licensingTier(view.capability) === 'foundational' ? 'outline' : 'info'}>
            {licensingTier(view.capability) === 'foundational'
              ? badges.foundational
              : badges.premium}
          </Badge>
        </>
      ),
    },
    {
      key: 'needs',
      header: panel.heading,
      render: (view) =>
        view.items.length === 0 && view.without.length === 0 ? (
          <span className={styles.muted}>{panel.noneStated}</span>
        ) : (
          <ul className={styles.items}>
            {view.items.map(itemLine)}
            {view.without.map((entry) => (
              <li key={entry.id}>
                <strong>{panel.kinds.license}.</strong> {entry.text}
                <SourceNote
                  sourceIds={entry.sourceIds}
                  evidence={entry.evidence}
                  lastVerified={entry.lastVerified}
                />
              </li>
            ))}
          </ul>
        ),
    },
  ];

  const baselineCounts = summarizeStatuses(baseline);
  const jump: [string, string][] = [
    ['who', copy.who.heading],
    ['calculator', copy.calculator.heading],
    ['plans', copy.options.heading],
    ['tiers', copy.tiers.heading],
    ['requirements', panel.heading],
    ['sizing', copy.sizing.heading],
    ['regulated', copy.regulated.heading],
    ['other', copy.other.heading],
    ['help', copy.help.heading],
    ['handoff', copy.handoff.heading],
  ];

  return (
    <PageContainer>
      <PageHeading>{site.routes.licensing.title}</PageHeading>
      <PageIntro
        notice={
          <p>
            <ReviewBadge reviewStatus={copy.reviewStatus} /> {copy.notice}
          </p>
        }
      >
        {copy.intro}
      </PageIntro>
      <nav aria-label={copy.jumpLabel}>
        <ul className={styles.jump}>
          {jump.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`}>{label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <section id="who" aria-labelledby="who-heading" className={styles.section}>
        <h2 id="who-heading">{copy.who.heading}</h2>
        <p>{copy.who.intro}</p>
        <div className={styles.controls}>
          <AssessmentPicker
            workspace={workspace}
            id="licensing-assessment"
            label={panel.assessmentLabel}
            none={panel.noAssessment}
            value={assessment?.id ?? ''}
            onChange={(value) => update('assessment', value)}
          />
          <div className={styles.field}>
            <label htmlFor="licensing-access">{copy.who.accessLabel}</label>
            <select
              id="licensing-access"
              value={access ?? 'any'}
              onChange={(event) => update('access', event.target.value)}
            >
              <option value="any">{copy.who.anyAccess}</option>
              {accessOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {assessment !== undefined && incompatible && (
          <p role="note">
            {site.diagnostic.incompatible}{' '}
            <Link to={`/diagnostic/${assessment.id}`}>{site.ui.customer.edit}</Link>
          </p>
        )}
        <ul className={styles.populations}>
          {views.map(({ population, relevant }) => (
            <li
              key={population.id}
              className={
                relevant === false ? `${styles.population} ${styles.dim}` : styles.population
              }
            >
              <h3>{population.label}</h3>
              <p>
                <Badge tone={NEED_TONE[population.need]}>{copy.needs[population.need]}</Badge>{' '}
                {relevant === true && access !== null && (
                  <Badge tone="outline">{copy.who.appliesToYou}</Badge>
                )}
                {relevant === false && <Badge tone="neutral">{copy.who.notApplicable}</Badge>}
              </p>
              <p>{population.statement}</p>
              {population.confirm !== undefined && (
                <p className={styles.confirm}>
                  <strong>{copy.who.confirmLabel}:</strong> {population.confirm}
                </p>
              )}
              <SourceNote
                sourceIds={population.sourceIds}
                evidence={population.evidence}
                lastVerified={population.lastVerified}
              />
            </li>
          ))}
        </ul>
        <h3>{copy.who.principlesHeading}</h3>
        <ul className={styles.statements}>
          {copy.who.principles.map((principle) => (
            <li key={principle.id}>
              <p>{principle.text}</p>
              <SourceNote
                sourceIds={principle.sourceIds}
                evidence={principle.evidence}
                lastVerified={principle.lastVerified}
              />
            </li>
          ))}
        </ul>
      </section>

      <SeatCalculator />

      <section id="plans" aria-labelledby="plans-heading" className={styles.section}>
        <h2 id="plans-heading">{copy.options.heading}</h2>
        <p>{copy.options.intro}</p>
        <ul className={styles.plain}>
          {copy.options.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{copy.options.note}</p>
        <SourceNote
          sourceIds={copy.options.sourceIds}
          evidence={copy.options.evidence}
          lastVerified={copy.options.lastVerified}
        />
        <h3>{copy.prerequisites.heading}</h3>
        <p>{copy.prerequisites.intro}</p>
        <ul className={styles.populations}>
          {copy.prerequisites.segments.map((segment) => (
            <li
              key={segment.id}
              className={
                segment.id === customerSegment?.id
                  ? `${styles.population} ${styles.mine}`
                  : styles.population
              }
            >
              <h4>
                {segment.label}{' '}
                {segment.id === customerSegment?.id && (
                  <Badge tone="info">{copy.who.appliesToYou}</Badge>
                )}
              </h4>
              <p>{segment.requires}</p>
              <SourceNote
                sourceIds={segment.sourceIds}
                evidence={segment.evidence}
                lastVerified={segment.lastVerified}
              />
            </li>
          ))}
        </ul>
        <h4>{copy.prerequisites.mixedHeading}</h4>
        <p>{copy.prerequisites.mixed.text}</p>
        <SourceNote
          sourceIds={copy.prerequisites.mixed.sourceIds}
          evidence={copy.prerequisites.mixed.evidence}
          lastVerified={copy.prerequisites.mixed.lastVerified}
        />
        <h4>{copy.prerequisites.productTerms.heading}</h4>
        <p>{copy.prerequisites.productTerms.intro}</p>
        <ul className={styles.plain}>
          {copy.prerequisites.productTerms.plans.map((plan) => (
            <li key={plan}>{plan}</li>
          ))}
        </ul>
        <p>{copy.prerequisites.productTerms.availability}</p>
        <SourceNote
          sourceIds={copy.prerequisites.productTerms.sourceIds}
          evidence={copy.prerequisites.productTerms.evidence}
          lastVerified={copy.prerequisites.productTerms.lastVerified}
        />
        <h4>{copy.prerequisites.differs.heading}</h4>
        <p>{copy.prerequisites.differs.intro}</p>
        <ul className={styles.statements}>
          {copy.prerequisites.differs.items.map((entry) => (
            <li key={entry.id}>
              <p>
                <strong>{entry.topic}</strong>
              </p>
              <dl className={styles.said}>
                {entry.statements.map((statement) => (
                  <div key={statement.sourceId}>
                    <dt>{sourceById(statement.sourceId)?.title ?? statement.sourceId}</dt>
                    <dd>{statement.text}</dd>
                  </div>
                ))}
              </dl>
              <p>{entry.advice}</p>
              <SourceNote
                sourceIds={entry.sourceIds}
                evidence={entry.evidence}
                lastVerified={entry.lastVerified}
              />
            </li>
          ))}
        </ul>
        <h4>{copy.prerequisites.withoutHeading}</h4>
        <p>{copy.prerequisites.withoutIntro}</p>
        <ul className={styles.statements}>
          {copy.prerequisites.without.map((entry) => (
            <li key={entry.id}>
              <p>
                <strong>{entry.area}.</strong> {entry.text}
              </p>
              <SourceNote
                sourceIds={entry.sourceIds}
                evidence={entry.evidence}
                lastVerified={entry.lastVerified}
              />
            </li>
          ))}
        </ul>
        <p>{copy.prerequisites.contracts.text}</p>
        <SourceNote
          sourceIds={copy.prerequisites.contracts.sourceIds}
          evidence={copy.prerequisites.contracts.evidence}
          lastVerified={copy.prerequisites.contracts.lastVerified}
        />
      </section>

      <section id="tiers" aria-labelledby="tiers-heading" className={styles.section}>
        <h2 id="tiers-heading">{copy.tiers.heading}</h2>
        <p>{copy.tiers.intro}</p>
        <div className={styles.columns}>
          <div>
            <h3>{copy.tiers.foundationalLabel}</h3>
            <ul className={styles.plain}>
              {copy.tiers.foundational.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>{copy.tiers.premiumLabel}</h3>
            {copy.tiers.premium.map((group) => (
              <div key={group.group}>
                <h4>{group.group}</h4>
                <ul className={styles.plain}>
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <p className={styles.muted}>{copy.tiers.note}</p>
        <SourceNote
          sourceIds={copy.tiers.sourceIds}
          evidence={copy.tiers.evidence}
          lastVerified={copy.tiers.lastVerified}
        />
        <h3>{copy.tiers.differsHeading}</h3>
        <p>{copy.tiers.differsIntro}</p>
        <ul className={styles.plain}>
          {differing.map((capability) => (
            <li key={capability.id}>
              <Link to={`/capabilities/${capability.id}`}>{capability.shortName}</Link>
              {': '}
              {(capability.sourceNotes ?? [])
                .filter((entry) => entry.differs === true)
                .map((entry) => entry.note)
                .join(' ')}
            </li>
          ))}
        </ul>
      </section>

      <section id="requirements" aria-labelledby="requirements-heading" className={styles.section}>
        <h2 id="requirements-heading">{panel.heading}</h2>
        <p>{panel.intro}</p>
        {answers !== null && (
          <p className={styles.muted}>
            {renderTemplate(content.guardrails.summary, {
              ready: baselineCounts.ready,
              gap: baselineCounts.gap,
              unknown: baselineCounts.unknown,
            })}
          </p>
        )}
        <ul className={styles.statements}>{baseline.map(itemLine)}</ul>
        {groups.map((group) => (
          <div key={group.console.id} className={styles.area}>
            <h3>{group.console.displayName}</h3>
            <DataTable
              caption={group.console.displayName}
              hideCaption
              scrollLabel={renderTemplate(site.readout.tableLabel, {
                label: group.console.displayName,
              })}
              columns={capabilityColumns}
              rows={group.views}
              rowKey={(view) => view.capability.id}
            />
          </div>
        ))}
      </section>

      <section id="sizing" aria-labelledby="sizing-heading" className={styles.section}>
        <h2 id="sizing-heading">{copy.sizing.heading}</h2>
        <p>{copy.sizing.intro}</p>
        <ul className={styles.populations}>
          {copy.sizing.reports.map((report) => (
            <li key={report.id} className={styles.population}>
              <h3>{report.name}</h3>
              <p>
                <strong>{copy.sizing.heading}:</strong> {report.where}
              </p>
              <p>{report.shows}</p>
              <SourceNote
                sourceIds={report.sourceIds}
                evidence={report.evidence}
                lastVerified={report.lastVerified}
              />
            </li>
          ))}
        </ul>
        <p className={styles.muted}>{copy.sizing.note}</p>
      </section>

      <section id="regulated" aria-labelledby="regulated-heading" className={styles.section}>
        <h2 id="regulated-heading">{copy.regulated.heading}</h2>
        <p>{copy.regulated.intro}</p>
        <ul className={styles.statements}>
          {copy.regulated.items.map((entry) => (
            <li key={entry.id}>
              <p>{entry.text}</p>
              <SourceNote
                sourceIds={entry.sourceIds}
                evidence={entry.evidence}
                lastVerified={entry.lastVerified}
              />
            </li>
          ))}
        </ul>
      </section>

      <section id="other" aria-labelledby="other-heading" className={styles.section}>
        <h2 id="other-heading">{copy.other.heading}</h2>
        <ul className={styles.statements}>
          {copy.other.items.map((entry) => (
            <li key={entry.id}>
              <p>{entry.text}</p>
              <SourceNote
                sourceIds={entry.sourceIds}
                evidence={entry.evidence}
                lastVerified={entry.lastVerified}
              />
            </li>
          ))}
        </ul>
      </section>

      <section id="help" aria-labelledby="help-heading" className={styles.section}>
        <h2 id="help-heading">{copy.help.heading}</h2>
        <p>{copy.help.intro}</p>
        <ul className={styles.statements}>
          {copy.help.items.map((entry) => (
            <li key={entry.id}>
              <p>{entry.text}</p>
              <SourceNote
                sourceIds={entry.sourceIds}
                evidence={entry.evidence}
                lastVerified={entry.lastVerified}
              />
            </li>
          ))}
        </ul>
      </section>

      <section id="handoff" aria-labelledby="handoff-heading" className={styles.section}>
        <h2 id="handoff-heading">{copy.handoff.heading}</h2>
        <p>{copy.handoff.intro}</p>
        <ol className={styles.plain}>
          {copy.handoff.questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ol>
        <div className={styles.field}>
          <label htmlFor="licensing-customer">{content.value.brief.customerLabel}</label>
          <input
            id="licensing-customer"
            type="text"
            value={customer}
            maxLength={120}
            autoComplete="off"
            onChange={(event) => setCustomer(event.target.value)}
          />
        </div>
        <p className={styles.actions}>
          <button type="button" onClick={copyNote}>
            {copy.handoff.copy}
          </button>
          <span role="status">{copiedText === note ? copy.handoff.copied : ''}</span>
        </p>
      </section>
    </PageContainer>
  );
}
