import { useSyncExternalStore } from 'react';
import type { Assessment, DiagnosticWorkspace, Organization } from './diagnostic-model.ts';
import { DIAGNOSTIC_STORAGE_KEY, loadDiagnostics } from './diagnostic-storage.ts';
import { readStored, STORAGE_PREFIX } from './storage.ts';

/**
 * Read-only access to the saved customers and assessments, for pages that only show them. Pages that edit
 * them use the diagnostics provider. It never writes.
 */
let cache: { raw: string | null; data: DiagnosticWorkspace } | undefined;
const snapshot = (): DiagnosticWorkspace => {
  const raw = readStored(DIAGNOSTIC_STORAGE_KEY);
  if (cache === undefined || cache.raw !== raw) cache = { raw, data: loadDiagnostics().data };
  return cache.data;
};
// Another tab saving fires a storage event. Work on this page is picked up when the page renders again.
const subscribe = (notify: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_PREFIX + DIAGNOSTIC_STORAGE_KEY) notify();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
};

export const useSavedWorkspace = (): DiagnosticWorkspace =>
  useSyncExternalStore(subscribe, snapshot);

/** The most recent change to a customer or to any of its assessments. */
export const touched = (customer: Organization, assessments: Assessment[]): string =>
  [customer.updatedAt, ...assessments.map((a) => a.updatedAt)].sort().at(-1) ?? '';

/** Customers with their assessments, most recently touched first. Each customer's assessments are newest first. */
export function recentCustomers(
  data: DiagnosticWorkspace,
): { customer: Organization; assessments: Assessment[] }[] {
  return data.organizations
    .map((customer) => ({
      customer,
      assessments: data.assessments
        .filter((a) => a.organizationId === customer.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }))
    .sort((a, b) =>
      touched(b.customer, b.assessments).localeCompare(touched(a.customer, a.assessments)),
    );
}
