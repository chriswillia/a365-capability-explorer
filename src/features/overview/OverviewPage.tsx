import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../components/Badge.tsx';
import { ButtonLink } from '../../components/ButtonLink.tsx';
import { HeroBand } from '../../components/HeroBand.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { accessModelLabel } from '../../lib/content/access-fit.ts';
import { content } from '../../lib/content/index.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './OverviewPage.module.css';

// Saved customers come from local storage, so they load after the first paint instead of with the landing page.
const RecentCustomers = lazy(() => import('./RecentCustomers.tsx'));
const SampleCustomer = lazy(() => import('./SampleCustomer.tsx'));

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
        <ButtonLink to="/map" variant="onDarkOutline">
          {overview.ctaSecondary}
        </ButtonLink>
      </HeroBand>

      <div className={styles.page}>
        <section aria-labelledby="examples-heading" className={styles.section}>
          <h2 id="examples-heading">{overview.examples.heading}</h2>
          <p>{overview.examples.intro}</p>
          <ul className={styles.examples}>
            {content.patterns.map((pattern) => {
              const access = accessModelLabel(content, pattern.answers.accessModel);
              return (
                <li key={pattern.id} className={styles.example}>
                  <h3>
                    <Link to={`/patterns/${pattern.id}`}>{pattern.title}</Link>
                  </h3>
                  <p>{pattern.summary}</p>
                  {access !== null && (
                    <p>
                      <Badge tone="outline">{access}</Badge>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <p>
            <Link to="/patterns">{overview.examples.all}</Link>
          </p>
        </section>

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
        <Suspense fallback={null}>
          <SampleCustomer />
        </Suspense>
      </div>
    </>
  );
}
