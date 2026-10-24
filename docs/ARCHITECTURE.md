# Architecture

Control Plane Compass is a static site: Vite, React, TypeScript (strict) and Fluent UI v9, hosted on GitHub Pages. There is no backend. Content lives in YAML, is validated at build time, and compiled to JSON that the app imports.

```
content/*.yaml, changelog.md ──► scripts/build-content.ts ──► src/generated/*.json ──► the app
                                  (Zod schemas + cross-reference checks, contentVersion)
```

## Content pipeline

- **Single definition of every type:** [`src/lib/content/schemas.ts`](../src/lib/content/schemas.ts) (Zod). Objects are strict, so a typo in a YAML key fails the build. The app imports the inferred types.
- **Validation:** `npm run content:build` parses each file, validates it against its schema, then runs the cross-reference checks in [`validate.ts`](../src/lib/content/validate.ts): duplicate ids, unknown source references, taxonomy files that match the typed ids, template placeholders, changelog references, orphaned sources and stale `lastVerified` dates (a warning after 90 days).
- **`contentVersion`:** the date of the newest changelog entry plus seven characters of a hash over every file in `content/`, with line endings normalized. It does not change on a rebuild, so saved assessments only look out of date when content changes.
- **Numbers are computed:** [`metrics.ts`](../src/lib/content/metrics.ts) computes every count. Site copy uses `{placeholders}`, and the build rejects a placeholder it does not know.
- **Source fidelity:** `source.featureText` and the availability flags are verbatim from the service description. [`source-snapshot.json`](../content/source-snapshot.json) keeps the raw published table, and tests compare it with the catalog after [normalization](../src/lib/content/normalize.ts) (NFKC, zero-width characters, curly quotes, non-breaking hyphens).

## App

| Folder            | What it holds                                                                |
| ----------------- | ---------------------------------------------------------------------------- |
| `src/app`         | Route table, layout shell (header, footer, skip link, focus handling)        |
| `src/features`    | One folder per section. Pages are lazy route modules that export `Component` |
| `src/components`  | Design-system components                                                     |
| `src/lib/content` | Schemas, validation, metrics, derived fields, templates, the typed accessor  |
| `src/lib/state`   | Browser storage and the Executive / Technical context                        |
| `src/theme`       | Tokens, Fluent theme, base and print CSS                                     |
| `scripts`         | Content build, post-build, two-base-path build, Pages-like test server       |
| `e2e`             | Playwright and axe tests                                                     |

Only the landing page is in the main chunk. Every other page is a lazy chunk.

## Routing and hosting

- **The base path is never hard-coded.** Vite's `base` comes from `BASE_PATH`. The deploy workflow fills it from `actions/configure-pages` and falls back to `/<repo>` only when Pages reports nothing. The router `basename` and every link and asset use `import.meta.env.BASE_URL`.
- **Deep links:** `postbuild` copies `index.html` to `404.html`, so `/capabilities` loads on refresh. GitHub Pages serves that file with HTTP status 404, and the end-to-end server reproduces this exactly.
- **Both ways of serving are tested:** `npm run build:all` builds for `/` and for `/<repo>/`. CI and `npm run test:e2e` run the same tests against both.
- **`noindex`:** while `indexable` is false in `content/site.yaml`, every page carries a robots noindex tag. A `robots.txt` cannot do this on a project site, because it must sit at the domain root.
- **Workflows:** `ci.yml` runs on pull requests and is called by `deploy-pages.yml`, so a push to `main` is checked before it is published.

## State and privacy

No backend, cookies, analytics or runtime third-party requests (a Playwright test fails on any request to another origin). Browser storage goes through [`storage.ts`](../src/lib/state/storage.ts) under the prefix `cpcompass:`. Project sites under one `github.io` account share an origin, so the prefix is distinctive. A test keeps the Privacy page in step with what is stored.

## Design system

[`tokens.ts`](../src/theme/tokens.ts) feeds both the CSS variables (injected into `index.html` at build time) and the Fluent theme. A test fails on a raw color anywhere else, and another asserts the WCAG 2.2 AA contrast of every token pair. See the [design system](DESIGN-SYSTEM.md).

## Testing

- **Vitest, `node` project:** schemas, validation, build script, tokens. **`dom` project:** the shell and pages, with Testing Library.
- **Playwright and axe:** deep links, assets, no third-party requests, `noindex`, keyboard and focus, zero axe violations in both views.
- The numbers in [`catalog.test.ts`](../src/lib/content/catalog.test.ts) are deliberate tripwires on the source-of-truth table. Update them in the same pull request as an intentional catalog change.

## Decisions and deviations from the build brief

The [build brief](A365-Navigator-Build-Brief.md) is kept as written. Where the build differs:

1. **Renamed** from "Agent 365 Navigator" to **Control Plane Compass**. Read the old name in the brief as the new one.
2. **Hosting:** a public project site from a personal account. The brief's private pilot was not used: a private Pages site needs GitHub Enterprise Cloud. The site carries `noindex` until launch.
3. **Toolchain pins:** TypeScript 6.0 (typescript-eslint supports up to 6.0.x) and ESLint 9.39 (`eslint-plugin-jsx-a11y` does not support ESLint 10). Revisit when those plugins catch up.
4. **`js-yaml` is a dev dependency.** It runs at build time only, so the browser receives compiled JSON.
5. **Contrast:** the brief's `#0078D4` is 4.27:1 on the paper canvas, below AA for text. Link text uses `#106EBE`, and form controls get their own border token (the hairline is decorative).
6. **`sourceNotes[].differs`** (an addition) marks a statement that differs from the service description, which drives "Sources differ, verify".
7. **Changelog `affects: [all]`** stands for the whole catalog. A bare `*` is a YAML alias, so it cannot be used.
8. **Orphaned sources warn instead of failing** until the content that cites them exists. Set `failOnOrphanedSources: true` in the `buildContent` call in `scripts/build-content.ts` once all content files are in (Phase 3).
9. **Not validated yet:** that every capability is mitigated by a risk, and question and option references. They need `risks.yaml` and `questions.yaml`.
10. **Unverified sources:** the licensing FAQ (`lic-faq`) could be read only in part, and the Work Trend Index (`wti-2025`) not at all. Content that depends on them is marked `TODO(verify)`.
