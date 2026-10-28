import { Link, useParams, useSearchParams } from 'react-router';
import { Badge } from '../../components/Badge.tsx';
import { ButtonLink } from '../../components/ButtonLink.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { PillarSummary } from '../../components/PillarSummary.tsx';
import { accessModelLabel } from '../../lib/content/access-fit.ts';
import { content, contentMeta } from '../../lib/content/index.ts';
import type { Pattern, Sample } from '../../lib/content/schemas.ts';
import { evaluateAssessment, evaluateWhatIfs, patternAnswers } from '../../lib/engine/evaluate.ts';
import { pillarRows } from '../../lib/engine/pillars.ts';
import { knownAnswer } from '../../lib/engine/answers.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { Component as NotFound } from '../not-found/NotFoundPage.tsx';
import { Evidence } from './Evidence.tsx';
import { MappingReport } from './MappingReport.tsx';
import styles from './Mapping.module.css';

function Brief({ pattern, sample }: { pattern: Pattern; sample?: Sample }) {
  usePageTitle('pattern', sample?.title ?? pattern.title);
  const { depth } = useDepth();
  const copy = content.site.mapping;
  const input = patternAnswers(content, pattern.id, sample?.id);
  const answers = { ...input.org, ...input.useCase };
  const result = evaluateAssessment(content, input, contentMeta.contentVersion);
  const deltas =
    depth === 'technical' ? evaluateWhatIfs(content, input, contentMeta.contentVersion) : [];
  return (
    <PageContainer>
      <Link to="/patterns">{copy.back}</Link>
      <PageHeading>{sample?.title ?? pattern.title}</PageHeading>
      {sample && (
        <p>
          <Link to={`/patterns/${pattern.id}`}>{pattern.title}</Link>
        </p>
      )}
      <p className={styles.intro}>{sample?.summary ?? pattern.summary}</p>
      {accessModelLabel(content, answers.accessModel) !== null && (
        <p>
          <Badge tone="outline">{accessModelLabel(content, answers.accessModel)}</Badge>
        </p>
      )}
      <p>{pattern.narrative}</p>
      <Evidence {...(sample ?? pattern)} />
      <p>
        <ButtonLink to={`/diagnostic?pattern=${pattern.id}${sample ? `&sample=${sample.id}` : ''}`}>
          {content.site.diagnostic.startFromPattern}
        </ButtonLink>
      </p>
      <p className={styles.note}>{copy.neutralNote}</p>
      <section aria-labelledby="pillar-summary-title">
        <h2 id="pillar-summary-title">{copy.pillars}</h2>
        <p className={styles.note}>{copy.pillarsNote}</p>
        <PillarSummary rows={pillarRows(content, result.inScope)} detailed={false} />
      </section>
      <details>
        <summary>{copy.answers}</summary>
        <dl className={styles.answers}>
          {content.questions.map((q) => {
            const value = answers[q.id];
            const labels = !knownAnswer(value)
              ? copy.unknownAnswer
              : (Array.isArray(value) ? value : [value])
                  .map((v) => q.options.find((o) => o.value === v)!.label)
                  .join(', ');
            return (
              <div key={q.id}>
                <dt>{q.label}</dt>
                <dd>{labels}</dd>
              </div>
            );
          })}
        </dl>
      </details>
      <MappingReport result={result} />
      {depth === 'technical' && (
        <section>
          <h2>{copy.whatIfs}</h2>
          <ul>
            {deltas.map((delta) => (
              <li key={delta.whatIf.id}>
                <h3>{delta.whatIf.title}</h3>
                {delta.added.length + delta.removed.length + delta.changed.length === 0 && (
                  <p>{copy.noChanges}</p>
                )}
                {delta.added.length > 0 && (
                  <p>
                    {copy.added}: {delta.added.map((r) => r.capability.shortName).join(', ')}
                  </p>
                )}
                {delta.removed.length > 0 && (
                  <p>
                    {copy.removed}: {delta.removed.map((r) => r.capability.shortName).join(', ')}
                  </p>
                )}
                {delta.changed.length > 0 && (
                  <ul>
                    {delta.changed.map((c) => (
                      <li key={c.capability.id}>
                        {copy.changed}: {c.capability.shortName} — {copy.levels[c.from]} →{' '}
                        {copy.levels[c.to]}
                      </li>
                    ))}
                  </ul>
                )}
                {delta.gccGaps.length > 0 && (
                  <p>
                    {copy.gcc}: {delta.gccGaps.map((r) => r.capability.shortName).join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2>{copy.samples}</h2>
        <p>{copy.sampleNote}</p>
        <ul className={styles.links}>
          {content.samples
            .filter((s) => s.patternId === pattern.id)
            .map((s) => (
              <li key={s.id}>
                <Link to={`/patterns/${pattern.id}?sample=${s.id}`}>{s.title}</Link> — {s.summary}
              </li>
            ))}
        </ul>
      </section>
      <Link to="/methodology">{copy.methodology}</Link>
    </PageContainer>
  );
}

export function Component() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const pattern = content.patterns.find((p) => p.id === id);
  const sampleId = params.get('sample');
  const sample =
    sampleId === null
      ? undefined
      : content.samples.find((s) => s.id === sampleId && s.patternId === id);
  if (!pattern || (sampleId !== null && !sample) || params.getAll('sample').length > 1)
    return <NotFound />;
  return <Brief pattern={pattern} sample={sample} />;
}
