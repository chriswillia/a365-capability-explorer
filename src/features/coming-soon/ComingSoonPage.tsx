import { Link, useMatches } from 'react-router';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content } from '../../lib/content/index.ts';
import type { RouteKey } from '../../lib/content/schemas.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './ComingSoonPage.module.css';

/** One placeholder for every route that is still in development. The route's handle names its copy. */
export function Component() {
  const handle = useMatches().at(-1)?.handle as { routeKey?: RouteKey } | undefined;
  const routeKey = handle?.routeKey ?? 'notFound';
  usePageTitle(routeKey);
  const { routes, ui } = content.site;

  return (
    <PageContainer narrow>
      <PageHeading>{routes[routeKey].title}</PageHeading>
      <p className={styles.lede}>{routes[routeKey].description}</p>
      <p className={styles.status}>{ui.comingSoon.status}</p>
      <p>
        <Link to="/">{ui.comingSoon.back}</Link>
      </p>
    </PageContainer>
  );
}
