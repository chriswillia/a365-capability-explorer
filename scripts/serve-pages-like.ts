import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

/*
 * A small static server that behaves like GitHub Pages, for end-to-end tests:
 * - the site is served under its base path ("/" or "/<repo>/");
 * - a path with no file answers with 404.html and HTTP status 404;
 * - /page is served from page.html with HTTP 200 and no redirect (but /page/ is not), the way Pages does;
 * - a directory without a trailing slash redirects to the slash form, keeping the query string.
 * Usage: tsx scripts/serve-pages-like.ts --dir dist-repo --base /a365-explorer/ --port 4174
 */
const { values } = parseArgs({
  options: {
    dir: { type: 'string' },
    base: { type: 'string', default: '/' },
    port: { type: 'string' },
  },
});
if (values.dir === undefined || values.port === undefined) {
  console.error('Usage: serve-pages-like.ts --dir <folder> --base </base/> --port <port>');
  process.exit(2);
}

const root = resolve(values.dir);
const base = values.base ?? '/';
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

function send(
  res: import('node:http').ServerResponse,
  status: number,
  body: string | Buffer,
  type: string,
): void {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function notFound(res: import('node:http').ServerResponse): void {
  const page = join(root, '404.html');
  if (existsSync(page)) send(res, 404, readFileSync(page), types['.html'] as string);
  else send(res, 404, 'Not found', types['.txt'] as string);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  // Like Pages, a redirect to the slash form keeps the query string.
  if (base !== '/' && pathname === base.slice(0, -1)) {
    res.writeHead(301, { Location: `${base}${url.search}` });
    res.end();
    return;
  }
  if (!pathname.startsWith(base)) {
    send(res, 404, 'Not found', types['.txt'] as string);
    return;
  }

  const target = resolve(root, pathname.slice(base.length));
  if (target !== root && !target.startsWith(root + sep)) {
    send(res, 403, 'Forbidden', types['.txt'] as string);
    return;
  }

  if (existsSync(target) && statSync(target).isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${pathname}/${url.search}` });
      res.end();
      return;
    }
    const index = join(target, 'index.html');
    if (existsSync(index)) send(res, 200, readFileSync(index), types['.html'] as string);
    else notFound(res);
    return;
  }
  if (existsSync(target)) {
    send(res, 200, readFileSync(target), types[extname(target)] ?? 'application/octet-stream');
    return;
  }
  // /learn is served from learn.html with no redirect, but /learn/ is not.
  const page = `${target}.html`;
  if (!pathname.endsWith('/') && existsSync(page)) {
    send(res, 200, readFileSync(page), types['.html'] as string);
    return;
  }
  notFound(res);
}).listen(Number(values.port), () => {
  console.log(`Serving ${root} at http://localhost:${values.port}${base}`);
});
