import { useEffect, useRef, useState } from 'react';
import { content } from '../../lib/content/index.ts';
import type { Assessment } from '../../lib/state/diagnostic-model.ts';
import { useDiagnostics } from '../../lib/state/diagnostics.ts';
import { LogoError, normalizeLogo } from '../../lib/state/logo.ts';
import styles from './Readout.module.css';

export function BrandingEditor({ assessment }: { assessment: Assessment }) {
  const { change } = useDiagnostics();
  const copy = content.site.readout.branding;
  const [alt, setAlt] = useState(assessment.logo?.alt ?? '');
  const [error, setError] = useState<LogoError['reason'] | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const updateAlt = (value: string) => {
    setAlt(value);
    if (!assessment.logo) return;
    if (!value.trim()) {
      setError('format');
      return;
    }
    setError(null);
    change((draft) => {
      const item = draft.assessments.find((a) => a.id === assessment.id)!;
      if (item.logo) {
        item.logo.alt = value.trim();
        item.updatedAt = new Date().toISOString();
      }
    });
  };
  const choose = async (file: File) => {
    const current = ++generation.current;
    setBusy(true);
    setError(null);
    try {
      const logo = await normalizeLogo(file, alt);
      if (current !== generation.current) return;
      change((draft) => {
        const item = draft.assessments.find((a) => a.id === assessment.id)!;
        item.logo = logo;
        item.updatedAt = new Date().toISOString();
      });
    } catch (error) {
      if (!(error instanceof LogoError)) throw error;
      if (current === generation.current) setError(error.reason);
    } finally {
      if (current === generation.current) setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <fieldset className={styles.branding} data-no-print aria-busy={busy}>
      <legend>{copy.title}</legend>
      <p id="logo-note">{copy.note}</p>
      <label htmlFor="logo-alt">{copy.alt}</label>
      <input
        id="logo-alt"
        type="text"
        maxLength={120}
        value={alt}
        disabled={busy}
        aria-describedby="logo-note"
        onChange={(event) => updateAlt(event.target.value)}
      />
      <label htmlFor="assessment-logo">{copy.choose}</label>
      <input
        id="assessment-logo"
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        disabled={busy}
        aria-describedby="logo-note"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void choose(file);
        }}
      />
      {assessment.logo && (
        <button
          type="button"
          onClick={() => {
            generation.current++;
            setBusy(false);
            setError(null);
            change((draft) => {
              const item = draft.assessments.find((a) => a.id === assessment.id)!;
              delete item.logo;
              item.updatedAt = new Date().toISOString();
            });
          }}
        >
          {copy.remove}
        </button>
      )}
      {error && <p role="alert">{copy.errors[error]}</p>}
    </fieldset>
  );
}
