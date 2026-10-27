import { useEffect, useReducer, useRef, useSyncExternalStore } from 'react';
import { Link, matchPath, useLocation } from 'react-router';
import { content } from '../lib/content/index.ts';
import {
  displayName,
  type Assessment,
  type DiagnosticWorkspace,
  type Organization,
} from '../lib/state/diagnostic-model.ts';
import { DIAGNOSTIC_STORAGE_KEY, loadDiagnostics } from '../lib/state/diagnostic-storage.ts';
import { readStored, STORAGE_PREFIX } from '../lib/state/storage.ts';
import styles from './CurrentCustomer.module.css';

/** The most recent change to a customer or to any of its assessments. */
const touched = (customer: Organization, assessments: Assessment[]) =>
  [customer.updatedAt, ...assessments.map((a) => a.updatedAt)].sort().at(-1) ?? '';

function CustomerMenu({
  customer,
  assessments,
  onOpen,
}: {
  customer: Organization;
  assessments: Assessment[];
  onOpen: () => void;
}) {
  const copy = content.site.ui.customer;
  const diagnostic = content.site.diagnostic;
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const element = menu.current;
    if (element === null) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !element.open) return;
      element.open = false;
      element.querySelector('summary')?.focus();
    };
    element.addEventListener('keydown', close);
    return () => element.removeEventListener('keydown', close);
  }, []);
  return (
    <details
      ref={menu}
      className={styles.menu}
      onToggle={(event) => {
        if (event.currentTarget.open) onOpen();
      }}
    >
      <summary>
        {copy.label}:{' '}
        <strong>{displayName(customer.answers, 'orgName', diagnostic.untitledOrganization)}</strong>
      </summary>
      <div className={styles.panel}>
        <p className={styles.heading}>
          <strong>{copy.useCases}</strong>
        </p>
        {assessments.length === 0 ? (
          <p>{copy.empty}</p>
        ) : (
          <ul>
            {assessments.map((assessment) => (
              <li key={assessment.id}>
                <span>
                  {displayName(assessment.answers, 'useCaseName', diagnostic.untitledAssessment)}
                </span>
                <span className={styles.links}>
                  <Link to={`/diagnostic/${assessment.id}`}>{copy.edit}</Link>
                  <Link to={`/diagnostic/${assessment.id}/readout`}>{copy.readout}</Link>
                  <Link to={`/canvas/${assessment.id}`}>{copy.canvas}</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.links}>
          {assessments.length > 0 && (
            <Link to={`/portfolio?customer=${customer.id}`}>{copy.compare}</Link>
          )}
          <Link to="/diagnostic">{copy.switch}</Link>
        </p>
      </div>
    </details>
  );
}

/**
 * A shortcut to the customer a seller is working on: the customer of the open assessment, canvas or readout,
 * otherwise the one touched most recently. It only reads local storage and never writes.
 */
let cache: { raw: string | null; data: DiagnosticWorkspace } | undefined;
const snapshot = (): DiagnosticWorkspace => {
  const raw = readStored(DIAGNOSTIC_STORAGE_KEY);
  if (cache === undefined || cache.raw !== raw) cache = { raw, data: loadDiagnostics().data };
  return cache.data;
};
// Another tab saving fires a storage event. Work on this page is picked up when the header renders again.
const subscribe = (notify: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_PREFIX + DIAGNOSTIC_STORAGE_KEY) notify();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
};

export default function CurrentCustomer() {
  const { pathname } = useLocation();
  const data = useSyncExternalStore(subscribe, snapshot);
  const [, reread] = useReducer((count: number) => count + 1, 0);
  const routeId =
    matchPath('/diagnostic/:id/*', pathname)?.params.id ??
    matchPath('/canvas/:id', pathname)?.params.id;
  const opened = data.assessments.find((a) => a.id === routeId);
  const byCustomer = (customer: Organization) =>
    data.assessments.filter((a) => a.organizationId === customer.id);
  const customer =
    data.organizations.find((o) => o.id === opened?.organizationId) ??
    [...data.organizations].sort((a, b) =>
      touched(b, byCustomer(b)).localeCompare(touched(a, byCustomer(a))),
    )[0];
  if (customer === undefined) return null;
  const assessments = byCustomer(customer).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  // A new page starts with the menu closed: keying on the path remounts it, with no effect to wait for.
  return (
    <CustomerMenu key={pathname} customer={customer} assessments={assessments} onOpen={reread} />
  );
}
