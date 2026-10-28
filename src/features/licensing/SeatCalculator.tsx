import { useId, useMemo, useState } from 'react';
import { Badge, type BadgeTone } from '../../components/Badge.tsx';
import { SourceNote } from '../../components/SourceNote.tsx';
import { content } from '../../lib/content/index.ts';
import type { PlanStanding } from '../../lib/content/schemas.ts';
import { seatsCsv, seatsMarkdown, warningTexts } from '../../lib/content/seats-export.ts';
import { calculateSeats, parseCount, type SeatInputs } from '../../lib/engine/seats.ts';
import { downloadText } from '../../lib/readout/files.ts';
import styles from './SeatCalculator.module.css';

const STANDING_TONE: Record<PlanStanding, BadgeTone> = {
  included: 'info',
  qualifies: 'info',
  'does-not-qualify': 'amber',
  unknown: 'neutral',
};

type Values = Record<string, string>;
const seatKey = (id: string) => `seat:${id}`;

/**
 * Sizes Agent 365 licenses from counts the seller enters. The arithmetic is in engine/seats.ts and the words are in
 * licensing.yaml. Nothing is stored: the numbers belong to the conversation, and the exports carry them away.
 */
export function SeatCalculator() {
  const copy = content.licensing.calculator;
  const { productTerms } = content.licensing.prerequisites;
  const baseId = useId();
  const [values, setValues] = useState<Values>({});
  const [copied, setCopied] = useState<string | null>(null);

  const inputs: SeatInputs = useMemo(
    () => ({
      delegating: parseCount(values.delegating ?? ''),
      owners: parseCount(values.owners ?? ''),
      overlap: parseCount(values.overlap ?? ''),
      everyone: parseCount(values.everyone ?? ''),
      seats: Object.fromEntries(
        copy.planFamilies.map((family) => [
          family.id,
          parseCount(values[seatKey(family.id)] ?? ''),
        ]),
      ),
      includedEstimate: parseCount(values.includedEstimate ?? ''),
      qualifyingEstimate: parseCount(values.qualifyingEstimate ?? ''),
    }),
    [values, copy.planFamilies],
  );
  const result = useMemo(() => calculateSeats(inputs, copy.planFamilies), [inputs, copy]);
  const warnings = warningTexts(copy, result);

  const set = (key: string) => (event: { target: { value: string } }) => {
    setCopied(null);
    setValues((previous) => ({ ...previous, [key]: event.target.value }));
  };
  const field = (key: string, label: string, hint?: string, placeholder?: string) => {
    const inputId = `${baseId}-${key.replace(':', '-')}`;
    return (
      <div className={styles.field} key={key}>
        <label htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={values[key] ?? ''}
          placeholder={placeholder}
          aria-describedby={hint === undefined ? undefined : `${inputId}-hint`}
          onChange={set(key)}
        />
        {hint !== undefined && (
          <p id={`${inputId}-hint`} className={styles.hint}>
            {hint}
          </p>
        )}
      </div>
    );
  };

  const copyMarkdown = async () => {
    const text = seatsMarkdown(content, inputs, result);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(copy.copied);
    } catch {
      setCopied(null);
    }
  };

  const shown = (value: number | null) => (value === null ? copy.notEntered : String(value));
  const needsFirst = result.needsPlan !== null && result.needsPlan > 0;

  return (
    <section id="calculator" aria-labelledby="calculator-heading" className={styles.section}>
      <h2 id="calculator-heading">{copy.heading}</h2>
      <p>{copy.intro}</p>
      <p className={styles.notice}>{copy.notice}</p>

      <fieldset className={styles.group}>
        <legend>{copy.peopleHeading}</legend>
        <div className={styles.fields}>
          {field('delegating', copy.people.delegating.label, copy.people.delegating.hint)}
          {field('owners', copy.people.owners.label, copy.people.owners.hint)}
          {field('overlap', copy.people.overlap.label, copy.people.overlap.hint)}
          {field('everyone', copy.people.everyone.label, copy.people.everyone.hint)}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>{copy.seatsHeading}</legend>
        <p className={styles.hint}>{copy.seatsIntro}</p>
        <ul className={styles.plans}>
          {copy.planFamilies.map((family) => (
            <li key={family.id} className={styles.plan}>
              {field(seatKey(family.id), family.label)}
              <p className={styles.standing}>
                <Badge tone={STANDING_TONE[family.standing]}>
                  {copy.standings[family.standing]}
                </Badge>
              </p>
              <p className={styles.hint}>{family.text}</p>
              <SourceNote
                sourceIds={family.sourceIds}
                evidence={family.evidence}
                lastVerified={family.lastVerified}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      <div aria-labelledby={`${baseId}-results`} role="group" className={styles.results}>
        <h3 id={`${baseId}-results`}>{copy.resultsHeading}</h3>
        {result.required === null && <p className={styles.hint}>{copy.waiting}</p>}
        <dl className={styles.list}>
          <div>
            <dt>{copy.results.required.label}</dt>
            <dd>
              <span className={styles.number}>{shown(result.required)}</span>
              <span className={styles.basis}>{copy.results.required.basis}</span>
              <SourceNote
                sourceIds={copy.results.required.sourceIds}
                evidence={copy.results.required.evidence}
                lastVerified={copy.results.required.lastVerified}
              />
            </dd>
          </div>
          <div>
            <dt>{copy.results.recommended.label}</dt>
            <dd>
              <span className={styles.number}>{shown(result.recommended)}</span>
              <span className={styles.basis}>{copy.results.recommended.basis}</span>
              <SourceNote
                sourceIds={copy.results.recommended.sourceIds}
                evidence={copy.results.recommended.evidence}
                lastVerified={copy.results.recommended.lastVerified}
              />
            </dd>
          </div>
          <div>
            <dt>{copy.results.included.label}</dt>
            <dd>
              <span className={styles.number}>{shown(result.included)}</span>
              <span className={styles.basis}>{copy.results.included.basis}</span>
              {field(
                'includedEstimate',
                `${copy.estimateLabel}: ${copy.results.included.label}`,
                undefined,
                result.included === null ? undefined : String(result.included),
              )}
            </dd>
          </div>
          <div>
            <dt>{copy.results.qualifying.label}</dt>
            <dd>
              <span className={styles.number}>{shown(result.qualifying)}</span>
              <span className={styles.basis}>{copy.results.qualifying.basis}</span>
              {field(
                'qualifyingEstimate',
                `${copy.estimateLabel}: ${copy.results.qualifying.label}`,
                undefined,
                result.qualifying === null ? undefined : String(result.qualifying),
              )}
            </dd>
          </div>
          <div>
            <dt>{copy.results.needsPlan.label}</dt>
            <dd>
              <span className={styles.number}>{shown(result.needsPlan)}</span>
              <span className={styles.basis}>{copy.results.needsPlan.basis}</span>
            </dd>
          </div>
          <div>
            <dt>{copy.results.toAdd.label}</dt>
            <dd>
              <span className={styles.number}>{shown(result.toAdd)}</span>
              <span className={styles.basis}>{copy.results.toAdd.basis}</span>
            </dd>
          </div>
        </dl>
        <div role="status" className={styles.warnings}>
          {warnings.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      </div>

      {needsFirst && (
        <div className={styles.first}>
          <h3>{copy.firstHeading}</h3>
          <p>{copy.firstIntro}</p>
          <ul className={styles.plain}>
            {productTerms.plans.map((plan) => (
              <li key={plan}>{plan}</li>
            ))}
          </ul>
          <SourceNote
            sourceIds={productTerms.sourceIds}
            evidence={productTerms.evidence}
            lastVerified={productTerms.lastVerified}
          />
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" onClick={() => void copyMarkdown()}>
          {copy.copy}
        </button>
        <button
          type="button"
          onClick={() =>
            downloadText(
              'agent-365-license-sizing.csv',
              seatsCsv(content, inputs, result),
              'text/csv;charset=utf-8',
            )
          }
        >
          {copy.download}
        </button>
        <button type="button" onClick={() => setValues({})}>
          {copy.reset}
        </button>
        <span role="status" className={styles.copied}>
          {copied ?? ''}
        </span>
      </div>
    </section>
  );
}
