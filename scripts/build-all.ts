import { resolve } from 'node:path';
import { build } from 'vite';
import { postbuild } from './postbuild.ts';

/*
 * Builds the site twice, the way GitHub Pages can serve it: from the root ("/") and from a project path
 * ("/<repo>/"). End-to-end tests and CI run against both, so a hard-coded base path can't slip through.
 */
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'control-plane-compass';

const targets = [
  { name: 'root', base: '/', outDir: 'dist-root' },
  { name: 'repo', base: `/${repo}/`, outDir: 'dist-repo' },
];

for (const target of targets) {
  console.log(`\nBuilding "${target.name}" with base ${target.base} into ${target.outDir}`);
  await build({ base: target.base, build: { outDir: target.outDir, emptyOutDir: true } });
  postbuild(resolve(target.outDir));
}
