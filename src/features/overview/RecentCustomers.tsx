import { Link } from 'react-router';
import { content } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { displayName } from '../../lib/state/diagnostic-model.ts';
import { recentCustomers, useSavedWorkspace } from '../../lib/state/workspace.ts';
import styles from './OverviewPage.module.css';

const LIMIT = 3;

/** The customers a seller worked on most recently, read from this browser. Nothing shows before the first one. */
export default function RecentCustomers() {
  const copy = content.site.overview.recent;
  const untitled = content.site.diagnostic.untitledOrganization;
  const customers = recentCustomers(useSavedWorkspace()).slice(0, LIMIT);
  if (customers.length === 0) return null;

  return (
    <section aria-labelledby="recent-heading" className={styles.section}>
      <h2 id="recent-heading">{copy.heading}</h2>
      <ul className={styles.recent}>
        {customers.map(({ customer, assessments }) => {
          const latest = assessments[0];
          return (
            <li key={customer.id} className={styles.customer}>
              <h3>{displayName(customer.answers, 'orgName', untitled)}</h3>
              <p>{renderTemplate(copy.useCases, { count: assessments.length })}</p>
              <p className={styles.links}>
                {latest === undefined ? (
                  <Link to="/diagnostic">{copy.start}</Link>
                ) : (
                  <>
                    <Link to={`/diagnostic/${latest.id}/readout`}>{copy.readout}</Link>
                    <Link to={`/licensing?assessment=${latest.id}`}>{copy.licensing}</Link>
                    <Link to={`/diagnostic/${latest.id}`}>{copy.edit}</Link>
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
