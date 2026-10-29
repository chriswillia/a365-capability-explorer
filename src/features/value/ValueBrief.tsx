import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AudienceToggle } from '../../components/AudienceToggle.tsx';
import { content } from '../../lib/content/index.ts';
import {
  briefText,
  buildBrief,
  defaultConcerns,
  parseConcerns,
  themeViews,
} from '../../lib/content/value.ts';
import { useAudience } from '../../lib/state/audience.ts';
import styles from './ValueBrief.module.css';

const views = themeViews(content);

/**
 * A value brief for one customer, built from the outcomes the seller chooses. The choice lives in the address
 * (no personal data), and the customer name stays in memory: it is never stored or placed in the address.
 */
export function ValueBrief() {
  const { audience } = useAudience();
  const [params, setParams] = useSearchParams();
  const copy = content.value.brief;
  const { badges } = content.site.ui;
  const [customer, setCustomer] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const raw = params.get('concerns');
  const selected = useMemo(
    () => parseConcerns(raw, content) ?? defaultConcerns(content, audience),
    [raw, audience],
  );
  const brief = useMemo(
    () => buildBrief(content, { audience, themeIds: selected, customer }),
    [audience, selected, customer],
  );
  const text = useMemo(() => briefText(content, brief), [brief]);

  const toggle = (id: string, checked: boolean) => {
    const next = views
      .map((view) => view.theme.id)
      .filter((themeId) => (themeId === id ? checked : selected.includes(themeId)));
    setParams(
      (previous) => {
        const updated = new URLSearchParams(previous);
        updated.set('concerns', next.length === 0 ? 'none' : next.join(','));
        return updated;
      },
      { replace: true, preventScrollReset: true, flushSync: true },
    );
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
    } catch {
      setCopiedText(null);
    }
  };

  return (
    <section id="brief" aria-labelledby="brief-heading" className={styles.section}>
      <div data-no-print className={styles.builder}>
        <h2 id="brief-heading">{copy.heading}</h2>
        <p>{copy.intro}</p>
        <AudienceToggle />
        <div className={styles.field}>
          <label htmlFor="brief-customer">{copy.customerLabel}</label>
          <input
            id="brief-customer"
            type="text"
            value={customer}
            maxLength={120}
            autoComplete="off"
            aria-describedby="brief-customer-hint"
            onChange={(event) => setCustomer(event.target.value)}
          />
          <span id="brief-customer-hint" className={styles.hint}>
            {copy.customerHint}
          </span>
        </div>
        <fieldset className={styles.concerns}>
          <legend>{copy.concernsLegend}</legend>
          {views.map((view) => (
            <label key={view.theme.id} className={styles.concern}>
              <input
                type="checkbox"
                checked={selected.includes(view.theme.id)}
                onChange={(event) => toggle(view.theme.id, event.target.checked)}
              />
              <span>{view.theme.title}</span>
            </label>
          ))}
        </fieldset>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={brief.outcomes.length === 0}
          >
            {copy.print}
          </button>
          <button type="button" onClick={copyText} disabled={brief.outcomes.length === 0}>
            {copy.copy}
          </button>
          <span role="status">{copiedText === text ? copy.copied : ''}</span>
        </div>
      </div>
      <article className={styles.brief} data-print-document aria-labelledby="brief-title">
        <h3 id="brief-title">{brief.title}</h3>
        <p>{brief.audienceLine}</p>
        {brief.outcomes.length === 0 ? (
          <p>{copy.emptyNote}</p>
        ) : (
          <>
            <h4>{brief.outcomesHeading}</h4>
            <ul className={styles.outcomes}>
              {brief.outcomes.map((outcome) => (
                <li key={outcome.id}>
                  <strong>{outcome.title}.</strong> {outcome.outcome}
                  <ul>
                    {outcome.angles.map((angle) => (
                      <li key={angle.label}>
                        <em>{angle.label}:</em> {angle.text}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <h4>{brief.capabilitiesHeading}</h4>
            <ul className={styles.capabilities}>
              {brief.capabilities.map((capability) => (
                <li key={capability.id}>
                  {capability.shortName}{' '}
                  <span className={styles.meta}>
                    ({capability.productArea};{' '}
                    {capability.tier === 'foundational' ? badges.foundational : badges.premium}
                    {capability.sourcesDiffer && `; ${badges.sourcesDiffer}`})
                  </span>
                </li>
              ))}
            </ul>
            <p>{brief.licensingLine}</p>
            <h4>{brief.nextHeading}</h4>
            <ol>
              {brief.nextItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <p className={styles.footnote}>{brief.footnote}</p>
          </>
        )}
      </article>
    </section>
  );
}
