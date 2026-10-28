import { describe, expect, it } from 'vitest';
import { PAGE_ROUTES } from './route-table.ts';
import { routes } from './routes.tsx';

const children = routes[0]!.children!;
const keyOf = (route: (typeof children)[number]) =>
  (route.handle as { routeKey?: string } | undefined)?.routeKey;

describe('route table', () => {
  it('lists every page that has a fixed address, with its route key, and nothing else', () => {
    const fixed = children.filter(
      (route) => route.path !== undefined && !route.path.includes(':') && route.path !== '*',
    );
    expect(fixed.map((route) => route.path).sort()).toEqual(
      PAGE_ROUTES.map((page) => page.path).sort(),
    );
    for (const page of PAGE_ROUTES)
      expect(keyOf(fixed.find((route) => route.path === page.path)!)).toBe(page.key);
  });

  it('knows the pages addressed by an id, which are left to the 404 fallback', () => {
    expect(
      children
        .filter((route) => route.path?.includes(':'))
        .map((route) => route.path)
        .sort(),
    ).toEqual(['canvas/:id', 'capabilities/:id', 'leave-behind/:id', 'patterns/:id']);
  });
});
