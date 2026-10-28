import { Link, useSearchParams } from 'react-router';
import { AssessmentPicker } from '../../components/AssessmentPicker.tsx';
import { Badge, type BadgeTone } from '../../components/Badge.tsx';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { SourceNote } from '../../components/SourceNote.tsx';
import { SampleChip } from '../../components/SampleChip.tsx';
import { ReviewBadge } from '../../components/VerifiedBadge.tsx';
import { content, contentMeta } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { answerErrors } from '../../lib/engine/answers.ts';
import { buildDeploy, type DeployPeriod, type DeployStep } from '../../lib/engine/deploy.ts';
import type { GuardrailStatus } from '../../lib/engine/guardrails.ts';
import { displayName } from '../../lib/state/diagnostic-model.ts';
import { useDiagnostics } from '../../lib/state/diagnostics.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './DeployPage.module.css';

const STATUS_TONE: Record<GuardrailStatus, BadgeTone> = {
  ready: 'info',
  gap: 'amber',
  unknown: 'neutral',
};

function Step({ step }: { step: DeployStep }) {
  const copy = content.deploy.baseline;
  const { guardrails } = content;
  const { item, status, applies } = step.view;
  return (
    <li className={styles.step}>
      <h4>{item.title}</h4>
      <p className={styles.badges}>
        <Badge tone={STATUS_TONE[status]}>{guardrails.statusLabels[status]}</Badge>
        {applies === null && <Badge tone="outline">{copy.applies}</Badge>}
      </p>
      <dl className={styles.facts}>
        <div>
          <dt>{copy.whyLabel}</dt>
          <dd>{item.why}</dd>
        </div>
        <div>
          <dt>{copy.doLabel}</dt>
          <dd>{item.action}</dd>
        </div>
        <div>
          <dt>{copy.proveLabel}</dt>
          <dd className={styles.prove}>{item.proveIt}</dd>
        </div>
        {step.consoles.length > 0 && (
          <div>
            <dt>{copy.whereLabel}</dt>
            <dd>{step.consoles.map((console_) => console_.displayName).join(', ')}</dd>
          </div>
        )}
        {step.ownerTeams.length > 0 && (
          <div>
            <dt>{copy.ownerLabel}</dt>
            <dd>{step.ownerTeams.join(', ')}</dd>
          </div>
        )}
        {step.capabilities.length > 0 && (
          <div>
            <dt>{guardrails.capabilitiesLabel}</dt>
            <dd>
              <ul className={styles.links}>
                {step.capabilities.map((capability) => (
                  <li key={capability.id}>
                    <Link to={`/capabilities/${capability.id}`}>{capability.shortName}</Link>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
      <SourceNote sourceIds={item.sourceIds} evidence={item.evidence} lastVerified={null} />
    </li>
  );
}

export function Component() {
  usePageTitle('deploy');
  const store = useDiagnostics();
  const [params, setParams] = useSearchParams();
  const { site, deploy: copy, guardrails } = content;
  const workspace = store.data;

  const requestedId = params.get('assessment');
  const assessment = workspace.assessments.find((candidate) => candidate.id === requestedId);
  const organization = workspace.organizations.find((o) => o.id === assessment?.organizationId);
  const saved = assessment !== undefined && organization !== undefined;
  const incompatible =
    saved &&
    [
      ...answerErrors(content.questions, organization.answers, 'org'),
      ...answerErrors(content.questions, assessment.answers, 'useCase'),
    ].length > 0;
  const deploy = buildDeploy(
    content,
    saved && !incompatible ? { org: organization.answers, useCase: assessment.answers } : null,
    contentMeta.contentVersion,
  );
  const label = saved
    ? `${displayName(organization.answers, 'orgName', site.diagnostic.untitledOrganization)} — ${displayName(assessment.answers, 'useCaseName', site.diagnostic.untitledAssessment)}`
    : null;

  const planColumns: Column<DeployPeriod>[] = [
    {
      key: 'period',
      header: copy.plan.columns.period,
      rowHeader: true,
      render: ({ period }) => (
        <>
          <strong>{period.title}</strong>
          <br />
          {period.summary}
        </>
      ),
    },
    {
      key: 'steps',
      header: copy.plan.columns.steps,
      render: ({ steps }) =>
        steps.length === 0 ? (
          copy.plan.none
        ) : (
          <ul className={styles.plain}>
            {steps.map(({ view }) => (
              <li key={view.item.id}>
                {guardrails.statusLabels[view.status]}: {view.item.title}
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: 'controls',
      header: copy.plan.columns.controls,
      render: ({ controls }) =>
        controls.length === 0 ? (
          copy.plan.none
        ) : (
          <ul className={styles.plain}>
            {controls.map((entry) => (
              <li key={entry.capability.id}>
                <Link to={`/capabilities/${entry.capability.id}`}>
                  {entry.capability.shortName}
                </Link>
              </li>
            ))}
          </ul>
        ),
    },
  ];

  const jump: [string, string][] = [
    ['baseline', copy.baseline.heading],
    ['plan', copy.plan.heading],
    ['next', copy.next.heading],
  ];

  return (
    <PageContainer>
      <PageHeading>{site.routes.deploy.title}</PageHeading>
      <p className={styles.intro}>{copy.intro}</p>
      <p className={styles.notice}>
        <ReviewBadge reviewStatus={copy.reviewStatus} /> {copy.notice}
      </p>
      <nav aria-label={copy.jumpLabel}>
        <ul className={styles.jump}>
          {jump.map(([id, text]) => (
            <li key={id}>
              <a href={`#${id}`}>{text}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.field}>
        <AssessmentPicker
          workspace={workspace}
          id="deploy-assessment"
          label={copy.assessmentLabel}
          none={copy.noAssessment}
          value={saved ? assessment.id : ''}
          onChange={(id) => setParams(id === '' ? {} : { assessment: id }, { replace: true })}
        />
      </div>
      {requestedId !== null && assessment === undefined && (
        <p role="alert" className={styles.missing}>
          {copy.missing}
        </p>
      )}
      {incompatible && (
        <p role="alert" className={styles.missing}>
          {copy.incompatible}{' '}
          <Link to={`/diagnostic/${assessment.id}`}>{site.routes.diagnostic.title}</Link>
        </p>
      )}
      {label === null && <p className={styles.muted}>{copy.noAssessmentNote}</p>}

      <section id="baseline" aria-labelledby="baseline-heading" className={styles.section}>
        <h2 id="baseline-heading">{copy.baseline.heading}</h2>
        <p>{copy.baseline.intro}</p>
        {label !== null && (
          <p className={styles.muted}>
            {label}: {renderTemplate(guardrails.summary, deploy.counts)}{' '}
            {organization?.sample === true && <SampleChip />}
          </p>
        )}
        {deploy.gates.map(({ gate, steps }) => (
          <div key={gate.id} className={styles.gate}>
            <h3>{gate.title}</h3>
            <p className={styles.muted}>{gate.summary}</p>
            {steps.length === 0 ? (
              <p>{guardrails.empty}</p>
            ) : (
              <ul className={styles.steps}>
                {steps.map((step) => (
                  <Step key={step.view.item.id} step={step} />
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      <section id="plan" aria-labelledby="plan-heading" className={styles.section}>
        <h2 id="plan-heading">{copy.plan.heading}</h2>
        <p>{copy.plan.intro}</p>
        <DataTable
          caption={copy.plan.tableLabel}
          hideCaption
          scrollLabel={copy.plan.tableLabel}
          columns={planColumns}
          rows={deploy.periods}
          rowKey={(row) => row.period.id}
        />
      </section>

      <section id="next" aria-labelledby="next-heading" className={styles.section}>
        <h2 id="next-heading">{copy.next.heading}</h2>
        <ul className={styles.links}>
          {copy.next.items.map((item) => (
            <li key={item.to}>
              <Link
                to={
                  saved
                    ? `${item.to}${item.to === '/licensing' ? `?assessment=${assessment.id}` : ''}`
                    : item.to
                }
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
