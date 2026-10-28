---
description: 'Refresh the licensing and prerequisite content when a public Microsoft licensing page changes (the Product Terms, the licensing FAQ or a related page): licensing.yaml, requirements.yaml, tests and the changelog.'
argument-hint: 'The page that changed (URL or source id), and what changed if you know'
agent: 'agent'
---

A public Microsoft licensing page has changed, or its `lastVerified` date is old. Bring the content back in line with it. Follow [the content rules](../instructions/content.instructions.md) and [the style guide](../../docs/CONTENT-STYLE.md).

Use only public Microsoft sources. Never copy text from, or link to, internal material, and never state a price.

1. Read the page again in full (a script-rendered page may need a real browser). Note its last-updated date, and say so if you cannot read it. Do not guess.
2. Find every statement that cites its source id in [licensing.yaml](../../content/licensing.yaml) and [requirements.yaml](../../content/requirements.yaml). Compare each one with the page.
3. For each statement the page still supports, set `lastVerified` to today. For each one it no longer supports, rewrite it from the page (paraphrase, do not quote at length) or, if the page is now silent, replace it with a `not-stated` population or a `confirm` line and leave a `# TODO(verify)`.
4. Where the page now disagrees with another public source, show both in `prerequisites.differs`: one statement per source, each source also listed in the item's `sourceIds`, and advice that names the source that governs a purchase (the Product Terms).
5. Check [sources.yaml](../../content/sources.yaml): update the title, URL and `lastVerified` of the source, and add a new source only if a statement cites it.
6. Add or adjust tests in `src/lib/content/` for any rule or count that changed.
7. Add a [changelog](../../content/changelog.md) entry. Its `affects:` line lists the capability ids whose requirements or licensing changed, or `[all]`.
8. Run `npm run content:build`, `npm run check:public`, `npm run lint`, `npm run typecheck` and `npm test`, and fix any failure.
9. Summarize what changed, what is marked `TODO(verify)`, and what a licensing specialist should confirm.
