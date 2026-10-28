import { useId, useState } from 'react';
import { content, pillarName } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { agendaText, discoveryAreas } from '../../lib/content/value.ts';
import styles from './ValuePage.module.css';

interface Pick {
  key: string;
  question: string;
}

const AREAS = discoveryAreas(content);

/**
 * Picks a handful of the questions the capabilities suggest and copies them as a meeting agenda. The picks live
 * on the page only: nothing is stored.
 */
export function DiscoveryPicker() {
  const copy = content.value.discovery;
  const baseId = useId();
  const [picked, setPicked] = useState<Pick[]>([]);
  const [copied, setCopied] = useState(false);
  const full = picked.length >= copy.limit;

  const toggle = (pick: Pick, checked: boolean) => {
    setCopied(false);
    setPicked((previous) =>
      checked
        ? previous.some((item) => item.key === pick.key) || previous.length >= copy.limit
          ? previous
          : [...previous, pick]
        : previous.filter((item) => item.key !== pick.key),
    );
  };
  const copyAgenda = async () => {
    try {
      await navigator.clipboard.writeText(agendaText(content, picked));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      id="questions"
      aria-labelledby="questions-heading"
      data-no-print
      className={styles.section}
    >
      <h2 id="questions-heading">{copy.heading}</h2>
      <p>{renderTemplate(copy.intro, { limit: copy.limit })}</p>
      <div className={styles.picker}>
        {AREAS.map((area) => (
          <details key={area.pillar.id} className={styles.objection}>
            <summary>
              {pillarName(area.pillar)} · {area.questions.length}
            </summary>
            <ul className={styles.pickList}>
              {area.questions.map((item) => {
                const id = `${baseId}-${item.key.replace(':', '-')}`;
                const isPicked = picked.some((pick) => pick.key === item.key);
                return (
                  <li key={item.key}>
                    <label htmlFor={id} className={styles.pickLabel}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={isPicked}
                        disabled={full && !isPicked}
                        onChange={(event) =>
                          toggle({ key: item.key, question: item.question }, event.target.checked)
                        }
                      />
                      <span>
                        {item.question} <span className={styles.meta}>({item.capability})</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>
      <p role="status" className={styles.meta}>
        {full
          ? renderTemplate(copy.limitReached, { limit: copy.limit })
          : renderTemplate(copy.counter, { count: picked.length, limit: copy.limit })}
      </p>
      <div className={styles.pickActions}>
        <button type="button" disabled={picked.length === 0} onClick={() => void copyAgenda()}>
          {copy.copy}
        </button>
        <button
          type="button"
          disabled={picked.length === 0}
          onClick={() => {
            setPicked([]);
            setCopied(false);
          }}
        >
          {copy.clear}
        </button>
        <span role="status" className={styles.meta}>
          {copied ? copy.copied : ''}
        </span>
      </div>
    </section>
  );
}
