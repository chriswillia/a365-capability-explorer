import { useState } from 'react';
import { Link } from 'react-router';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { KpiStrip } from '../../components/KpiStrip.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { PresentationControls } from '../../components/PresentationControls.tsx';
import { content, contentMeta } from '../../lib/content/index.ts';
import { computePortfolioMetrics } from '../../lib/content/metrics.ts';
import { formatNumber, renderTemplate } from '../../lib/content/template.ts';
import { answerLabel } from '../../lib/readout/report.ts';
import {
  buildPortfolio,
  portfolioLevel,
  type Portfolio,
  type PortfolioCase,
  type PortfolioCapability,
} from '../../lib/portfolio/portfolio.ts';
import { displayName } from '../../lib/state/diagnostic-model.ts';
import { useDiagnostics } from '../../lib/state/diagnostics.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { DiagnosticTransfer } from '../diagnostic/DiagnosticTransfer.tsx';
import { Evidence } from '../mapping/Evidence.tsx';
import { PortfolioChart } from './PortfolioChart.tsx';
import styles from './Portfolio.module.css';

const copy = content.site.portfolio;
const mapping = content.site.mapping;
const nameColumn: Column<PortfolioCase> = {
  key: 'name',
  header: content.site.diagnostic.assessments,
  rowHeader: true,
  render: (item) => <Link to={`/diagnostic/${item.assessment.id}/readout`}>{item.name}</Link>,
};
const caseLinks = (items: PortfolioCase[]) =>
  items.length === 0 ? (
    mapping.unknownAnswer
  ) : (
    <ul>
      {items.map((item) => (
        <li key={item.assessment.id}>
          <Link to={`/diagnostic/${item.assessment.id}/readout`}>{item.name}</Link>
        </li>
      ))}
    </ul>
  );
const capabilityColumn: Column<PortfolioCapability> = {
  key: 'capability',
  header: content.site.capabilities.columns.capability,
  rowHeader: true,
  render: ({ capability }) => (
    <Link to={`/capabilities/${capability.id}`}>{capability.shortName}</Link>
  ),
};

function PortfolioResults({ portfolio }: { portfolio: Portfolio }) {
  const metrics = computePortfolioMetrics(portfolio);
  const cases = portfolio.cases;
  const columns: Column<PortfolioCase>[] = [
    { key: 'number', header: copy.index, render: (item) => item.number },
    nameColumn,
    {
      key: 'value',
      header: content.questions.find((q) => q.id === 'businessValue')!.label,
      render: (item) => answerLabel(content, item.assessment.answers, 'businessValue'),
    },
    {
      key: 'intensity',
      header: mapping.intensity,
      render: (item) => `${item.result.intensity.overall}%`,
    },
    {
      key: 'users',
      header: mapping.expectedUsers,
      render: (item) => answerLabel(content, item.assessment.answers, 'expectedUsers'),
    },
    {
      key: 'quadrant',
      header: copy.quadrant,
      render: (item) => (item.quadrant === null ? copy.unplotted : copy.quadrants[item.quadrant]),
    },
    {
      key: 'ready',
      header: mapping.readinessPercent,
      render: (item) =>
        item.result.readiness.percent === null
          ? mapping.unknownAnswer
          : `${item.result.readiness.percent}%`,
    },
  ];
  return (
    <>
      <KpiStrip
        items={[
          { id: 'selected', label: copy.selected, value: formatNumber(metrics.selected) },
          { id: 'evaluated', label: copy.evaluated, value: formatNumber(metrics.evaluated) },
          {
            id: 'foundations',
            label: copy.foundationsCount,
            value: formatNumber(metrics.sharedFoundations),
          },
          { id: 'gaps', label: copy.gapsCount, value: formatNumber(metrics.gaps) },
        ]}
      />
      {portfolio.blocked.length > 0 && (
        <section>
          <h2>{copy.incompatible}</h2>
          <p>{copy.excluded}</p>
          <ul>
            {portfolio.blocked.map(({ assessment, name, errors }) => (
              <li key={assessment.id}>
                <Link to={`/diagnostic/${assessment.id}`}>{name}</Link>
                <ul>
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
      {cases.length > 0 && (
        <>
          <section>
            <h2>{copy.chart}</h2>
            <p>
              {renderTemplate(copy.chartNote, { count: copy.valueCutoff, n: copy.intensityCutoff })}
            </p>
            <p>{mapping.intensityNote}</p>
            <p>{copy.bubbleNote}</p>
            <PortfolioChart cases={cases} />
            <DataTable
              caption={copy.table}
              columns={columns}
              rows={cases}
              rowKey={(item) => item.assessment.id}
              scrollLabel={copy.table}
            />
          </section>
          <section>
            <h2>{copy.matrix}</h2>
            <p>{copy.matrixNote}</p>
            <DataTable
              caption={copy.matrix}
              hideCaption
              scrollLabel={renderTemplate(content.site.readout.tableLabel, { label: copy.matrix })}
              rows={portfolio.capabilities}
              rowKey={({ capability }) => capability.id}
              columns={[
                capabilityColumn,
                ...cases.map((item): Column<PortfolioCapability> => ({
                  key: item.assessment.id,
                  header: item.name,
                  render: (row) => {
                    const level = portfolioLevel(row, item.assessment.id);
                    return level === null ? (
                      <span aria-label={mapping.notInScope}>—</span>
                    ) : (
                      <span className={`${styles.level} ${styles[level]}`}>
                        {mapping.levels[level]}
                      </span>
                    );
                  },
                })),
              ]}
            />
          </section>
          <section>
            <h2>{copy.foundations}</h2>
            <p>{copy.foundationsNote}</p>
            {portfolio.foundations.length === 0 ? (
              <p>{content.site.readout.empty}</p>
            ) : (
              <DataTable
                caption={copy.foundations}
                hideCaption
                scrollLabel={renderTemplate(content.site.readout.tableLabel, {
                  label: copy.foundations,
                })}
                rows={portfolio.foundations}
                rowKey={({ capability }) => capability.id}
                columns={[
                  capabilityColumn,
                  {
                    key: 'owner',
                    header: content.site.capabilities.brief.owner,
                    render: ({ uses }) => uses[0]!.row.ownerTeam,
                  },
                  {
                    key: 'uses',
                    header: copy.selected,
                    render: ({ uses }) => (
                      <>
                        {renderTemplate(copy.benefits, { count: uses.length })}
                        {caseLinks(uses.map((use) => use.useCase))}
                      </>
                    ),
                  },
                  {
                    key: 'setup',
                    header: content.site.readout.agent,
                    render: ({ capability }) =>
                      capability.setup === 'both'
                        ? copy.agentFollowup
                        : content.site.ui.setup.platform,
                  },
                ]}
              />
            )}
          </section>
          <section>
            <h2>{copy.readiness}</h2>
            <p>{copy.readinessNote}</p>
            <p>
              {mapping.readinessPercent}:{' '}
              {metrics.readinessPercent === null
                ? mapping.unknownAnswer
                : `${metrics.readinessPercent}%`}
            </p>
            {portfolio.checks.length === 0 ? (
              <p>{mapping.noChecks}</p>
            ) : (
              <DataTable
                caption={copy.readiness}
                hideCaption
                scrollLabel={renderTemplate(content.site.readout.tableLabel, {
                  label: copy.readiness,
                })}
                rows={portfolio.checks}
                rowKey={(check) => check.id}
                columns={[
                  {
                    key: 'check',
                    header: mapping.readiness,
                    rowHeader: true,
                    render: (check) => check.gap,
                  },
                  {
                    key: 'ready',
                    header: mapping.readinessStatuses.ready,
                    render: (check) => check.ready.length,
                  },
                  {
                    key: 'gap',
                    header: mapping.readinessStatuses.gap,
                    render: (check) => check.gapCases.length,
                  },
                  {
                    key: 'unknown',
                    header: mapping.readinessStatuses.unknown,
                    render: (check) => check.unknown.length,
                  },
                  {
                    key: 'affected',
                    header: copy.affected,
                    render: (check) =>
                      check.gapCases.length + check.unknown.length === 0
                        ? content.site.readout.empty
                        : caseLinks([...check.gapCases, ...check.unknown]),
                  },
                ]}
              />
            )}
            <ul>
              {cases
                .filter((item) => item.result.readiness.uncheckedCapabilities.length > 0)
                .map((item) => (
                  <li key={item.assessment.id}>
                    <Link to={`/diagnostic/${item.assessment.id}/readout`}>{item.name}</Link>:{' '}
                    {mapping.noChecks}{' '}
                    {item.result.readiness.uncheckedCapabilities
                      .map(
                        (id) =>
                          content.capabilities.find((capability) => capability.id === id)!
                            .shortName,
                      )
                      .join('; ')}
                  </li>
                ))}
            </ul>
          </section>
          <section>
            <h2>{copy.licensing}</h2>
            <p>{copy.licensingNote}</p>
            <p>{content.site.readout.eligibility}</p>
            <dl>
              <dt>{copy.uniqueCapabilities}</dt>
              <dd>{metrics.uniqueCapabilities}</dd>
              <dt>{content.site.readout.foundational}</dt>
              <dd>{metrics.foundational}</dd>
              <dt>{content.site.readout.premium}</dt>
              <dd>{metrics.premium}</dd>
            </dl>
            <DataTable
              caption={copy.licensing}
              hideCaption
              scrollLabel={renderTemplate(content.site.readout.tableLabel, {
                label: copy.licensing,
              })}
              rows={cases}
              rowKey={(item) => item.assessment.id}
              columns={[
                nameColumn,
                {
                  key: 'basis',
                  header: mapping.licensing,
                  render: (item) => item.result.licensing.basis ?? mapping.unknownAnswer,
                },
                {
                  key: 'users',
                  header: mapping.expectedUsers,
                  render: (item) => answerLabel(content, item.assessment.answers, 'expectedUsers'),
                },
                {
                  key: 'gcc',
                  header: mapping.gcc,
                  render: (item) =>
                    item.result.sovereignVerification
                      ? mapping.sovereign
                      : item.result.gccGaps.map((row) => row.capability.shortName).join('; ') ||
                        mapping.unknownAnswer,
                },
              ]}
            />
            <Link to="/methodology">{mapping.methodology}</Link>
            {portfolio.capabilities
              .filter(({ capability }) => capability.sourceNotes?.some((note) => note.differs))
              .map(({ capability }) => (
                <div key={capability.id}>
                  <h3>
                    <Link to={`/capabilities/${capability.id}`}>{capability.shortName}</Link>
                  </h3>
                  {capability.sourceNotes
                    ?.filter((note) => note.differs)
                    .map((note) => (
                      <div key={note.sourceId}>
                        <p>
                          <strong>{content.site.capabilities.sourcesDifferNote}</strong> {note.note}
                        </p>
                        <Evidence
                          sourceIds={[note.sourceId]}
                          evidence="stated"
                          reviewStatus={capability.reviewStatus}
                        />
                      </div>
                    ))}
                </div>
              ))}
            <Evidence
              sourceIds={content.mappingConfig.licensingSourceIds}
              evidence="judgment"
              reviewStatus="draft"
            />
          </section>
        </>
      )}
    </>
  );
}

export function Component() {
  usePageTitle('portfolio');
  const store = useDiagnostics();
  const [organizationId, setOrganizationId] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const organization =
    store.data.organizations.find((item) => item.id === organizationId) ??
    store.data.organizations[0];
  const assessments = store.data.assessments.filter(
    (item) => item.organizationId === organization?.id,
  );
  const ids = assessments.filter((item) => !excluded.has(item.id)).map((item) => item.id);
  const portfolio = organization
    ? buildPortfolio(content, store.data, contentMeta.contentVersion, organization.id, ids)
    : null;
  return (
    <PageContainer>
      <div className={styles.page} data-presentation-document data-print-document>
        <PresentationControls />
        <PageHeading>{content.site.routes.portfolio.title}</PageHeading>
        <p>{content.site.routes.portfolio.description}</p>
        <p>{copy.note}</p>
        <p>{copy.current}</p>
        <p>
          {content.site.diagnostic.currentContent}: {contentMeta.contentVersion}
        </p>
        <div data-presentation-hide data-no-print>
          <label htmlFor="portfolio-organization">{copy.organization}</label>{' '}
          <select
            id="portfolio-organization"
            value={organization?.id ?? ''}
            disabled={store.data.organizations.length === 0}
            onChange={(event) => {
              setOrganizationId(event.currentTarget.value);
              setExcluded(new Set());
            }}
          >
            {store.data.organizations.length === 0 && (
              <option value="">{content.site.diagnostic.untitledOrganization}</option>
            )}
            {store.data.organizations.map((item) => (
              <option key={item.id} value={item.id}>
                {displayName(item.answers, 'orgName', content.site.diagnostic.untitledOrganization)}
              </option>
            ))}
          </select>
          {assessments.length > 0 && (
            <fieldset className={styles.selection}>
              <legend>{copy.select}</legend>
              <div className={styles.controls}>
                <button type="button" onClick={() => setExcluded(new Set())}>
                  {copy.selectAll}
                </button>
                <button
                  type="button"
                  onClick={() => setExcluded(new Set(assessments.map((item) => item.id)))}
                >
                  {copy.clear}
                </button>
              </div>
              {assessments.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={!excluded.has(item.id)}
                    onChange={(event) => {
                      const next = new Set(excluded);
                      if (event.currentTarget.checked) next.delete(item.id);
                      else next.add(item.id);
                      setExcluded(next);
                    }}
                  />{' '}
                  {displayName(
                    item.answers,
                    'useCaseName',
                    content.site.diagnostic.untitledAssessment,
                  )}
                </label>
              ))}
            </fieldset>
          )}
          <Link to="/diagnostic">{content.site.routes.diagnostic.title}</Link>
        </div>
        {organization && (
          <h2>
            {displayName(
              organization.answers,
              'orgName',
              content.site.diagnostic.untitledOrganization,
            )}
          </h2>
        )}
        {assessments.length === 0 ? (
          <p>{copy.empty}</p>
        ) : ids.length === 0 ? (
          <p>{copy.selectionEmpty}</p>
        ) : (
          portfolio && <PortfolioResults portfolio={portfolio} />
        )}
        <div data-presentation-hide data-no-print>
          <DiagnosticTransfer assessmentIds={ids} />
        </div>
        <p>
          {content.site.readout.draft} · {contentMeta.contentVersion}
        </p>
        <p>{content.site.disclaimer}</p>
      </div>
    </PageContainer>
  );
}
