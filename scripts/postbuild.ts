import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readShellSource, routeShells, shellHtml, type ShellSource } from './route-shells.ts';

/**
 * GitHub Pages steps after a build:
 * - every page with a fixed address gets a copy of index.html named `<path>.html`, with its own title and
 *   description. Pages serves it at `/<path>` with HTTP 200 and no redirect, so a shared link gets a preview that
 *   names the page and the browser keeps the page's history state;
 * - 404.html is a copy of index.html, so any other deep link, such as a capability brief or a saved assessment,
 *   still loads the app on refresh;
 * - .nojekyll stops Pages from running Jekyll over the output.
 */
export function postbuild(outDir: string, source: ShellSource = readShellSource()): void {
  const index = join(outDir, 'index.html');
  if (!existsSync(index)) throw new Error(`postbuild: ${index} not found. Run the build first.`);
  const html = readFileSync(index, 'utf8');
  copyFileSync(index, join(outDir, '404.html'));
  for (const shell of routeShells(source)) {
    const file = join(outDir, `${shell.path}.html`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, shellHtml(html, shell));
  }
  writeFileSync(join(outDir, '.nojekyll'), '');
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  postbuild(resolve(process.env.OUT_DIR ?? 'dist'));
}
