import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { KpiStrip } from '../../components/KpiStrip.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { PresentationControls } from '../../components/PresentationControls.tsx';
import { content, contentMeta } from '../../lib/content/index.ts';
import { formatNumber } from '../../lib/content/template.ts';
import { answerErrors } from '../../lib/engine/answers.ts';
import { answerLabel, buildReadout, readoutMarkdown } from '../../lib/readout/report.ts';
import { downloadBlob, downloadText } from '../../lib/readout/files.ts';
import { PresentationError, readoutPowerPoint } from '../../lib/readout/powerpoint.ts';
import { diagnosticBundle } from '../../lib/state/diagnostic-transfer.ts';
import { useDiagnostics } from '../../lib/state/diagnostics.ts';
import type { Assessment, Organization } from '../../lib/state/diagnostic-model.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { BrandingEditor } from './BrandingEditor.tsx';
import { ReadoutExhibits } from './ReadoutExhibits.tsx';
import styles from './Readout.module.css';

function Readout({
  assessment,
  organization,
}: {
  assessment: Assessment;
  organization: Organization;
}) {
  const store = useDiagnostics();
  const copy = content.site.readout;
  const mapping = content.site.mapping;
  const report = buildReadout(content, organization, assessment, contentMeta.contentVersion);
  const { result, metrics } = report;
  const [message, setMessage] = useState<'copied' | 'error' | null>(null);
  const [exporting, setExporting] = useState(false);
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
      if (!(
        error instanceof DOMException ||
        error instanceof TypeError ||
        error instanceof PresentationError
      ))
        throw error;
      setMessage('error');
    }
  };
  return (
    <PageContainer>
      <PresentationControls />
      <div className={styles.actions} data-no-print data-presentation-hide>
        <Link to={`/diagnostic/${assessment.id}`}>{copy.edit}</Link>
        <Link to={`/canvas/${assessment.id}`}>{copy.canvas}</Link>
        <button type="button" onClick={() => void perform(() => window.print())}>
          {copy.print}
        </button>
        <button
          type="button"
          disabled={exporting}
          onClick={() =>
            void perform(async () => {
              setExporting(true);
              try {
                downloadBlob(
                  `a365-readout-${assessment.id}.pptx`,
                  await readoutPowerPoint(content, report),
                );
              } finally {
                setExporting(false);
              }
            })
          }
        >
          {exporting ? copy.exporting : copy.powerpoint}
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
      <p data-no-print>{copy.presentationNote}</p>
      <div data-presentation-hide>
        <BrandingEditor assessment={assessment} />
      </div>
      {message && (
        <p role={message === 'error' ? 'alert' : 'status'}>
          {message === 'error' ? copy.exportError : copy.copied}
        </p>
      )}
      <style>{`@page readout {
        @bottom-left {
          content: ${JSON.stringify(`${copy.draft} · ${result.contentVersion}`)} "\\A" ${JSON.stringify(content.site.disclaimer)};
        }
      }`}</style>
      <article className={styles.document} data-print-document data-presentation-document>
        <header className={styles.cover}>
          {report.logo && (
            <img
              className={styles.logo}
              src={report.logo.data}
              alt={report.logo.alt}
              width={report.logo.width}
              height={report.logo.height}
            />
          )}
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
              {
                id: 'readiness',
                label: mapping.readinessPercent,
                value:
                  metrics.readinessPercent === null
                    ? mapping.unknownAnswer
                    : `${formatNumber(metrics.readinessPercent)}%`,
              },
            ]}
          />
          <p>{copy.setupNote}</p>
        </section>
        <ReadoutExhibits report={report} assessment={assessment} organization={organization} />
        <p className={styles.disclaimer}>
          {copy.draft} · {result.contentVersion}
          <br />
          {content.site.disclaimer}
        </p>
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
