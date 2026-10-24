import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * "Use tokens only": every color comes from src/theme/tokens.ts, through var(--token) in CSS.
 * A raw hex or color function anywhere else would bypass the design system (and its contrast tests).
 */
const srcDir = fileURLToPath(new URL('../src', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === 'theme' || name === 'generated' ? [] : walk(path);
    }
    return /\.(css|ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const COLOR_FUNCTION = /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/;

describe('no raw colors outside src/theme', () => {
  const files = walk(srcDir);

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((file) => [relative(srcDir, file), file] as const))('%s', (_name, file) => {
    const text = readFileSync(file, 'utf8');
    expect(text).not.toMatch(HEX);
    expect(text).not.toMatch(COLOR_FUNCTION);
  });
});
