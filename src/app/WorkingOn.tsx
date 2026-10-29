import { Link, useLocation } from 'react-router';
import { SampleChip } from '../components/SampleChip.tsx';
import { content } from '../lib/content/index.ts';
import { agentLabel, currentAgent } from '../lib/state/working.ts';
import { useSavedWorkspace } from '../lib/state/workspace.ts';
import styles from './WorkingOn.module.css';

/**
 * A link from every page to the agent a seller is working on: its customer and name, opening the agent passport
 * where every step for that agent starts. It reads local storage and never writes, so it loads after the first
 * paint and shows nothing until an agent is saved.
 */
export default function WorkingOn() {
  const { pathname, search } = useLocation();
  const data = useSavedWorkspace();
  const agent = currentAgent(data, pathname, search);
  const customer = data.organizations.find((o) => o.id === agent?.organizationId);
  if (agent === undefined || customer === undefined) return null;

  const names = agentLabel(customer, agent);
  const label = content.site.ui.working.label;
  const here = pathname === '/map' && new URLSearchParams(search).get('assessment') === agent.id;

  return (
    <Link
      to={{ pathname: '/map', search: `?assessment=${agent.id}`, hash: '#passport-heading' }}
      className={styles.chip}
      title={`${label}: ${names}`}
      aria-current={here ? 'page' : undefined}
    >
      {label}: <strong>{names}</strong>
      {customer.sample === true && (
        <>
          {' '}
          <SampleChip />
        </>
      )}
    </Link>
  );
}
