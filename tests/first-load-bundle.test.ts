import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/*
 * What the first page load pulls in. zod and the content schemas are for the build script and the diagnostic
 * workspace, which loads lazily, so static imports from the app entry must never reach them. Dynamic import()
 * is not followed (a lazy route is its own chunk), and neither is `import type` (it is erased). An inline
 * `import { type X }` stays as a side-effect import under verbatimModuleSyntax, so it is followed.
 * A failing assertion shows the chain of imports that reaches the module.
 */
const root = fileURLToPath(new URL('..', import.meta.url));
const entry = resolve(root, 'src/main.tsx');
const posix = (file: string) => relative(root, file).split(sep).join('/');

interface Graph {
  /** Every module reachable from the entry, with the module that first imported it. */
  parents: Map<string, string | null>;
  /** Every package those modules import, with the first module that imported it. */
  packages: Map<string, string>;
}

function staticSpecifiers(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
  return source.statements.flatMap((statement) => {
    let specifier: ts.Expression | undefined;
    if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly !== true) {
      specifier = statement.moduleSpecifier;
    } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      specifier = statement.moduleSpecifier;
    }
    return specifier !== undefined && ts.isStringLiteral(specifier) ? [specifier.text] : [];
  });
}

function firstLoadGraph(): Graph {
  const parents = new Map<string, string | null>([[entry, null]]);
  const packages = new Map<string, string>();
  const queue = [entry];
  for (const file of queue) {
    for (const specifier of staticSpecifiers(file)) {
      if (!specifier.startsWith('.')) {
        const parts = specifier.split('/');
        const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
        if (name !== undefined && !packages.has(name)) packages.set(name, file);
        continue;
      }
      const next = resolve(dirname(file), specifier);
      if (!/\.tsx?$/.test(next) || !existsSync(next) || parents.has(next)) continue;
      parents.set(next, file);
      queue.push(next);
    }
  }
  return { parents, packages };
}

function importChain(graph: Graph, file: string): string[] {
  if (!graph.parents.has(file)) return [];
  const chain: string[] = [];
  for (let at: string | null | undefined = file; at; at = graph.parents.get(at)) {
    chain.unshift(posix(at));
  }
  return chain;
}

function packageChain(graph: Graph, name: string): string[] {
  const importer = graph.packages.get(name);
  return importer === undefined ? [] : [...importChain(graph, importer), name];
}

describe('first page load', () => {
  const graph = firstLoadGraph();

  it('follows static imports from the entry, but not lazy routes', () => {
    const reached = [...graph.parents.keys()].map(posix);
    expect(reached.length).toBeGreaterThan(30);
    expect(reached).toContain('src/app/App.tsx');
    expect(reached).toContain('src/lib/content/index.ts');
    expect(reached).not.toContain('src/features/licensing/LicensingPage.tsx');
  });

  it('does not load zod', () => {
    expect(packageChain(graph, 'zod')).toEqual([]);
  });

  it('does not load the content schemas', () => {
    expect(importChain(graph, resolve(root, 'src/lib/content/schemas.ts'))).toEqual([]);
  });
});

describe('src/lib/content/constants.ts', () => {
  it('has no runtime imports, so reading a list never loads a schema', () => {
    expect(staticSpecifiers(resolve(root, 'src/lib/content/constants.ts'))).toEqual([]);
  });
});
