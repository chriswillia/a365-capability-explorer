import type { RouteObject } from 'react-router';
import { Component as OverviewPage } from '../features/overview/OverviewPage.tsx';
import type { RouteKey } from '../lib/content/schemas.ts';
import { AppShell } from './AppShell.tsx';

/** A route whose page is still in development. The handle names its copy in content/site.yaml. */
const soon = (path: string, routeKey: RouteKey): RouteObject => ({
  path,
  handle: { routeKey },
  lazy: () => import('../features/coming-soon/ComingSoonPage.tsx'),
});

/* Route map (brief section 9). Everything except the landing page is a lazy chunk. */
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, handle: { routeKey: 'overview' satisfies RouteKey }, Component: OverviewPage },
      {
        path: 'capabilities',
        handle: { routeKey: 'capabilities' satisfies RouteKey },
        lazy: () => import('../features/explorer/CapabilitiesPage.tsx'),
      },
      soon('capabilities/:id', 'capability'),
      soon('patterns', 'patterns'),
      soon('patterns/:id', 'pattern'),
      soon('learn', 'learn'),
      soon('diagnostic', 'diagnostic'),
      soon('diagnostic/:id', 'assessment'),
      soon('diagnostic/:id/readout', 'readout'),
      soon('canvas/:id', 'canvas'),
      soon('portfolio', 'portfolio'),
      soon('workshop', 'workshop'),
      soon('methodology', 'methodology'),
      soon('whats-new', 'whatsNew'),
      soon('admin/content-health', 'contentHealth'),
      {
        path: 'privacy',
        handle: { routeKey: 'privacy' satisfies RouteKey },
        lazy: () => import('../features/privacy/PrivacyPage.tsx'),
      },
      {
        path: '*',
        handle: { routeKey: 'notFound' satisfies RouteKey },
        lazy: () => import('../features/not-found/NotFoundPage.tsx'),
      },
    ],
  },
];
