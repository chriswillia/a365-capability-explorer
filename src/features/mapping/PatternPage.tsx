import { Link, useParams, useSearchParams } from 'react-router';
import { Badge } from '../../components/Badge.tsx';
import { ButtonLink } from '../../components/ButtonLink.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { PageIntro } from '../../components/PageIntro.tsx';
import { PillarSummary } from '../../components/PillarSummary.tsx';
import { ViewPager, ViewPane, ViewSwitcher } from '../../components/ViewSwitcher.tsx';
import { accessModelLabel } from '../../lib/content/access-fit.ts';
import { content, contentMeta } from '../../lib/content/index.ts';
import type { Pattern, Sample } from '../../lib/content/schemas.ts';
import { evaluateAssessment, evaluateWhatIfs, patternAnswers } from '../../lib/engine/evaluate.ts';
import { pillarRows } from '../../lib/engine/pillars.ts';
import { knownAnswer } from '../../lib/engine/answers.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { useView, type PageView } from '../../lib/useView.ts';
import { Component as NotFound } from '../not-found/NotFoundPage.tsx';
import { Evidence } from './Evidence.tsx';
import { MappingReport } from './MappingReport.tsx';
import styles from './Mapping.module.css';

const copy = content.site.mapping;

// The controls come first because they are what a seller opened the example to see. The technical part is only
// offered in the Technical view.
const VIEWS: PageView[] = [
  { id: 'controls', label: copy.views.controls, sections: ['in-scope'] },
  { id: 'risks', label: copy.views.risks, sections: [] },
  { id: 'rollout', label: copy.views.rollout, sections: [] },
  { id: 'technical', label: copy.views.technical, sections: [] },
];

function Brief({ pattern, sample }: { pattern: Pattern; sample?: Sample }) {
  usePageTitle('pattern', sample?.title ?? pattern.title);
  const { depth } = useDepth();
  const technical = depth === 'technical';
  const input = patternAnswers(content, pattern.id, sample?.id);
  const answers = { ...input.org, ...input.useCase };
  const result = evaluateAssessment(content, input, contentMeta.contentVersion);
  const deltas = technical ? evaluateWhatIfs(content, input, contentMeta.contentVersion) : [];
  const views = technical ? VIEWS : VIEWS.filter((candidate) => candidate.id !== 'technical');
  const part = useView(views);
  const access = accessModelLabel(content, answers.accessModel);
  const samples = content.samples.filter((s) => s.patternId === pattern.id);
  return (
    <PageContainer>
      <Link to="/patterns">{copy.back}</Link>
      <PageHeading>{sample?.title ?? pattern.title}</PageHeading>
      {sample && (
        <p>
          <Link to={`/patterns/${pattern.id}`}>{pattern.title}</Link>
        </p>
      )}
      <PageIntro
        notice={
          <>
            <p>{pattern.narrative}</p>
            <Evidence {...(sample ?? pattern)} />
            <p>{copy.neutralNote}</p>
          </>
        }
      >
        {sample?.summary ?? pattern.summary}
      </PageIntro>
      <p className={styles.actions}>
        {access !== null && <Badge tone="outline">{access}</Badge>}
        <ButtonLink to={`/diagnostic?pattern=${pattern.id}${sample ? `&sample=${sample.id}` : ''}`}>
          {content.site.diagnostic.startFromPattern}
        </ButtonLink>
      </p>
      <ViewSwitcher views={views} current={part} />

      <ViewPane view={part} id="controls">
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
        <MappingReport result={result} part="controls" />
        {samples.length > 0 && (
          <section>
            <h2>{copy.samples}</h2>
            <p>{copy.sampleNote}</p>
            <ul className={styles.links}>
              {samples.map((s) => (
                <li key={s.id}>
                  <Link to={`/patterns/${pattern.id}?sample=${s.id}`}>{s.title}</Link> — {s.summary}
                </li>
              ))}
            </ul>
          </section>
        )}
      </ViewPane>

      <ViewPane view={part} id="risks">
        <MappingReport result={result} part="risks" />
      </ViewPane>

      <ViewPane view={part} id="rollout">
        <MappingReport result={result} part="rollout" />
      </ViewPane>

      <ViewPane view={part} id="technical">
        <MappingReport result={result} part="technical" />
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
      </ViewPane>

      <ViewPager views={views} current={part} />
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
