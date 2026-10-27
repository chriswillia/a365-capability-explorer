import { useState } from 'react';
import { content, contentMeta } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { downloadText } from '../../lib/readout/files.ts';
import {
  appendDiagnosticBundle,
  diagnosticBundle,
  MAX_IMPORT_BYTES,
  parseDiagnosticBundle,
  type DiagnosticBundle,
  type ImportFailure,
} from '../../lib/state/diagnostic-transfer.ts';
import { useDiagnostics } from '../../lib/state/diagnostics.ts';
import styles from './Diagnostic.module.css';

export function DiagnosticTransfer({ assessmentIds }: { assessmentIds?: readonly string[] }) {
  const store = useDiagnostics();
  const copy = content.site.readout;
  const [pending, setPending] = useState<DiagnosticBundle | null>(null);
  const [error, setError] = useState<ImportFailure | 'export' | 'export-size' | null>(null);
  const [reading, setReading] = useState(false);
  const [imported, setImported] = useState(false);

  const read = async (file: File) => {
    setError(null);
    setPending(null);
    setImported(false);
    if (file.size > MAX_IMPORT_BYTES) {
      setError('size');
      return;
    }
    setReading(true);
    try {
      const result = parseDiagnosticBundle(await file.text());
      if (result.ok) setPending(result.bundle);
      else setError(result.error);
    } catch (error) {
      if (!(error instanceof DOMException)) throw error;
      setError('read');
    } finally {
      setReading(false);
    }
  };

  return (
    <section aria-labelledby="transfer-title">
      <h2 id="transfer-title">{copy.import}</h2>
      <p className={styles.note}>{copy.importNote}</p>
      <p className={styles.note}>{copy.sharingNote}</p>
      <div className={styles.controls}>
        <button
          type="button"
          disabled={assessmentIds !== undefined && assessmentIds.length === 0}
          onClick={() => {
            setError(null);
            try {
              const raw = JSON.stringify(
                diagnosticBundle(store.data, contentMeta.contentVersion, assessmentIds),
                null,
                2,
              );
              if (new TextEncoder().encode(raw).byteLength > MAX_IMPORT_BYTES) {
                setError('export-size');
                return;
              }
              downloadText(
                assessmentIds === undefined ? 'a365-workspace.json' : 'a365-portfolio.json',
                raw,
                'application/json',
              );
            } catch (error) {
              if (!(error instanceof DOMException || error instanceof TypeError)) throw error;
              setError('export');
            }
          }}
        >
          {assessmentIds === undefined ? copy.backup : content.site.portfolio.export}
        </button>
        <div>
          <label htmlFor="diagnostic-import">{copy.import}</label>
          <input
            id="diagnostic-import"
            type="file"
            accept=".json,application/json"
            disabled={reading}
            aria-busy={reading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) void read(file);
            }}
          />
        </div>
      </div>
      {error && (
        <p role="alert">
          {error === 'export'
            ? copy.exportError
            : error === 'export-size'
              ? copy.exportTooLarge
              : copy.importErrors[error]}
        </p>
      )}
      {pending && (
        <div className={styles.card}>
          <p>
            {renderTemplate(copy.importConfirm, { count: pending.workspace.assessments.length })}
          </p>
          <p>
            {content.site.diagnostic.organization}: {pending.workspace.organizations.length} ·{' '}
            {content.site.diagnostic.assessments}: {pending.workspace.assessments.length}
          </p>
          <p>
            {content.site.diagnostic.currentContent}: <code>{pending.contentVersion}</code>
          </p>
          <div className={styles.actions}>
            <button type="button" onClick={() => setPending(null)}>
              {copy.cancelImport}
            </button>
            <button
              type="button"
              onClick={() => {
                store.change((draft) => {
                  const merged = appendDiagnosticBundle(draft, pending);
                  draft.organizations = merged.organizations;
                  draft.assessments = merged.assessments;
                });
                setPending(null);
                setImported(true);
              }}
            >
              {copy.applyImport}
            </button>
          </div>
        </div>
      )}
      {imported && (
        <p role="status">
          {store.dirty || store.error ? content.site.diagnostic.unsaved : copy.importSuccess}
        </p>
      )}
    </section>
  );
}
