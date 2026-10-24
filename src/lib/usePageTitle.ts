import { useEffect } from 'react';
import { content } from './content/index.ts';
import type { RouteKey } from './content/schemas.ts';
import { overviewTitle, pageTitle } from './content/titles.ts';

/** Sets the document title from content/site.yaml. */
export function usePageTitle(routeKey: RouteKey): void {
  useEffect(() => {
    const { site } = content;
    document.title =
      routeKey === 'overview' ? overviewTitle(site) : pageTitle(site, site.routes[routeKey].title);
  }, [routeKey]);
}
