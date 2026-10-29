import { matchPath } from 'react-router';
import { content } from '../content/index.ts';
import {
  displayName,
  type Assessment,
  type DiagnosticWorkspace,
  type Organization,
} from './diagnostic-model.ts';

// Pages that carry an agent in the path, and pages that carry one in the query.
const PATH_PATTERNS = ['/diagnostic/:id/*', '/canvas/:id', '/leave-behind/:id'];
const QUERY_PATHS = ['/map', '/licensing', '/deploy', '/access'];

/**
 * How a seller names an agent: its customer and its name. A customer with no name yet is left out, so the agent's
 * name is what shows.
 */
export function agentLabel(customer: Organization, agent: Assessment): string {
  const { diagnostic } = content.site;
  const customerName = displayName(customer.answers, 'orgName', '');
  const agentName = displayName(agent.answers, 'useCaseName', diagnostic.untitledAssessment);
  return customerName === '' ? agentName : `${customerName} · ${agentName}`;
}

/** The id of the agent an address is about, when it names one. */
export function agentInAddress(pathname: string, search: string): string | null {
  for (const pattern of PATH_PATTERNS) {
    const id = matchPath(pattern, pathname)?.params.id;
    if (id !== undefined) return id;
  }
  if (QUERY_PATHS.some((path) => matchPath({ path, end: true }, pathname) !== null))
    return new URLSearchParams(search).get('assessment');
  return null;
}

const newest = (assessments: Assessment[]): Assessment | undefined =>
  [...assessments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

/**
 * The agent a seller is working on: the one the page is about, otherwise the newest agent of the customer the
 * portfolio shows, otherwise the one changed most recently. It only reads, and is undefined before the first
 * agent is saved.
 */
export function currentAgent(
  data: DiagnosticWorkspace,
  pathname: string,
  search: string,
): Assessment | undefined {
  const named = data.assessments.find((a) => a.id === agentInAddress(pathname, search));
  if (named !== undefined) return named;
  const customerId = matchPath({ path: '/portfolio', end: true }, pathname)
    ? new URLSearchParams(search).get('customer')
    : null;
  const theirs = data.assessments.filter((a) => a.organizationId === customerId);
  return newest(theirs.length > 0 ? theirs : data.assessments);
}
