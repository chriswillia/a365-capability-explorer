# A365 Capability Explorer: project guidelines

A static GitHub Pages app (Vite, React, TypeScript strict, Fluent UI v9) that maps agent use cases to Microsoft Agent 365. It is built in phases from the [build brief](../docs/A365-Navigator-Build-Brief.md), which predates the project's rename. See [architecture](../docs/ARCHITECTURE.md), [how to update content](../docs/HOW-TO-UPDATE.md), [writing style](../docs/CONTENT-STYLE.md) and [design system](../docs/DESIGN-SYSTEM.md).

## Build and test

- `npm ci`, then `npm run dev`. `content:build` runs automatically before dev, build and test.
- Checks: `npm run lint`, `npm run typecheck`, `npm test`. End to end: `npm run test:e2e` (run `npx playwright install chromium` once). It builds the site for both base paths first.
- `src/generated/` is compiled output and is git-ignored. Never edit it.

## Rules that are easy to break

- **Content is data.** Capabilities, rules, patterns, risks, sources, licensing notes and all interface copy live in `content/*.yaml`, validated by `src/lib/content/schemas.ts`. Never hard-code them in a component. Numbers in headlines, KPIs and titles are computed in `src/lib/content/metrics.ts` and filled into `{placeholders}`.
- **Never invent facts.** No capabilities, licensing statements, statuses or URLs that a source does not state. If a value is unknown, leave the field empty and add `# TODO(verify)`. Service-description text is verbatim; editorial text is `reviewStatus: draft`.
- **Schema first.** Change `schemas.ts` and its tests before adding a field to YAML or code that reads it.
- **Tokens only.** Colors, type, spacing and radii come from `src/theme/tokens.ts`, used as `var(--token)`. A test fails on a raw hex or color function outside `src/theme`. Check new color pairs with `src/theme/contrast.ts` (WCAG 2.2 AA).
- **Accessibility is a requirement.** Semantic HTML, keyboard support, visible focus, color never the only signal, a table alternative for every chart. The axe tests must stay at zero violations.
- **Never hard-code the base path.** Use `import.meta.env.BASE_URL` for the router basename, links and assets. The deploy workflow sets `BASE_PATH` from `actions/configure-pages`.
- **Private by design.** No backend, cookies, analytics or runtime third-party requests. Anything stored in the browser goes through `src/lib/state/storage.ts` and is listed on the Privacy page.
- **The lockfile points at the public npm registry.** If you install through a private npm proxy, run `npm run lockfile:fix` before committing. A test fails otherwise, because a proxy's URLs would publish its hostname in this public repository and break installs and Dependabot. Never add a registry URL to the repo, for example in `.npmrc`.
- **Engine changes need tests.** Table-driven tests for rules, and updated golden scenarios.
- **Log content changes** in `content/changelog.md`, with an `affects:` line of capability ids.
- **This repository is public.** No secrets, internal Microsoft information, personal email addresses or local file paths in commits.

## Conventions

- Import with explicit `.ts` and `.tsx` extensions. Use `import type` for types.
- Pages are lazy route modules that export `Component`. Only the landing page is in the main chunk.
- Use "Essential", "Recommended" and "Consider" for recommendation levels. Never "Required".
