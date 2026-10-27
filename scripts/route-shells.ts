import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAGE_ROUTES } from '../src/app/route-table.ts';
import { pageTitle } from '../src/lib/content/titles.ts';

export interface RouteShell {
  /** The address below the site root, without a leading or trailing slash or an extension. */
  path: string;
  title: string;
  description: string;
}

export interface ShellSource {
  site: { productName: string; routes: Record<string, { title: string; description: string }> };
}

/** The content the shells are built from, as `npm run content:build` compiled it. */
export const readShellSource = (): ShellSource => ({
  site: JSON.parse(
    readFileSync(fileURLToPath(new URL('../src/generated/site.json', import.meta.url)), 'utf8'),
  ) as ShellSource['site'],
});

/** One shell for each page that has a fixed address, with the title and description the app gives it. */
export function routeShells({ site }: ShellSource): RouteShell[] {
  return PAGE_ROUTES.map(({ path, key }): RouteShell => {
    const route = site.routes[key];
    if (route === undefined) throw new Error(`No copy for the "${key}" route in content/site.yaml`);
    return { path, title: pageTitle(site, route.title), description: route.description };
  });
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The app's entry page with this page's title and description in the head. Nothing else changes. */
export function shellHtml(indexHtml: string, shell: RouteShell): string {
  const meta = /(<meta name="description" content=")[^"]*(")/;
  if (!/<title>.*?<\/title>/.test(indexHtml))
    throw new Error('The entry page has no <title> to replace');
  if (!meta.test(indexHtml)) throw new Error('The entry page has no description tag to replace');
  return indexHtml
    .replace(/<title>.*?<\/title>/, () => `<title>${escapeHtml(shell.title)}</title>`)
    .replace(
      meta,
      (_all, open: string, close: string) => `${open}${escapeHtml(shell.description)}${close}`,
    );
}
