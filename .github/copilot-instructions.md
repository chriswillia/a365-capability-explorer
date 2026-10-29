# A365 Explorer: project guidelines

A static GitHub Pages app (Vite, React, TypeScript strict, Fluent UI v9) that maps agent use cases to Microsoft Agent 365. It is built in phases from the [build brief](../docs/A365-Navigator-Build-Brief.md), which predates the project's rename. See [architecture](../docs/ARCHITECTURE.md), [how to update content](../docs/HOW-TO-UPDATE.md), [writing style](../docs/CONTENT-STYLE.md) and [design system](../docs/DESIGN-SYSTEM.md).

## Build and test

- `npm ci`, then `npm run dev`. `content:build` runs automatically before dev, build and test.
- Checks: `npm run lint`, `npm run typecheck`, `npm test`. End to end: `npm run test:e2e` (run `npx playwright install chromium` once). It builds the site for both base paths first. After a build, `npm run check:public` is the public-safety guard.
- `src/generated/` is compiled output and is git-ignored. Never edit it.

## Rules that are easy to break

- **Content is data.** Capabilities, rules, patterns, risks, sources, licensing notes and all interface copy live in `content/*.yaml`, validated by `src/lib/content/schemas.ts`. Never hard-code them in a component. Numbers in headlines, KPIs and titles are computed in `src/lib/content/metrics.ts` and filled into `{placeholders}`.
- **Never invent facts.** No capabilities, licensing statements, statuses or URLs that a source does not state. If a value is unknown, leave the field empty and add `# TODO(verify)`. Service-description text is verbatim; editorial text is `reviewStatus: draft`.
- **Licensing facts need a source and a date.** Every statement of fact carries `sourceIds`, an `evidence` tag and `lastVerified`. Licensing and requirements facts go stale after 30 days, everything else after 90. Where public sources differ, show each one; the Microsoft Product Terms govern a purchase. No prices, anywhere.
- **Never commit internal Microsoft material.** Use only public Microsoft sources. No internal documents, decks, FAQs or roadmaps (or text copied from them), links to internal sites, customer names, deal data or colleagues' names. `npm run check:public` scans the content, the source and the built site, and CI and the deploy workflow run it.
- **Unknown is never a gap.** A missing answer is "to confirm" with the question to ask (`askPrompt`), never a gap, and never a bare 0%.
- **Use sellers' words.** The terms in [the style guide](../docs/CONTENT-STYLE.md): Area, "Where it's configured", "Included (no Agent 365 license needed)", "Needs Agent 365 (or E7/G7)", Set up once and Decide per agent, Scope an agent, Agent passport, Full discovery, Deploy, Example agents, Agent portfolio, Governance effort. Say "Agent 365" in prose, and write counts with the plural form `{n?singular|plural}`.
- **Schema first.** Change `schemas.ts` and its tests before adding a field to YAML or code that reads it. A new value in a fixed list (an audience, a console) goes in `src/lib/content/constants.ts`.
- **Keep the first page load small.** Browser code imports the fixed lists from `constants.ts`, never from `schemas.ts`, so Zod stays out of the main chunk. `tests/first-load-bundle.test.ts` fails with the import chain if it comes back. Generated content has its own chunk (`vite.config.ts`). Code that needs the diagnostic model (which needs Zod), such as the sample customer on Home, is a lazy chunk.
- **One page means one page.** The leave-behind prints on one A4 or Letter page, and an end-to-end test checks the fullest agent. The print styles hide every `<footer>`, so what must reach the paper goes in a `div`. If you add to the page or the slides, change the shared limits in `src/lib/engine/leave-behind.ts` and rerun that test.
- **Long pages show one part at a time.** Licensing, Deploy, Scope an agent, the example agents, Learn, the Agent portfolio, the Workshop kit and the Readout are lists of parts (`?view=`) shown with `useView`, `ViewSwitcher` and `ViewPane`. Put a new section in a part's `sections`, link into it with a `#hash` (which opens the part that holds it), keep a part to about five screens (an end-to-end test fails past that) and give a part that holds typed-in work `keep`. A part of a document that prints or is presented (the Portfolio, the Workshop kit, the Readout) is `printed`: it stays in the page, hidden on screen, so the document still prints and presents whole. See [how to update](../docs/HOW-TO-UPDATE.md).
- **Sample data is fictional and marked.** The sample customer is flagged `sample: true`, shows a "Sample data" chip and is the only thing `src/lib/state/sample.ts` writes or removes. Never use a real company name. An example agent is never saved into it for a seller.
- **A setting sits next to what it changes, and every step for an agent starts at its passport.** The header has one setting (Technical detail); Selling as is on the value brief, the only page it changes. A page for one agent opens with `AgentBackLink`, and opening a page never saves anything: the example's own button does (`src/lib/state/start-from-example.ts`).
- **Tokens only.** Colors, type, spacing and radii come from `src/theme/tokens.ts`, used as `var(--token)`. A test fails on a raw hex or color function outside `src/theme`. Check new color pairs with `src/theme/contrast.ts` (WCAG 2.2 AA).
- **Accessibility is a requirement.** Semantic HTML, keyboard support, visible focus, color never the only signal, a table alternative for every chart. The axe tests must stay at zero violations.
- **Never hard-code the base path.** Use `import.meta.env.BASE_URL` for the router basename, links and assets. The deploy workflow sets `BASE_PATH` from `actions/configure-pages`.
- **Private by design.** No backend, cookies, analytics or runtime third-party requests. Anything stored in the browser goes through `src/lib/state/storage.ts` and is listed on the Privacy page.
- **Saved work must survive a rename.** Renaming the app changes the display name (`productName`), the repository and the base path, nothing else. The storage prefix (`cpcompass:`) never changes, and the backup file's `format` id in `src/lib/state/diagnostic-transfer.ts` gets the new name for new backups while every earlier id stays accepted on import.
- **The lockfile points at the public npm registry.** If you install through a private npm proxy, run `npm run lockfile:fix` before committing. A test fails otherwise, because a proxy's URLs would publish its hostname in this public repository and break installs and Dependabot. Never add a registry URL to the repo, for example in `.npmrc`.
- **Engine changes need tests.** Table-driven tests for rules, and updated golden scenarios.
- **Log content changes** in `content/changelog.md`, with an `affects:` line of capability ids.
- **This repository is public.** No secrets, internal Microsoft information, personal email addresses or local file paths in commits.

## Conventions

- Import with explicit `.ts` and `.tsx` extensions. Use `import type` for types.
- Pages are lazy route modules that export `Component`. Only the landing page is in the main chunk.
- Use "Essential", "Recommended" and "Consider" for recommendation levels. Never "Required".
