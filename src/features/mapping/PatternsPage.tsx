import { Link } from 'react-router';
import { Badge } from '../../components/Badge.tsx';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content, contentMeta } from '../../lib/content/index.ts';
import type { Capability } from '../../lib/content/schemas.ts';
import { evaluatePatterns } from '../../lib/engine/evaluate.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { Evidence } from './Evidence.tsx';
import styles from './Mapping.module.css';

const patterns = evaluatePatterns(content, contentMeta.contentVersion);

export function Component() {
  usePageTitle('patterns');
  const copy = content.site.mapping;
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
      <p className={styles.intro}>{copy.intro}</p>
      <p className={styles.note}>{copy.neutralNote}</p>
      <Link to="/methodology">{copy.methodology}</Link>
      <ul className={styles.cards}>
        {patterns.map(({ pattern, result }) => (
          <li key={pattern.id} className={styles.card}>
            <h2>
              <Link to={`/patterns/${pattern.id}`}>{pattern.title}</Link>
            </h2>
            <p>{pattern.summary}</p>
            <p>
              {copy.patternCount}: {result.inScope.length}
            </p>
            <Evidence {...pattern} />
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
          rows={content.capabilities}
          rowKey={(c) => c.id}
          scrollLabel={copy.matrix}
        />
      </section>
      <p className={styles.note}>{copy.pendingDiagnostic}</p>
      <Link to="/diagnostic">{copy.startAssessment}</Link>
    </PageContainer>
  );
}
