import { Badge } from '../../components/Badge.tsx';
import { content } from '../../lib/content/index.ts';
import type { Answers, Question } from '../../lib/content/schemas.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { knownAnswer } from '../../lib/engine/answers.ts';
import { questionPillars } from '../../lib/engine/pillars.ts';
import styles from './Diagnostic.module.css';

const informs = questionPillars(content);
const pillarOrder = [...content.pillars].sort((a, b) => a.order - b.order);

export function QuestionInput({
  question: q,
  answer,
  onChange,
  assumed = false,
  onConfirm,
  compact = false,
}: {
  question: Question;
  answer: Answers[string] | undefined;
  onChange: (answer: Answers[string]) => void;
  /** The answer came from the starting scenario and has not been confirmed with the customer. */
  assumed?: boolean;
  onConfirm?: () => void;
  /** Only the label and the input: for a form that asks one question in passing. */
  compact?: boolean;
}) {
  const copy = content.site.diagnostic;
  const id = `question-${q.id}`;
  const text = typeof answer === 'string' && knownAnswer(answer) ? answer : '';
  const choices = Array.isArray(answer) ? answer : [];
  const affects = pillarOrder.filter((pillar) => informs.get(q.id)?.has(pillar.id) === true);
  const hint = compact ? undefined : `${id}-hint`;
  const setChoice = (value: string, checked: boolean) => {
    const next = checked
      ? value === 'none'
        ? ['none']
        : [...choices.filter((v) => v !== 'none' && v !== 'unknown'), value]
      : choices.filter((v) => v !== value);
    onChange(next.length === 0 ? null : next);
  };
  return (
    <fieldset className={styles.field} id={id} data-compact={compact ? '' : undefined}>
      <legend>{q.label}</legend>
      {!compact && (
        <p className={styles.ask}>
          <strong>{copy.askLabel}:</strong> “{content.diagnostic.askPrompts[q.id]}”
        </p>
      )}
      {!compact && affects.length > 0 && (
        <p className={styles.note}>
          {renderTemplate(content.site.mapping.informs, {
            label: affects.map((pillar) => pillar.requirement).join(', '),
          })}
        </p>
      )}
      {assumed && (
        <p className={styles.assumed}>
          <Badge tone="info">{copy.assumedBadge}</Badge>
          <button type="button" onClick={onConfirm}>
            {copy.confirmAnswer} <span className="visually-hidden">— {q.label}</span>
          </button>
        </p>
      )}
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
          aria-describedby={hint}
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
              aria-describedby={hint}
              maxLength={q.maxLength}
              value={text}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <input
              aria-label={q.label}
              aria-describedby={hint}
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
      {!compact && (
        <>
          <p className={styles.note} id={hint}>
            {q.ifUnknown}
          </p>
          <details>
            <summary>{copy.why}</summary>
            <p>{content.diagnostic.consultantNotes[q.id]}</p>
          </details>
        </>
      )}
    </fieldset>
  );
}
