import { Link } from 'react-router';
import { content } from '../lib/content/index.ts';
import { renderTemplate } from '../lib/content/template.ts';
import { agentLabel } from '../lib/state/working.ts';
import { useSavedWorkspace } from '../lib/state/workspace.ts';
import styles from './AgentBackLink.module.css';

/**
 * The way back to an agent's passport from any page for that agent, so a seller is never more than a click from
 * where its steps start. It shows nothing when the agent is not saved in this browser.
 */
export function AgentBackLink({ assessmentId }: { assessmentId: string | null | undefined }) {
  const data = useSavedWorkspace();
  const agent = data.assessments.find((candidate) => candidate.id === assessmentId);
  const customer = data.organizations.find((candidate) => candidate.id === agent?.organizationId);
  if (agent === undefined || customer === undefined) return null;

  return (
    <p className={styles.back} data-no-print>
      <Link to={{ pathname: '/map', search: `?assessment=${agent.id}`, hash: '#passport-heading' }}>
        {renderTemplate(content.site.ui.working.back, { name: agentLabel(customer, agent) })}
      </Link>
    </p>
  );
}
