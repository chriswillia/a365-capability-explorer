import { Link } from 'react-router';
import { ExternalLink } from '../components/ExternalLink.tsx';
import { content, contentMeta, sourceById, values } from '../lib/content/index.ts';
import type { Source } from '../lib/content/schemas.ts';
import { renderTemplate } from '../lib/content/template.ts';
import styles from './SiteFooter.module.css';

export function SiteFooter() {
  const { site } = content;
  const { footer } = site.ui;
  const sources = site.footerSourceIds.flatMap((id): Source[] => {
    const source = sourceById(id);
    return source === undefined ? [] : [source];
  });

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.stamp}>{renderTemplate(footer.stamp, values)}</p>
        <p className={styles.disclaimer}>{site.disclaimer}</p>
        <p className={styles.notice}>{site.independenceNotice}</p>
        <div className={styles.columns}>
          <div>
            <h2 className={styles.heading}>{footer.officialSources}</h2>
            <ul className={styles.list}>
              {sources.map((source) => (
                <li key={source.id}>
                  <ExternalLink href={source.url}>{source.title}</ExternalLink>
                </li>
              ))}
            </ul>
          </div>
          <ul className={`${styles.list} ${styles.links}`}>
            <li>
              <Link to="/methodology">{site.ui.nav.methodology}</Link>
            </li>
            <li>
              <Link to="/privacy">{footer.privacy}</Link>
            </li>
            <li>
              <ExternalLink href={`${site.repoUrl}/issues/new/choose`}>
                {footer.reportIssue}
              </ExternalLink>
            </li>
            {site.feedbackEmail !== null && (
              <li>
                <a href={`mailto:${site.feedbackEmail}`}>{footer.emailFeedback}</a>
              </li>
            )}
            <li>
              <ExternalLink href={site.repoUrl}>{footer.sourceCode}</ExternalLink>
            </li>
          </ul>
        </div>
        <p className={styles.version}>
          {footer.contentVersion}: <code>{contentMeta.contentVersion}</code>
        </p>
      </div>
    </footer>
  );
}
