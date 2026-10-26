import { useEffect } from 'react';
import { content } from './content/index.ts';
import type { RouteKey } from './content/schemas.ts';
import { overviewTitle, pageTitle } from './content/titles.ts';

/** Sets the document title from content/site.yaml. */
export function usePageTitle(routeKey: RouteKey, title?: string): void {
  useEffect(() => {
    const { site } = content;
    document.title =
      routeKey === 'overview'
        ? overviewTitle(site)
        : pageTitle(site, title ?? site.routes[routeKey].title);
  }, [routeKey, title]);
}
