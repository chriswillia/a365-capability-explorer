import type { RouteKey } from '../lib/content/schemas.ts';

/**
 * The pages that have a fixed address, as src/app/routes.tsx declares them. The build writes a copy of the app's
 * entry page for each one (as `<path>.html`, which GitHub Pages serves at `/<path>` without a redirect), so a
 * shared link is answered with HTTP 200 and its own title. A test keeps this table in step with the router.
 *
 * Pages addressed by an id (a capability, a scenario, a saved assessment) are not listed: a folder named like a
 * page that also has an `.html` file would make Pages redirect to the folder, so those addresses keep using the
 * 404.html fallback, which loads the same app.
 */
export const PAGE_ROUTES = [
  { path: 'capabilities', key: 'capabilities' },
  { path: 'patterns', key: 'patterns' },
  { path: 'learn', key: 'learn' },
  { path: 'diagnostic', key: 'diagnostic' },
  { path: 'canvas/blank', key: 'canvas' },
  { path: 'portfolio', key: 'portfolio' },
  { path: 'workshop', key: 'workshop' },
  { path: 'conversation', key: 'conversation' },
  { path: 'methodology', key: 'methodology' },
  { path: 'whats-new', key: 'whatsNew' },
  { path: 'admin/content-health', key: 'contentHealth' },
  { path: 'privacy', key: 'privacy' },
] as const satisfies readonly { path: string; key: RouteKey }[];
