import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useBlocker } from 'react-router';
import { DiagnosticContext } from '../../lib/state/diagnostics.ts';
import {
  loadDiagnostics,
  resetDiagnostics,
  saveDiagnostics,
} from '../../lib/state/diagnostic-storage.ts';
import type { DiagnosticWorkspace } from '../../lib/state/diagnostic-model.ts';
import { DIAGNOSTIC_STORAGE_KEY } from '../../lib/state/diagnostic-storage.ts';
import { STORAGE_PREFIX } from '../../lib/state/storage.ts';
import { content } from '../../lib/content/index.ts';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import styles from './Diagnostic.module.css';

export function Component() {
  const [state, setState] = useState(loadDiagnostics);
  const latest = useRef(state);
  const [confirm, setConfirm] = useState<'reload' | 'reset' | null>(null);
  const copy = content.site.diagnostic;
  const publish = useCallback((next: typeof state) => {
    latest.current = next;
    setState(next);
  }, []);
  const change = useCallback(
    (edit: (draft: DiagnosticWorkspace) => void) => {
      const draft = structuredClone(latest.current.data);
      edit(draft);
      draft.revision = crypto.randomUUID();
      publish(saveDiagnostics(latest.current, draft));
    },
    [publish],
  );
  const retry = useCallback(
    () => publish(saveDiagnostics(latest.current, latest.current.data)),
    [publish],
  );
  const reload = useCallback(() => publish(loadDiagnostics()), [publish]);
  const reset = useCallback(() => publish(resetDiagnostics(latest.current)), [publish]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_PREFIX + DIAGNOSTIC_STORAGE_KEY) return;
      if (latest.current.dirty) publish({ ...latest.current, error: 'conflict' });
      else reload();
    };
    const onUnload = (event: BeforeUnloadEvent) => {
      if (latest.current.dirty) event.preventDefault();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [publish, reload]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      state.dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  const errorCopy =
    state.error === 'invalid'
      ? copy.storageInvalid
      : state.error === 'quota'
        ? copy.storageQuota
        : state.error === 'conflict'
          ? copy.storageConflict
          : copy.storageUnavailable;
  const recovery = state.recoveryRaw !== null;
  return (
    <DiagnosticContext value={{ ...state, change, retry, reload, reset }}>
      {recovery && (
        <PageContainer>
          <PageHeading>{content.site.routes.diagnostic.title}</PageHeading>
        </PageContainer>
      )}
      {state.error && (
        <div className={styles.storageNotice}>
          <p role="alert">
            {errorCopy}
            {state.dirty && <> {copy.unsaved}</>}
          </p>
          {!recovery && (
            <button type="button" onClick={retry}>
              {copy.retry}
            </button>
          )}
          <button type="button" onClick={() => (state.dirty ? setConfirm('reload') : reload())}>
            {copy.reload}
          </button>
          {recovery && (
            <>
              {state.error !== 'invalid' && <p>{copy.storageInvalid}</p>}
              <details>
                <summary>{copy.recovery}</summary>
                <textarea aria-label={copy.recovery} readOnly value={state.recoveryRaw ?? ''} />
              </details>
              <button type="button" onClick={() => setConfirm('reset')}>
                {copy.reset}
              </button>
            </>
          )}
        </div>
      )}
      {!recovery && <Outlet />}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'reset' ? copy.resetTitle : copy.leaveTitle}
        body={confirm === 'reset' ? copy.resetBody : copy.leaveBody}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === 'reset') reset();
          else reload();
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title={copy.leaveTitle}
        body={copy.leaveBody}
        confirmLabel={copy.leave}
        onCancel={() => {
          if (blocker.state === 'blocked') blocker.reset();
        }}
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </DiagnosticContext>
  );
}
