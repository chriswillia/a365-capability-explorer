import { content } from '../../lib/content/index.ts';
import type { Answers, Question } from '../../lib/content/schemas.ts';
import { knownAnswer } from '../../lib/engine/answers.ts';
import styles from './Diagnostic.module.css';

export function QuestionInput({
  question: q,
  answer,
  onChange,
}: {
  question: Question;
  answer: Answers[string] | undefined;
  onChange: (answer: Answers[string]) => void;
}) {
  const copy = content.site.diagnostic;
  const id = `question-${q.id}`;
  const text = typeof answer === 'string' && knownAnswer(answer) ? answer : '';
  const choices = Array.isArray(answer) ? answer : [];
  const setChoice = (value: string, checked: boolean) => {
    const next = checked
      ? value === 'none'
        ? ['none']
        : [...choices.filter((v) => v !== 'none' && v !== 'unknown'), value]
      : choices.filter((v) => v !== value);
    onChange(next.length === 0 ? null : next);
  };
  return (
    <fieldset className={styles.field} id={id}>
      <legend>{q.label}</legend>
      {q.type === 'multi' ? (
        <>
          {q.options.map((o) => (
            <label key={o.value}>
              <input
                type="checkbox"
                checked={choices.includes(o.value)}
                onChange={(e) => setChoice(o.value, e.target.checked)}
              />
              {o.label}
            </label>
          ))}
          <button type="button" aria-pressed={!knownAnswer(answer)} onClick={() => onChange(null)}>
            {copy.unknown}
          </button>
        </>
      ) : q.type === 'single' || q.type === 'scale' ? (
        <select
          aria-label={q.label}
          aria-describedby={`${id}-hint`}
          value={text}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">{copy.unknown}</option>
          {q.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <>
          {q.type === 'longtext' ? (
            <textarea
              aria-label={q.label}
              aria-describedby={`${id}-hint`}
              maxLength={q.maxLength}
              value={text}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <input
              aria-label={q.label}
              aria-describedby={`${id}-hint`}
              type={q.type === 'date' ? 'date' : 'text'}
              maxLength={q.maxLength}
              value={text}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
          <button type="button" aria-pressed={!knownAnswer(answer)} onClick={() => onChange(null)}>
            {copy.unknown}
          </button>
        </>
      )}
      <p className={styles.note} id={`${id}-hint`}>
        {q.ifUnknown}
      </p>
      <details>
        <summary>{copy.why}</summary>
        <p>{content.diagnostic.consultantNotes[q.id]}</p>
      </details>
    </fieldset>
  );
}
