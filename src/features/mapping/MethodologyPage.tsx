import { Link } from 'react-router';
import { DataTable } from '../../components/DataTable.tsx';
import { ExternalLink } from '../../components/ExternalLink.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content, sourceById } from '../../lib/content/index.ts';
import { describeCondition } from '../../lib/engine/conditions.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { Evidence } from './Evidence.tsx';
import { RuleExplanation } from './RuleExplanation.tsx';
import styles from './Mapping.module.css';

export function Component() {
  usePageTitle('methodology');
  const copy = content.site.mapping;
  return (
    <PageContainer>
      <PageHeading>{content.site.routes.methodology.title}</PageHeading>
      <p className={styles.intro}>{copy.methodology}</p>
      <section>
        <h2>{copy.assumptions}</h2>
        <ul>
          {copy.methodologyNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>{copy.inScope}</h2>
        <dl>
          {Object.entries(copy.levels).map(([level, label]) => (
            <div key={level}>
              <dt>
                <strong>{label}</strong>
              </dt>
              <dd>{copy.levelDescriptions[level as keyof typeof copy.levels]}</dd>
            </div>
          ))}
        </dl>
        <p>{copy.readinessNote}</p>
        <p>{copy.intensityNote}</p>
        <p>{copy.neutralNote}</p>
      </section>
      <section id="risks">
        <h2>{copy.riskAssociations}</h2>
        <p>{copy.riskNote}</p>
        <ul className={styles.cards}>
          {content.risks.map((risk) => (
            <li className={styles.card} key={risk.id}>
              <h3>{risk.title}</h3>
              <p>{risk.summary}</p>
              <p>{describeCondition(risk.triggeredWhen, content.questions, copy.condition)}</p>
              <Evidence {...risk} />
              <ul className={styles.links}>
                {risk.mitigatedBy.map((id) => (
                  <li key={id}>
                    <Link to={`/capabilities/${id}`}>
                      {content.capabilities.find((c) => c.id === id)!.shortName}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link className={styles.cellLink} to={`/capabilities?lens=risk&group=${risk.id}`}>
                {content.site.capabilities.explorer.lenses.risk}: {risk.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>{copy.rules}</h2>
        {content.rules.map((rule) => (
          <article key={rule.id} id={`rule-${rule.id}`}>
            <h3>
              <code>{rule.id}</code>
            </h3>
            <RuleExplanation rule={rule} />
          </article>
        ))}
      </section>
      <section>
        <h2>{copy.golden}</h2>
        <DataTable
          caption={copy.golden}
          hideCaption
          scrollLabel={copy.golden}
          rows={content.goldenScenarios}
          rowKey={(s) => s.id}
          columns={[
            {
              key: 'scenario',
              header: content.site.routes.pattern.title,
              rowHeader: true,
              render: (s) => {
                const sample = content.samples.find((sample) => sample.id === s.sampleId);
                const pattern = content.patterns.find((p) => p.id === s.patternId)!;
                return (
                  <Link
                    className={styles.cellLink}
                    to={`/patterns/${s.patternId}${sample ? `?sample=${sample.id}` : ''}`}
                  >
                    {sample?.title ?? pattern.title}
                  </Link>
                );
              },
            },
            {
              key: 'include',
              header: copy.levels.essential,
              render: (s) =>
                s.mustInclude
                  .map((id) => content.capabilities.find((c) => c.id === id)!.shortName)
                  .join(', '),
            },
            {
              key: 'exclude',
              header: copy.notInScope,
              render: (s) =>
                s.mustNotInclude
                  .map((id) => content.capabilities.find((c) => c.id === id)!.shortName)
                  .join(', '),
            },
            {
              key: 'review',
              header: copy.golden,
              render: (s) =>
                s.reviewedBy === null ? copy.pendingReview : `${s.reviewedBy} · ${s.reviewedOn}`,
            },
          ]}
        />
      </section>
      <section>
        <h2>{copy.hostingSources}</h2>
        <ul className={styles.links}>
          {copy.hostingSourceIds.map((id) => {
            const source = sourceById(id)!;
            return (
              <li key={id}>
                <ExternalLink href={source.url}>{source.title}</ExternalLink>
              </li>
            );
          })}
        </ul>
      </section>
    </PageContainer>
  );
}
