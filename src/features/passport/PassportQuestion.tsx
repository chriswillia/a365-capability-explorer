import { useId, type ReactNode } from 'react';
import { content } from '../../lib/content/index.ts';
import type { Answers } from '../../lib/content/schemas.ts';
import { knownAnswer } from '../../lib/engine/answers.ts';
import styles from './PassportPage.module.css';

/**
 * One of the six questions, in the seller's words. The options and the answer values are the diagnostic question's,
 * so what is saved here is what Full discovery and the rules read.
 */
export function PassportQuestion({
  number,
  id,
  ask,
  hint,
  answer,
  onChange,
  children,
}: {
  number: number;
  id: string;
  ask: string;
  hint: string;
  answer: Answers[string] | undefined;
  onChange: (answer: Answers[string]) => void;
  children?: ReactNode;
}) {
  const question = content.questions.find((candidate) => candidate.id === id)!;
  const unknown = content.site.diagnostic.unknown;
  const baseId = useId();
  const hintId = `${baseId}-hint`;
  const text = typeof answer === 'string' && knownAnswer(answer) ? answer : '';
  const choices = Array.isArray(answer) ? answer : [];
  const setChoice = (value: string, checked: boolean) => {
    const next = checked
      ? value === 'none'
        ? ['none']
        : [...choices.filter((item) => item !== 'none' && item !== 'unknown'), value]
      : choices.filter((item) => item !== value);
    onChange(next.length === 0 ? null : next);
  };

  return (
    <li className={styles.question}>
      <fieldset className={styles.field} aria-describedby={hintId}>
        <legend>
          <span className={styles.number}>{number}.</span> {ask}
        </legend>
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
        {question.type === 'multi' ? (
          <>
            {question.options.map((option) => (
              <label key={option.value} className={styles.choice}>
                <input
                  type="checkbox"
                  checked={choices.includes(option.value)}
                  onChange={(event) => setChoice(option.value, event.target.checked)}
                />
                {option.label}
              </label>
            ))}
            <button
              type="button"
              className={styles.unsure}
              aria-pressed={!knownAnswer(answer)}
              onClick={() => onChange(null)}
            >
              {unknown}
            </button>
          </>
        ) : (
          <select
            aria-label={ask}
            aria-describedby={hintId}
            value={text}
            onChange={(event) => onChange(event.target.value || null)}
          >
            <option value="">{unknown}</option>
            {question.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </fieldset>
      {children}
    </li>
  );
}
