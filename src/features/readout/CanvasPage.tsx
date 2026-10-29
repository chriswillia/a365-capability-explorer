import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { AgentBackLink } from '../../components/AgentBackLink.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { PresentationControls } from '../../components/PresentationControls.tsx';
import { content, contentMeta, pillarName } from '../../lib/content/index.ts';
import { answerErrors } from '../../lib/engine/answers.ts';
import { pillarRows } from '../../lib/engine/pillars.ts';
import {
  answerText,
  buildReadout,
  canvasFields,
  summarizeText,
  type Readout,
} from '../../lib/readout/report.ts';
import { downloadBlob } from '../../lib/readout/files.ts';
import { canvasPowerPoint, PresentationError } from '../../lib/readout/powerpoint.ts';
import { useDiagnostics } from '../../lib/state/diagnostics.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './Readout.module.css';

function Canvas({ report, assessmentId }: { report?: Readout; assessmentId?: string }) {
  const copy = content.site.readout;
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  usePageTitle('canvas');
  return (
    <PageContainer>
      <AgentBackLink assessmentId={assessmentId} />
      <PresentationControls />
      <div className={styles.actions} data-no-print data-presentation-hide>
        <Link to={assessmentId ? `/diagnostic/${assessmentId}/readout` : '/diagnostic'}>
          {assessmentId ? copy.open : content.site.diagnostic.back}
        </Link>
        <Link to="/canvas/blank">{copy.blankCanvas}</Link>
        <button
          type="button"
          onClick={() => {
            setError(false);
            try {
              window.print();
            } catch (error) {
              if (!(error instanceof DOMException)) throw error;
              setError(true);
            }
          }}
        >
          {copy.print}
        </button>
        <button
          type="button"
          disabled={exporting}
          onClick={() => {
            setError(false);
            setExporting(true);
            void canvasPowerPoint(content, contentMeta.contentVersion, report)
              .then((blob) => downloadBlob(`a365-canvas-${assessmentId ?? 'blank'}.pptx`, blob))
              .catch((error: unknown) => {
                if (!(
                  error instanceof PresentationError ||
                  error instanceof DOMException ||
                  error instanceof TypeError
                ))
                  throw error;
                setError(true);
              })
              .finally(() => setExporting(false));
          }}
        >
          {exporting ? copy.exporting : copy.powerpoint}
        </button>
      </div>
      <p data-no-print>{copy.presentationNote}</p>
      {error && <p role="alert">{copy.exportError}</p>}
      <article
        className={`${styles.document} ${styles.canvas}`}
        data-print-document
        data-presentation-document
      >
        <header>
          {report?.logo && (
            <img
              className={styles.logo}
              src={report.logo.data}
              alt={report.logo.alt}
              width={report.logo.width}
              height={report.logo.height}
            />
          )}
          <p className={styles.draft}>{copy.draft}</p>
          <PageHeading>{copy.canvas}</PageHeading>
          <p className={styles.canvasDetails}>
            {report ? `${report.name} — ${report.organizationName}` : copy.blankCanvas}
          </p>
          <p className={styles.canvasPrintDetails}>
            {report
              ? summarizeText(`${report.name} — ${report.organizationName}`, 130)
              : copy.blankCanvas}
          </p>
          <p className={styles.canvasDetails}>{copy.canvasNote}</p>
          <p className={styles.canvasPrintDetails}>{copy.canvasPrintNote}</p>
          <p>
            {content.site.diagnostic.currentContent}: {contentMeta.contentVersion}
          </p>
        </header>
        <div className={styles.canvasGrid}>
          {canvasFields(content, report).map((box) => (
            <section className={styles.canvasBox} key={box.id}>
              <h2>{box.title}</h2>
              {report && box.questionIds.length > 0 && (
                <dl className={styles.canvasDetails}>
                  {box.questionIds.map((id) => (
                    <div key={id}>
                      <dt>{content.questions.find((q) => q.id === id)!.label}</dt>
                      <dd>{answerText(content, report, id)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {report && box.id === 'risks' && (
                <ul className={styles.canvasDetails}>
                  {report.result.risks.map(({ risk }) => (
                    <li key={risk.id}>{risk.title}</li>
                  ))}
                </ul>
              )}
              {report && (
                <p className={styles.canvasPrintDetails}>{summarizeText(box.body, 100)}</p>
              )}
              <p className={report ? `${styles.prompt} ${styles.canvasDetails}` : styles.prompt}>
                {box.prompt}
              </p>
            </section>
          ))}
          <section className={`${styles.canvasBox} ${styles.canvasWide}`}>
            <h2>{content.site.mapping.pillars}</h2>
            <div className={styles.canvasPillars}>
              {(report?.pillars ?? pillarRows(content, [])).map((row) => (
                <div key={row.pillar.id}>
                  <h3>{pillarName(row.pillar)}</h3>
                  {row.items.length > 0 ? (
                    <>
                      <ul className={styles.canvasDetails}>
                        {row.items.map(({ capability, level }) => (
                          <li key={capability.id}>
                            {capability.shortName} — {content.site.mapping.levels[level]}
                          </li>
                        ))}
                      </ul>
                      <p className={styles.canvasPrintDetails}>
                        {summarizeText(row.items.map((r) => r.capability.shortName).join('; '), 60)}
                      </p>
                    </>
                  ) : (
                    <p>
                      {report
                        ? content.site.mapping.pillarNone
                        : content.site.mapping.unknownAnswer}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
        <section className={styles.canvasBox}>
          <h2>{content.site.mapping.inScope}</h2>
          <div className={styles.canvasControls}>
            {[...content.controlPoints]
              .sort((a, b) => a.order - b.order)
              .map((point) => {
                const rows = report?.result.anatomy.find(
                  (r) => r.point.id === point.id,
                )?.capabilities;
                return (
                  <div key={point.id}>
                    <h3>{point.layer}</h3>
                    {rows && rows.length > 0 ? (
                      <ul className={styles.canvasDetails}>
                        {rows.map((r) => (
                          <li key={r.capability.id}>{r.capability.shortName}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.canvasDetails}>{content.site.mapping.unknownAnswer}</p>
                    )}
                    <p className={styles.canvasPrintDetails}>
                      {summarizeText(
                        rows?.map((r) => r.capability.shortName).join('; ') ||
                          content.site.mapping.unknownAnswer,
                        65,
                      )}
                    </p>
                  </div>
                );
              })}
          </div>
        </section>
        <p className={styles.disclaimer} data-print-only>
          {content.site.disclaimer}
        </p>
      </article>
    </PageContainer>
  );
}

function SavedCanvas({ id }: { id: string }) {
  const { data } = useDiagnostics();
  const assessment = data.assessments.find((a) => a.id === id);
  const organization = data.organizations.find((o) => o.id === assessment?.organizationId);
  if (!assessment || !organization) return <UnavailableCanvas />;
  const errors = [
    ...answerErrors(content.questions, organization.answers, 'org'),
    ...answerErrors(content.questions, assessment.answers, 'useCase'),
  ];
  if (errors.length > 0) return <UnavailableCanvas id={id} />;
  return (
    <Canvas
      assessmentId={id}
      report={buildReadout(content, organization, assessment, contentMeta.contentVersion)}
    />
  );
}

function UnavailableCanvas({ id }: { id?: string }) {
  usePageTitle('canvas');
  return (
    <PageContainer>
      <PageHeading>{content.site.readout.canvas}</PageHeading>
      <p role="alert">
        {id ? content.site.diagnostic.incompatible : content.site.diagnostic.notFound}
      </p>
      <Link to={id ? `/diagnostic/${id}` : '/diagnostic'}>{content.site.diagnostic.back}</Link>
    </PageContainer>
  );
}

export function Component() {
  const { id } = useParams();
  return id === undefined ? <Canvas /> : <SavedCanvas id={id} />;
}
