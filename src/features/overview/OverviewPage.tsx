import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { ButtonLink } from '../../components/ButtonLink.tsx';
import { HeroBand } from '../../components/HeroBand.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content } from '../../lib/content/index.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './OverviewPage.module.css';

// Saved customers come from local storage, so they load after the first paint instead of with the landing page.
const RecentCustomers = lazy(() => import('./RecentCustomers.tsx'));

export function Component() {
  usePageTitle('overview');
  const { site } = content;
  const { overview } = site;

  return (
    <>
      <HeroBand
        eyebrow={overview.heroEyebrow}
        title={<PageHeading>{site.productName}</PageHeading>}
        tagline={site.tagline}
        lede={overview.heroLede}
      >
        <ButtonLink to="/pitch" variant="onDark">
          {overview.ctaPrimary}
        </ButtonLink>
        <ButtonLink to="/diagnostic" variant="onDarkOutline">
          {overview.ctaSecondary}
        </ButtonLink>
      </HeroBand>

      <div className={styles.page}>
        <section aria-labelledby="jobs-heading" className={styles.section}>
          <h2 id="jobs-heading">{overview.jobs.heading}</h2>
          <p>{overview.jobs.intro}</p>
          <ul className={styles.jobs}>
            {overview.jobs.tiles.map((tile) => (
              <li key={tile.id} className={styles.job}>
                <p className={styles.question}>{tile.question}</p>
                <h3>{tile.title}</h3>
                <p>{tile.body}</p>
                <Link to={tile.to}>{tile.cta}</Link>
              </li>
            ))}
          </ul>
          <p className={styles.hint}>{overview.jobs.libraryNote}</p>
        </section>
        <Suspense fallback={null}>
          <RecentCustomers />
        </Suspense>
      </div>
    </>
  );
}
