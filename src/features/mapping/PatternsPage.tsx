import { Link } from 'react-router';
import { Badge } from '../../components/Badge.tsx';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { PageIntro } from '../../components/PageIntro.tsx';
import { accessModelLabel } from '../../lib/content/access-fit.ts';
import { content, contentMeta, pillarById } from '../../lib/content/index.ts';
import type { Capability } from '../../lib/content/schemas.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { evaluatePatterns } from '../../lib/engine/evaluate.ts';
import { pillarRows } from '../../lib/engine/pillars.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './Mapping.module.css';

const patterns = evaluatePatterns(content, contentMeta.contentVersion);
const orderedCapabilities = [...content.capabilities].sort(
  (a, b) => pillarById(a.pillar)!.order - pillarById(b.pillar)!.order,
);

export function Component() {
  usePageTitle('patterns');
  const { depth } = useDepth();
  const copy = content.site.mapping;
  const draftCount = patterns.filter(({ pattern }) => pattern.reviewStatus === 'draft').length;
  const columns: Column<Capability>[] = [
    {
      key: 'capability',
      header: content.site.capabilities.columns.capability,
      rowHeader: true,
      render: (c) => (
        <Link className={styles.cellLink} to={`/capabilities/${c.id}`}>
          {c.shortName}
        </Link>
      ),
    },
    {
      key: 'pillar',
      header: content.site.capabilities.columns.pillar,
      nowrap: true,
      render: (c) => pillarById(c.pillar)?.requirement,
    },
    ...patterns.map(({ pattern, result }) => ({
      key: pattern.id,
      header: pattern.title,
      render: (c: Capability) => {
        const match = result.inScope.find((r) => r.capability.id === c.id);
        return match ? (
          <Link
            className={styles.cellLink}
            to={`/patterns/${pattern.id}#in-scope`}
            aria-label={`${pattern.title} — ${c.shortName}: ${copy.levels[match.level]}`}
          >
            <Badge tone={match.level === 'essential' ? 'info' : 'outline'}>
              {copy.levels[match.level]}
            </Badge>
          </Link>
        ) : (
          <span>{content.site.capabilities.explorer.notApplicable}</span>
        );
      },
    })),
  ];
  return (
    <PageContainer>
      <PageHeading>{content.site.routes.patterns.title}</PageHeading>
      <PageIntro
        notice={
          <>
            <p>{copy.neutralNote}</p>
            {depth === 'technical' && draftCount > 0 && (
              <p>
                {renderTemplate(copy.draftSummary, { draft: draftCount, total: patterns.length })}
              </p>
            )}
            <p>
              <Link to="/methodology">{copy.methodology}</Link>
            </p>
          </>
        }
      >
        {copy.intro}
      </PageIntro>
      <ul className={styles.cards}>
        {patterns.map(({ pattern, result }) => (
          <li key={pattern.id} className={styles.card}>
            <h2>
              <Link to={`/patterns/${pattern.id}`}>{pattern.title}</Link>
            </h2>
            <p>{pattern.summary}</p>
            {accessModelLabel(content, pattern.answers.accessModel) !== null && (
              <p>
                <Badge tone="outline">
                  {accessModelLabel(content, pattern.answers.accessModel)}
                </Badge>
              </p>
            )}
            <p>
              {copy.patternCount}: {result.inScope.length}
            </p>
            <p className={styles.note}>
              {pillarRows(content, result.inScope)
                .map((row) => `${row.pillar.requirement}: ${row.items.length}`)
                .join(' · ')}
            </p>
            {pattern.reviewStatus === 'reviewed' && (
              <Badge tone="outline">{content.site.ui.badges.reviewed}</Badge>
            )}
          </li>
        ))}
      </ul>
      <section className={styles.matrix}>
        <h2>{copy.matrix}</h2>
        <ul className={styles.legend}>
          {Object.entries(copy.levels).map(([level, label]) => (
            <li key={level}>
              <strong>{label}</strong>
            </li>
          ))}
        </ul>
        <DataTable
          caption={copy.matrix}
          hideCaption
          columns={columns}
          rows={orderedCapabilities}
          rowKey={(c) => c.id}
          scrollLabel={copy.matrix}
        />
      </section>
      <p className={styles.note}>{copy.pendingDiagnostic}</p>
      <Link to="/map">{copy.startAssessment}</Link>
    </PageContainer>
  );
}
