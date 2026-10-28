import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AssessmentPicker } from '../../components/AssessmentPicker.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { PageIntro } from '../../components/PageIntro.tsx';
import { ReviewBadge } from '../../components/VerifiedBadge.tsx';
import { content, contentMeta } from '../../lib/content/index.ts';
import type { Answers } from '../../lib/content/schemas.ts';
import { answerErrors, knownAnswer } from '../../lib/engine/answers.ts';
import { buildPassport } from '../../lib/engine/passport.ts';
import { standingAssumptions } from '../../lib/state/assumptions.ts';
import { displayName, type DiagnosticWorkspace } from '../../lib/state/diagnostic-model.ts';
import { useDiagnostics } from '../../lib/state/diagnostics.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { AccessHelper } from './AccessHelper.tsx';
import { PassportQuestion } from './PassportQuestion.tsx';
import { PassportResult } from './PassportResult.tsx';
import styles from './PassportPage.module.css';

const NEW_CUSTOMER = 'new';
// What a new passport assumes until the seller says otherwise. The stage is marked as assumed; the cloud shows a hint.
const DEFAULT_CLOUD = 'commercial';
const STAGE_PILOT = 'pilot';
const STAGE_PRODUCTION = 'production';
const PRODUCTION_STAGES: readonly string[] = [STAGE_PRODUCTION, 'scaling'];

const cloudQuestion = content.questions.find((question) => question.id === 'cloudEnvironment')!;
const agentNameQuestion = content.questions.find((question) => question.id === 'useCaseName')!;
const customerNameQuestion = content.questions.find((question) => question.id === 'orgName')!;
const typed = (answer: Answers[string] | undefined) =>
  typeof answer === 'string' && knownAnswer(answer) ? answer : '';

type Edit = (
  draft: DiagnosticWorkspace,
  ids: { organizationId: string; assessmentId: string },
) => void;

export function Component() {
  usePageTitle('map');
  const store = useDiagnostics();
  const { site, passport: copy } = content;
  const [params, setParams] = useSearchParams();
  const [choice, setChoice] = useState(NEW_CUSTOMER);
  const [newName, setNewName] = useState('');
  const created = useRef<{ organizationId: string; assessmentId: string } | null>(null);
  const workspace = store.data;

  const requestedId = params.get('assessment');
  const assessment = workspace.assessments.find((candidate) => candidate.id === requestedId);
  const organization = workspace.organizations.find((o) => o.id === assessment?.organizationId);
  const saved = assessment !== undefined && organization !== undefined;
  const customers = [...workspace.organizations].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const chosen = choice === NEW_CUSTOMER ? undefined : customers.find((o) => o.id === choice);

  // The first change creates the customer, when it is new, and the agent. Every later change edits them. The
  // ids are kept in a ref as well as in the address, so a change that arrives before the address has updated
  // edits the agent just created instead of creating another.
  const write = (edit: Edit, nameForNewCustomer = newName) => {
    const now = new Date().toISOString();
    const target = saved
      ? { organizationId: organization.id, assessmentId: assessment.id }
      : created.current !== null &&
          (requestedId === null || requestedId === created.current.assessmentId)
        ? created.current
        : null;
    if (target !== null) {
      store.change((draft) => {
        edit(draft, target);
        const entity = draft.assessments.find((a) => a.id === target.assessmentId)!;
        entity.updatedAt = now;
        entity.contentVersion = contentMeta.contentVersion;
      });
      return;
    }
    const organizationId = chosen?.id ?? crypto.randomUUID();
    const assessmentId = crypto.randomUUID();
    const name = nameForNewCustomer.trim();
    created.current = { organizationId, assessmentId };
    store.change((draft) => {
      if (chosen === undefined)
        draft.organizations.push({
          id: organizationId,
          answers: { ...(name === '' ? {} : { orgName: name }), cloudEnvironment: DEFAULT_CLOUD },
          contentVersion: contentMeta.contentVersion,
          createdAt: now,
          updatedAt: now,
        });
      draft.assessments.push({
        id: assessmentId,
        organizationId,
        answers: { stage: STAGE_PILOT },
        mode: 'quick',
        sectionId: 'profile',
        patternId: null,
        sampleId: null,
        assumedQuestionIds: ['stage'],
        contentVersion: contentMeta.contentVersion,
        createdAt: now,
        updatedAt: now,
      });
      edit(draft, { organizationId, assessmentId });
    });
    setParams({ assessment: assessmentId }, { replace: true, preventScrollReset: true });
  };

  const setAnswer = (id: string, value: Answers[string]) =>
    write((draft, ids) => {
      const entity = draft.assessments.find((a) => a.id === ids.assessmentId)!;
      entity.answers[id] = value;
      const remaining = (entity.assumedQuestionIds ?? []).filter((item) => item !== id);
      if (remaining.length > 0) entity.assumedQuestionIds = remaining;
      else delete entity.assumedQuestionIds;
    });
  const setOrganizationAnswer = (id: string, value: Answers[string]) =>
    write((draft, ids) => {
      const entity = draft.organizations.find((o) => o.id === ids.organizationId)!;
      entity.answers[id] = value;
      entity.updatedAt = new Date().toISOString();
      entity.contentVersion = contentMeta.contentVersion;
    });
  const setCustomerName = (value: string) => {
    if (saved) setOrganizationAnswer('orgName', value.trim() === '' ? null : value);
    else setNewName(value);
  };

  const orgAnswers = organization?.answers ?? {};
  const useCase = assessment?.answers ?? {};
  const customerName = displayName(orgAnswers, 'orgName', site.diagnostic.untitledOrganization);
  const agentName = displayName(useCase, 'useCaseName', copy.result.untitledAgent);
  const cloud = saved
    ? typed(orgAnswers.cloudEnvironment)
    : chosen
      ? typed(chosen.answers.cloudEnvironment)
      : DEFAULT_CLOUD;
  const stage = typed(useCase.stage);
  const goingToProduction = PRODUCTION_STAGES.includes(stage);
  const stageAssumed = saved && standingAssumptions(assessment).includes('stage');

  const incompatible =
    saved &&
    [
      ...answerErrors(content.questions, organization.answers, 'org'),
      ...answerErrors(content.questions, assessment.answers, 'useCase'),
    ].length > 0;
  const passport =
    saved && !incompatible
      ? buildPassport(
          content,
          { org: organization.answers, useCase: assessment.answers },
          contentMeta.contentVersion,
        )
      : null;

  const openSaved = (id: string) => {
    created.current = null;
    setParams(id === '' ? {} : { assessment: id }, { replace: true });
  };

  return (
    <PageContainer>
      <PageHeading>{site.routes.map.title}</PageHeading>
      <PageIntro
        notice={
          <p>
            <ReviewBadge reviewStatus={copy.reviewStatus} /> {copy.notice}
          </p>
        }
      >
        {copy.intro}
      </PageIntro>

      <section aria-labelledby="setup-heading" className={styles.section}>
        <h2 id="setup-heading">{copy.setup.heading}</h2>
        {workspace.assessments.length > 0 && (
          <AssessmentPicker
            workspace={workspace}
            id="passport-open"
            label={copy.setup.openLabel}
            none={copy.setup.openNone}
            value={saved ? assessment.id : ''}
            onChange={openSaved}
          />
        )}
        {requestedId !== null && assessment === undefined && (
          <p role="alert" className={styles.missing}>
            {copy.setup.missing}
          </p>
        )}
        {incompatible && (
          <p role="alert" className={styles.missing}>
            {copy.setup.incompatible}{' '}
            <Link to={`/diagnostic/${assessment.id}`}>{site.routes.diagnostic.title}</Link>
          </p>
        )}
        <div className={styles.fields}>
          {!saved && customers.length > 0 && (
            <div className={styles.field}>
              <label htmlFor="passport-customer">{copy.setup.customerLabel}</label>
              <select
                id="passport-customer"
                value={chosen?.id ?? NEW_CUSTOMER}
                onChange={(event) => setChoice(event.target.value)}
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {displayName(customer.answers, 'orgName', site.diagnostic.untitledOrganization)}
                  </option>
                ))}
                <option value={NEW_CUSTOMER}>{copy.setup.newCustomer}</option>
              </select>
            </div>
          )}
          {(saved || chosen === undefined) && (
            <div className={styles.field}>
              <label htmlFor="passport-customer-name">{copy.setup.customerNameLabel}</label>
              <input
                id="passport-customer-name"
                type="text"
                autoComplete="off"
                maxLength={customerNameQuestion.maxLength}
                value={saved ? typed(orgAnswers.orgName) : newName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </div>
          )}
          <div className={styles.field}>
            <label htmlFor="passport-agent-name">{copy.setup.agentLabel}</label>
            <input
              id="passport-agent-name"
              type="text"
              autoComplete="off"
              maxLength={agentNameQuestion.maxLength}
              value={typed(useCase.useCaseName)}
              onChange={(event) =>
                setAnswer(
                  'useCaseName',
                  event.target.value.trim() === '' ? null : event.target.value,
                )
              }
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="passport-cloud">{copy.setup.cloudLabel}</label>
            <select
              id="passport-cloud"
              value={cloud}
              aria-describedby="passport-cloud-hint"
              onChange={(event) =>
                setOrganizationAnswer('cloudEnvironment', event.target.value || null)
              }
            >
              <option value="">{site.diagnostic.unknown}</option>
              {cloudQuestion.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p id="passport-cloud-hint" className={styles.hint}>
              {copy.setup.cloudHint}
            </p>
          </div>
          <div className={styles.field}>
            <label className={styles.choice}>
              <input
                type="checkbox"
                checked={goingToProduction}
                aria-describedby="passport-stage-hint"
                onChange={(event) =>
                  setAnswer('stage', event.target.checked ? STAGE_PRODUCTION : STAGE_PILOT)
                }
              />
              {copy.setup.stageLabel}
            </label>
            <p id="passport-stage-hint" className={styles.hint}>
              {copy.setup.stageHint}
              {stageAssumed && <> {copy.setup.stageAssumed}</>}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="questions-heading" className={styles.section}>
        <h2 id="questions-heading">{copy.questionsHeading}</h2>
        <ol className={styles.questions}>
          {copy.questions.map((question, index) => (
            <PassportQuestion
              key={question.id}
              number={index + 1}
              id={question.id}
              ask={question.ask}
              hint={question.hint}
              answer={useCase[question.id]}
              onChange={(value) => setAnswer(question.id, value)}
            >
              {question.id === 'accessModel' && (
                <AccessHelper onUse={(answer) => setAnswer('accessModel', answer)} />
              )}
            </PassportQuestion>
          ))}
        </ol>
      </section>

      {passport !== null && saved && (
        <PassportResult
          passport={passport}
          assessmentId={assessment.id}
          customer={customerName}
          agent={agentName}
          sample={organization.sample === true}
        />
      )}
    </PageContainer>
  );
}
