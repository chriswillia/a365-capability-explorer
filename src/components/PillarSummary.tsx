import { Link } from 'react-router';
import { content, pillarName } from '../lib/content/index.ts';
import { renderTemplate } from '../lib/content/template.ts';
import type { PillarRow } from '../lib/engine/pillars.ts';
import styles from './PillarSummary.module.css';

/** How many capabilities of each pillar are in scope, with their levels, flags and the teams to involve. */
export function PillarSummary({
  rows,
  headingLevel = 3,
  detailed = true,
}: {
  rows: PillarRow[];
  headingLevel?: 2 | 3 | 4;
  /** List each capability and the teams to involve; the compact form shows the counts and flags only. */
  detailed?: boolean;
}) {
  const { mapping } = content.site;
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <ul className={styles.grid}>
      {rows.map((row) => (
        <li key={row.pillar.id} className={styles.card} data-pillar={row.pillar.id}>
          <Heading className={styles.name}>{pillarName(row.pillar)}</Heading>
          <p className={styles.count}>
            {renderTemplate(mapping.pillarCount, {
              count: row.items.length,
              total: row.catalogTotal,
            })}
          </p>
          {row.items.length === 0 ? (
            <p>{mapping.pillarNone}</p>
          ) : (
            <>
              <p>
                {(['essential', 'recommended', 'consider'] as const)
                  .map((level) => `${mapping.levels[level]} ${row.levels[level]}`)
                  .join(' · ')}
              </p>
              <p className={styles.flags}>
                {renderTemplate(mapping.pillarFlags, {
                  premium: row.premium,
                  notInGcc: row.notInGcc,
                })}
              </p>
            </>
          )}
          {detailed && row.items.length > 0 && (
            <>
              <ul className={styles.items}>
                {row.items.map(({ capability, level }) => (
                  <li key={capability.id}>
                    <Link to={`/capabilities/${capability.id}`}>{capability.shortName}</Link> —{' '}
                    {mapping.levels[level]}
                  </li>
                ))}
              </ul>
              <p className={styles.owners}>
                <strong>{mapping.pillarOwners}:</strong> {row.owners.join('; ')}
              </p>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
