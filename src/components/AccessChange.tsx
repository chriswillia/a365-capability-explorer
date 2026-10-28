import { Fragment } from 'react';
import { Link } from 'react-router';
import { content } from '../lib/content/index.ts';
import { renderTemplate } from '../lib/content/template.ts';
import type { AccessChange as AccessChangeView } from '../lib/engine/access.ts';
import { Badge } from './Badge.tsx';
import styles from './AccessChange.module.css';

const orFormat = new Intl.ListFormat('en', { style: 'long', type: 'disjunction' });
const andFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

/**
 * Which capabilities depend on how the agent acts for one assessment. Where Microsoft's documentation describes a
 * capability for a way of acting that the rules leave out, the entry says so, so a difference is not overstated.
 */
export function AccessChange({
  view,
  headingLevel = 3,
  showIntro = true,
}: {
  view: AccessChangeView;
  headingLevel?: 3 | 4;
  /** The page that hosts this view may already say what it is; the readout relies on the intro. */
  showIntro?: boolean;
}) {
  const copy = content.accessPatterns;
  const Heading = `h${headingLevel}` as 'h3' | 'h4';
  const labelOf = (id: string) => copy.patterns.find((p) => p.id === id)?.label ?? id;
  const nameOf = (id: string) => content.capabilities.find((c) => c.id === id)?.shortName ?? id;
  const labels = (ids: readonly string[], format = orFormat) => format.format(ids.map(labelOf));
  return (
    <div className={styles.root}>
      {showIntro && <p>{copy.changeIntro}</p>}
      {view.current.length > 0 && (
        <p className={styles.current}>
          {renderTemplate(copy.thisAgent, { label: labels(view.current, andFormat) })}
        </p>
      )}
      {!view.differs && <p>{copy.changeNone}</p>}
      {view.only.map((group) => {
        const mine = group.patterns.some((id) => view.current.includes(id));
        return (
          <section key={group.patterns.join('|')} className={styles.group}>
            <Heading>
              {renderTemplate(copy.changeOnly, { label: labels(group.patterns) })}{' '}
              {mine && <Badge tone="info">{copy.currentBadge}</Badge>}
            </Heading>
            <ul className={styles.items}>
              {group.entries.map((entry) => (
                <li key={entry.capabilityId}>
                  <Link to={`/capabilities/${entry.capabilityId}`}>
                    {nameOf(entry.capabilityId)}
                  </Link>
                  {entry.alsoDocumented.length > 0 && (
                    <span className={styles.also}>
                      {' '}
                      {renderTemplate(copy.changeAlso, { label: labels(entry.alsoDocumented) })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section className={styles.group}>
        <Heading>
          {copy.changeBoth} ({view.shared.length})
        </Heading>
        <p className={styles.list}>
          {view.shared.map((id, index) => (
            <Fragment key={id}>
              {index > 0 && ', '}
              <Link to={`/capabilities/${id}`}>{nameOf(id)}</Link>
            </Fragment>
          ))}
        </p>
      </section>
    </div>
  );
}
