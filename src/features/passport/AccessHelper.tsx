import { useId, useState } from 'react';
import { content } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { classifyAccess, type AccessHelperInput } from '../../lib/engine/passport.ts';
import styles from './PassportPage.module.css';

const FIELDS = ['actsForPerson', 'runsAlone', 'ownAccount'] as const;

/**
 * Three yes/no questions that settle how an agent acts, for a seller who is not sure. It only suggests an answer:
 * the seller chooses whether to use it.
 */
export function AccessHelper({ onUse }: { onUse: (answer: string) => void }) {
  const copy = content.passport.helper;
  const baseId = useId();
  const [input, setInput] = useState<AccessHelperInput>({
    actsForPerson: null,
    runsAlone: null,
    ownAccount: null,
  });
  const outcome = classifyAccess(input);
  const options = content.questions.find((question) => question.id === 'accessModel')!.options;
  const label =
    outcome === null || outcome === 'unclear'
      ? undefined
      : options.find((option) => option.value === outcome)?.label;

  return (
    <details className={styles.helper}>
      <summary>{copy.heading}</summary>
      <p className={styles.hint}>{copy.note}</p>
      {FIELDS.map((field) => (
        <fieldset key={field} className={styles.yesNo}>
          <legend>{copy.questions[field]}</legend>
          {[true, false].map((value) => (
            <label key={String(value)} className={styles.choice}>
              <input
                type="radio"
                name={`${baseId}-${field}`}
                checked={input[field] === value}
                onChange={() => setInput((previous) => ({ ...previous, [field]: value }))}
              />
              {value ? copy.yes : copy.no}
            </label>
          ))}
        </fieldset>
      ))}
      {outcome !== null && (
        <div role="status" className={styles.outcome}>
          <p>{copy.outcomes[outcome]}</p>
          {label !== undefined && outcome !== 'unclear' && (
            <button type="button" onClick={() => onUse(outcome)}>
              {renderTemplate(copy.use, { label })}
            </button>
          )}
        </div>
      )}
    </details>
  );
}
