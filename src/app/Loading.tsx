import { content } from '../lib/content/index.ts';

/** Shown while a lazy route module loads on the first visit, so the router has something to render. */
export function Loading() {
  return <p role="status">{content.site.ui.loading}</p>;
}
