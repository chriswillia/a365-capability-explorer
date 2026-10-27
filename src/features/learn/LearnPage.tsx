import { Link } from 'react-router';
import { DataTable } from '../../components/DataTable.tsx';
import { ExternalLink } from '../../components/ExternalLink.tsx';
import { createGlossaryAnnotator } from '../../lib/content/annotateGlossary.tsx';
import { LearningEvidence } from '../../components/LearningEvidence.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content, sourceById } from '../../lib/content/index.ts';
import type { LearningItem } from '../../lib/content/schemas.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './LearnPage.module.css';

function CapabilityLinks({ ids }: { ids: string[] }) {
  const capabilities = content.capabilities.filter((c) => ids.includes(c.id));
  return (
    <ul className={styles.capabilityLinks}>
      {capabilities.map((c) => (
        <li key={c.id}>
          <Link to={`/capabilities/${c.id}`}>{c.shortName}</Link>
        </li>
      ))}
    </ul>
  );
}

export function Component() {
  usePageTitle('learn');
  const { depth } = useDepth();
  const { site, learn } = content;
  const copy = site.learn;
  const annotate = createGlossaryAnnotator();
  const anchors = [
    ['positioning', copy.sections.positioning],
    ['myths', copy.sections.myths],
    ['concepts', copy.sections.concepts],
    ['integration', copy.sections.integration],
    ['building-blocks', copy.sections.buildingBlocks],
    ['glossary', copy.sections.glossary],
  ] as const;
  const renderTechnical = (item: LearningItem) => {
    const technicalSource = item.technicalSourceId ? sourceById(item.technicalSourceId) : undefined;
    return (
      depth === 'technical' &&
      item.summary !== null &&
      item.technical && (
        <div>
          <p>{annotate(item.technical)}</p>
          {technicalSource && (
            <ExternalLink href={technicalSource.url}>{technicalSource.title}</ExternalLink>
          )}
        </div>
      )
    );
  };
  const renderItem = (item: LearningItem) => (
    <article key={item.id} className={styles.card}>
      <h3>{item.title}</h3>
      <p>{item.summary === null ? copy.pending : annotate(item.summary)}</p>
      {renderTechnical(item)}
      {item.capabilityIds.length > 0 && (
        <>
          <h4>{copy.related}</h4>
          <CapabilityLinks ids={item.capabilityIds} />
        </>
      )}
      <LearningEvidence item={item} />
    </article>
  );

  return (
    <PageContainer>
      <PageHeading>{site.routes.learn.title}</PageHeading>
      <p className={styles.intro}>{copy.intro}</p>
      <p>{copy.draftNote}</p>
      <p>
        <Link to="/conversation">{site.routes.conversation.title}</Link>
      </p>
      <nav aria-label={copy.contents} className={styles.contents}>
        {anchors.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>
      <section id="positioning" className={styles.section}>
        <h2>{copy.sections.positioning}</h2>
        <div className={styles.grid}>{learn.positioning.map(renderItem)}</div>
      </section>
      <section id="myths" className={styles.section}>
        <h2>{copy.sections.myths}</h2>
        <div className={styles.grid}>
          {content.faq.map((item) => (
            <article key={item.id} className={styles.card}>
              <p>{copy.mythLabel}</p>
              <h3>{item.myth}</h3>
              <h4>{copy.factLabel}</h4>
              <p>{item.fact === null ? copy.pending : annotate(item.fact)}</p>
              <LearningEvidence item={item} />
            </article>
          ))}
        </div>
      </section>
      <section id="concepts" className={styles.section}>
        <h2>{copy.sections.concepts}</h2>
        <p>{copy.flowNote}</p>
        <DataTable
          caption={copy.flowTable}
          scrollLabel={copy.flowTable}
          rows={learn.flow}
          rowKey={(item) => item.id}
          columns={[
            {
              key: 'step',
              header: copy.flowColumns.step,
              render: (item) => learn.flow.indexOf(item) + 1,
            },
            {
              key: 'concept',
              header: copy.flowColumns.concept,
              rowHeader: true,
              render: (item) => (
                <>
                  <h3>{item.title}</h3>
                  <p>{item.summary === null ? copy.pending : annotate(item.summary)}</p>
                  {renderTechnical(item)}
                  <LearningEvidence item={item} />
                </>
              ),
            },
            {
              key: 'capabilities',
              header: copy.flowColumns.capabilities,
              render: (item) => <CapabilityLinks ids={item.capabilityIds} />,
            },
          ]}
        />
      </section>
      <section id="integration" className={styles.section}>
        <h2>{copy.sections.integration}</h2>
        <div className={styles.grid}>{learn.integration.map(renderItem)}</div>
      </section>
      <section id="building-blocks" className={styles.section}>
        <h2>{copy.sections.buildingBlocks}</h2>
        <p>{copy.buildingBlocksNote}</p>
        <div className={styles.grid}>{content.buildingBlocks.map(renderItem)}</div>
      </section>
      <section id="glossary" className={styles.section}>
        <h2>{copy.sections.glossary}</h2>
        <dl className={styles.grid}>
          {content.glossary.map((entry) => (
            <div key={entry.id} id={`glossary-${entry.id}`} className={styles.card}>
              <dt>{entry.term}</dt>
              <dd>
                <p>{entry.definition}</p>
                <LearningEvidence item={entry} />
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </PageContainer>
  );
}
