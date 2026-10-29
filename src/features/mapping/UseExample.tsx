import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ActionButton } from '../../components/ButtonLink.tsx';
import { content } from '../../lib/content/index.ts';
import { displayName } from '../../lib/state/diagnostic-model.ts';
import {
  defaultCustomerId,
  NEW_CUSTOMER,
  startFromExample,
} from '../../lib/state/start-from-example.ts';
import { touched, useSavedWorkspace } from '../../lib/state/workspace.ts';
import styles from './UseExample.module.css';

/**
 * Turns an example into the seller's own agent in one click: it saves a copy for a customer, with the example's
 * answers marked as assumptions, and opens its passport. Saving is the click itself, never a side effect of
 * opening the page. A seller with saved customers says which one it is for.
 */
export function UseExample({ patternId, sampleId }: { patternId: string; sampleId?: string }) {
  const copy = content.site.mapping.use;
  const { diagnostic, ui } = content.site;
  const navigate = useNavigate();
  const data = useSavedWorkspace();
  const [chosen, setChosen] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const customers = data.organizations
    .map((customer) => ({
      customer,
      at: touched(
        customer,
        data.assessments.filter((a) => a.organizationId === customer.id),
      ),
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
  const customerId =
    chosen !== null && (chosen === NEW_CUSTOMER || customers.some((c) => c.customer.id === chosen))
      ? chosen
      : defaultCustomerId(data);

  const start = () => {
    const result = startFromExample({
      patternId,
      ...(sampleId === undefined ? {} : { sampleId }),
      customerId,
    });
    if (!result.ok) {
      setFailed(true);
      return;
    }
    navigate(`/map?assessment=${result.assessmentId}`);
  };

  return (
    <div className={styles.use}>
      {customers.length > 0 && (
        <div className={styles.field}>
          <label htmlFor="use-customer">{copy.customerLabel}</label>
          <select
            id="use-customer"
            value={customerId}
            onChange={(event) => setChosen(event.target.value)}
          >
            {customers.map(({ customer }) => (
              <option key={customer.id} value={customer.id}>
                {displayName(customer.answers, 'orgName', diagnostic.untitledOrganization)}
                {customer.sample === true ? ` (${ui.sample.chip})` : ''}
              </option>
            ))}
            <option value={NEW_CUSTOMER}>{copy.newCustomer}</option>
          </select>
        </div>
      )}
      <ActionButton onClick={start} describedBy="use-hint">
        {copy.button}
      </ActionButton>
      <p id="use-hint" className={styles.hint}>
        {copy.hint}
      </p>
      {failed && (
        <p role="alert" className={styles.error}>
          {copy.error}
        </p>
      )}
    </div>
  );
}
