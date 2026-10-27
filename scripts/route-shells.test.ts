import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PAGE_ROUTES } from '../src/app/route-table.ts';
import { pageTitle } from '../src/lib/content/titles.ts';
import { postbuild } from './postbuild.ts';
import { readShellSource, routeShells, shellHtml } from './route-shells.ts';

const source = readShellSource();
const { site } = source;
const entry = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<title>Product: tagline</title>',
  '<meta name="description" content="The site description." />',
  '<script type="module" src="/assets/index-abc.js"></script>',
  '</head>',
  '<body><div id="root"></div></body>',
  '</html>',
].join('\n');
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe('route shells', () => {
  it('has one shell for each page with a fixed address, each at its own path', () => {
    const shells = routeShells(source);
    expect(shells.map((shell) => shell.path)).toEqual(PAGE_ROUTES.map((page) => page.path));
    expect(new Set(shells.map((shell) => shell.path)).size).toBe(shells.length);
    for (const shell of shells) expect(shell.path).toMatch(/^[a-z0-9][a-z0-9/-]*[a-z0-9]$/);
    expect(shells.map((shell) => shell.path)).toContain('conversation');
  });

  it('gives each page the title and description the app gives it once it has loaded', () => {
    const conversation = site.routes.conversation!;
    const shell = routeShells(source).find((item) => item.path === 'conversation')!;
    expect(shell.title).toBe(pageTitle(site, conversation.title));
    expect(shell.description).toBe(conversation.description);
  });

  it('writes no shell for a page addressed by an id, whose folder would make Pages redirect', () => {
    const paths = routeShells(source).map((shell) => shell.path);
    expect(paths.some((path) => path.startsWith('capabilities/'))).toBe(false);
    expect(paths.some((path) => path.startsWith('patterns/'))).toBe(false);
    expect(paths.some((path) => path.startsWith('diagnostic/'))).toBe(false);
  });

  it('refuses a fixed page that has no copy', () => {
    const routes = { ...site.routes };
    delete routes.conversation;
    expect(() => routeShells({ site: { ...site, routes } })).toThrow(/conversation/);
  });
});

describe('shellHtml', () => {
  it('replaces the title and the description, escapes both and leaves the rest alone', () => {
    const html = shellHtml(entry, {
      path: 'x',
      title: 'Agent "A" & <B> · Product',
      description: 'Use <this> & "that"',
    });
    expect(html).toContain('<title>Agent &quot;A&quot; &amp; &lt;B&gt; · Product</title>');
    expect(html).toContain(
      '<meta name="description" content="Use &lt;this&gt; &amp; &quot;that&quot;" />',
    );
    const rest = (text: string) =>
      text.replace(/<title>.*?<\/title>/, '').replace(/<meta name="description".*?>/, '');
    expect(rest(html)).toBe(rest(entry));
  });

  it('does not treat a dollar sign in a title as a replacement pattern', () => {
    expect(
      shellHtml(entry, { path: 'x', title: 'Costs $& more · Product', description: '$1' }),
    ).toContain('<title>Costs $&amp; more · Product</title>');
  });

  it('refuses an entry page it cannot fill in', () => {
    const shell = { path: 'x', title: 'T', description: 'D' };
    expect(() => shellHtml('<html></html>', shell)).toThrow(/title/);
    expect(() => shellHtml('<title>T</title>', shell)).toThrow(/description/);
  });
});

describe('postbuild', () => {
  function build() {
    const folder = mkdtempSync(join(tmpdir(), 'a365-postbuild-'));
    folders.push(folder);
    writeFileSync(join(folder, 'index.html'), entry);
    postbuild(folder, source);
    return folder;
  }

  it('writes each shell as a .html file next to the 404 fallback and the Pages marker', () => {
    const folder = build();
    expect(readFileSync(join(folder, 'index.html'), 'utf8')).toBe(entry);
    expect(readFileSync(join(folder, '404.html'), 'utf8')).toBe(entry);
    expect(existsSync(join(folder, '.nojekyll'))).toBe(true);
    const conversation = readFileSync(join(folder, 'conversation.html'), 'utf8');
    expect(conversation).toContain(
      `<title>${pageTitle(site, site.routes.conversation!.title)}</title>`,
    );
    expect(conversation).toContain('/assets/index-abc.js');
    expect(existsSync(join(folder, 'admin', 'content-health.html'))).toBe(true);
    expect(existsSync(join(folder, 'canvas', 'blank.html'))).toBe(true);
  });

  it('creates no folder that shares a name with a shell, which would make Pages redirect', () => {
    const folder = build();
    for (const { path } of routeShells(source)) {
      const folderName = join(folder, path);
      expect(existsSync(folderName), path).toBe(false);
    }
    expect(existsSync(join(folder, 'no-such-page.html'))).toBe(false);
  });

  it('fails clearly when the build has not run', () => {
    const folder = mkdtempSync(join(tmpdir(), 'a365-postbuild-'));
    folders.push(folder);
    expect(() => postbuild(folder, source)).toThrow(/Run the build first/);
  });
});
