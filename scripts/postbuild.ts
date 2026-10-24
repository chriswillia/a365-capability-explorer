import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * GitHub Pages steps after a build:
 * - 404.html is a copy of index.html, so a deep link such as /capabilities/purview-dlp loads the app even on refresh.
 * - .nojekyll stops Pages from running Jekyll over the output.
 */
export function postbuild(outDir: string): void {
  const index = join(outDir, 'index.html');
  if (!existsSync(index)) throw new Error(`postbuild: ${index} not found. Run the build first.`);
  copyFileSync(index, join(outDir, '404.html'));
  writeFileSync(join(outDir, '.nojekyll'), '');
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  postbuild(resolve(process.env.OUT_DIR ?? 'dist'));
}
