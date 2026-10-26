import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { DataTable } from '../../components/DataTable.tsx';
import { KpiStrip } from '../../components/KpiStrip.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content, contentMeta } from '../../lib/content/index.ts';
import { formatNumber } from '../../lib/content/template.ts';
import { answerErrors } from '../../lib/engine/answers.ts';
import { evaluateWhatIfs } from '../../lib/engine/evaluate.ts';
import { answerLabel, buildReadout, readoutMarkdown } from '../../lib/readout/report.ts';
import { downloadText } from '../../lib/readout/files.ts';
import { diagnosticBundle } from '../../lib/state/diagnostic-transfer.ts';
import { useDiagnostics } from '../../lib/state/diagnostics.ts';
import type { Assessment, Organization } from '../../lib/state/diagnostic-model.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { MappingReport } from '../mapping/MappingReport.tsx';
import styles from './Readout.module.css';

function Readout({
  assessment,
  organization,
}: {
  assessment: Assessment;
  organization: Organization;
}) {
  const store = useDiagnostics();
  const { depth } = useDepth();
  const copy = content.site.readout;
  const mapping = content.site.mapping;
  const report = buildReadout(content, organization, assessment, contentMeta.contentVersion);
  const { result, metrics } = report;
  const [message, setMessage] = useState<'copied' | 'error' | null>(null);
  const [whatIf, setWhatIf] = useState('');
  usePageTitle('readout', report.title);
  useEffect(() => {
    const opened = new Set<HTMLDetailsElement>();
    const before = () => {
      for (const element of document.querySelectorAll<HTMLDetailsElement>(
        'main details:not([open])',
      )) {
        opened.add(element);
        element.open = true;
      }
    };
    const after = () => {
      for (const element of opened) element.open = false;
      opened.clear();
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      after();
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  const perform = async (action: () => void | Promise<void>) => {
    setMessage(null);
    try {
      await action();
    } catch (error) {
      if (!(error instanceof DOMException || error instanceof TypeError)) throw error;
      setMessage('error');
    }
  };
  const deltas =
    depth === 'technical'
      ? evaluateWhatIfs(
          content,
          { org: organization.answers, useCase: assessment.answers },
          contentMeta.contentVersion,
        )
      : [];
  const delta = deltas.find((d) => d.whatIf.id === whatIf);
  return (
    <PageContainer>
      <div className={styles.actions} data-no-print>
        <Link to={`/diagnostic/${assessment.id}`}>{copy.edit}</Link>
        <Link to={`/canvas/${assessment.id}`}>{copy.canvas}</Link>
        <button type="button" onClick={() => void perform(() => window.print())}>
          {copy.print}
        </button>
        <button
          type="button"
          onClick={() =>
            void perform(() =>
              downloadText(
                `a365-readout-${assessment.id}.md`,
                readoutMarkdown(content, report),
                'text/markdown;charset=utf-8',
              ),
            )
          }
        >
          {copy.markdown}
        </button>
        <button
          type="button"
          onClick={() =>
            void perform(() =>
              downloadText(
                `a365-assessment-${assessment.id}.json`,
                JSON.stringify(
                  diagnosticBundle(store.data, contentMeta.contentVersion, assessment.id),
                  null,
                  2,
                ),
                'application/json',
              ),
            )
          }
        >
          {copy.json}
        </button>
        <button
          type="button"
          onClick={() =>
            void perform(async () => {
              if (!navigator.clipboard) {
                setMessage('error');
                return;
              }
              await navigator.clipboard.writeText(
                [
                  report.title,
                  copy.draft,
                  result.contentVersion,
                  ...report.summary,
                  content.site.disclaimer,
                ].join('\n\n'),
              );
              setMessage('copied');
            })
          }
        >
          {copy.copySummary}
        </button>
      </div>
      <p data-no-print>{copy.sharingNote}</p>
      {message && (
        <p role={message === 'error' ? 'alert' : 'status'}>
          {message === 'error' ? copy.exportError : copy.copied}
        </p>
      )}
      <article className={styles.document} data-print-document>
        <header className={styles.cover}>
          <p className={styles.draft}>{copy.draft}</p>
          <PageHeading>{report.title}</PageHeading>
          <p>{copy.current}</p>
          <dl className={styles.metadata}>
            <div>
              <dt>{copy.preparedFor}</dt>
              <dd>{report.organizationName}</dd>
            </div>
            {['engagementName', 'preparedBy', 'preparedOn'].map((id) => (
              <div key={id}>
                <dt>{content.questions.find((q) => q.id === id)!.label}</dt>
                <dd>{answerLabel(content, report.answers, id)}</dd>
              </div>
            ))}
            <div>
              <dt>{content.site.diagnostic.currentContent}</dt>
              <dd>{result.contentVersion}</dd>
            </div>
          </dl>
          {(assessment.contentVersion !== contentMeta.contentVersion ||
            organization.contentVersion !== contentMeta.contentVersion) && (
            <p role="note">{content.site.diagnostic.oldContent}</p>
          )}
        </header>
        <section>
          <h2>{copy.summary}</h2>
          <ol>
            {report.summary.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ol>
          <KpiStrip
            items={[
              ...(['essential', 'recommended', 'consider'] as const).map((id) => ({
                id,
                label: mapping.levels[id],
                value: formatNumber(metrics.levels[id]),
              })),
              {
                id: 'foundational',
                label: copy.foundational,
                value: formatNumber(metrics.foundational),
              },
              { id: 'premium', label: copy.premium, value: formatNumber(metrics.premium) },
              { id: 'platform', label: copy.platform, value: formatNumber(metrics.platform) },
              { id: 'agent', label: copy.agent, value: formatNumber(metrics.agent) },
            ]}
          />
          <p>{copy.setupNote}</p>
        </section>
        <section>
          <h2>{copy.anatomy}</h2>
          <DataTable
            caption={copy.anatomy}
            hideCaption
            scrollLabel={copy.anatomy}
            rows={result.anatomy}
            rowKey={(row) => row.point.id}
            columns={[
              {
                key: 'layer',
                header: content.site.capabilities.columns.layer,
                rowHeader: true,
                render: (row) => row.point.layer,
              },
              {
                key: 'controls',
                header: mapping.inScope,
                render: (row) =>
                  row.capabilities.map((r) => r.capability.shortName).join(', ') ||
                  mapping.unknownAnswer,
              },
            ]}
          />
        </section>
        <section>
          <h2>{copy.roadmap}</h2>
          <p>{copy.roadmapNote}</p>
          <div className={styles.roadmap}>
            {([1, 2, 3] as const).map((wave) => {
              const rows = result.inScope.filter((r) => r.wave === wave);
              return (
                <div key={wave}>
                  <h3>{copy.waves[wave]}</h3>
                  {rows.length === 0 ? (
                    <p>{copy.empty}</p>
                  ) : (
                    <ul>
                      {rows.map((r) => (
                        <li key={r.capability.id}>
                          <Link to={`/capabilities/${r.capability.id}`}>
                            {r.capability.shortName}
                          </Link>
                          {' — '}
                          {mapping.levels[r.level]}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <MappingReport result={result} showDiagnosticNote={false} showAnatomy={false} />
        {depth === 'technical' && (
          <section>
            <h2>{mapping.whatIfs}</h2>
            <p>{copy.whatIfNote}</p>
            <label htmlFor="readout-what-if">{mapping.whatIfs}</label>
            <select id="readout-what-if" value={whatIf} onChange={(e) => setWhatIf(e.target.value)}>
              <option value="">{copy.baseline}</option>
              {deltas.map((d) => (
                <option key={d.whatIf.id} value={d.whatIf.id}>
                  {d.whatIf.title}
                </option>
              ))}
            </select>
            {delta && (
              <div role="status">
                <h3>{delta.whatIf.title}</h3>
                <p>
                  {mapping.added}:{' '}
                  {delta.added.map((r) => r.capability.shortName).join(', ') || copy.empty}
                </p>
                <p>
                  {mapping.removed}:{' '}
                  {delta.removed.map((r) => r.capability.shortName).join(', ') || copy.empty}
                </p>
                <ul>
                  {delta.changed.map((change) => (
                    <li key={change.capability.id}>
                      {change.capability.shortName}: {mapping.levels[change.from]} →{' '}
                      {mapping.levels[change.to]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
        <p className={styles.disclaimer}>{content.site.disclaimer}</p>
      </article>
    </PageContainer>
  );
}

export function Component() {
  const { id } = useParams();
  const { data } = useDiagnostics();
  const assessment = data.assessments.find((a) => a.id === id);
  const organization = data.organizations.find((o) => o.id === assessment?.organizationId);
  const errors =
    assessment && organization
      ? [
          ...answerErrors(content.questions, organization.answers, 'org'),
          ...answerErrors(content.questions, assessment.answers, 'useCase'),
        ]
      : [];
  if (!assessment || !organization || errors.length > 0)
    return <UnavailableReadout missing={!assessment || !organization} />;
  return <Readout key={assessment.id} assessment={assessment} organization={organization} />;
}

function UnavailableReadout({ missing }: { missing: boolean }) {
  usePageTitle('readout');
  const { id } = useParams();
  return (
    <PageContainer>
      <PageHeading>{content.site.routes.readout.title}</PageHeading>
      <p role="alert">
        {missing ? content.site.diagnostic.notFound : content.site.diagnostic.incompatible}
      </p>
      <Link to={missing ? '/diagnostic' : `/diagnostic/${id}`}>{content.site.diagnostic.back}</Link>
    </PageContainer>
  );
}
