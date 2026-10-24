---
description: 'Use when editing content YAML or the changelog: capabilities, sources, rules, patterns, risks, licensing notes, glossary or site copy. Covers verbatim source text, required fields, evidence tags, review status, lastVerified and the no-prices rule.'
applyTo: 'content/**'
---

# Editing content

- `source.featureText` and the three availability flags in `capabilities.yaml` are copied from the Microsoft Agent 365 service description (`sd-a365`). Do not paraphrase or "fix" them. The content tests compare them with `source-snapshot.json` after normalization.
- Editorial fields (summary, executiveValue, withoutIt, withIt, questions, tags, pillar, wave, layer, setup, lifecycle stages) stay `reviewStatus: draft` until a subject-matter expert signs them off. Respect the word limits: summary 40 words, the other text fields 30.
- Every claim needs a `sourceId` that exists in `sources.yaml`. Evidence tags: `stated` (a source says it), `inferred` (follows from the official description), `judgment` (advisor judgment, needs SME review).
- Never invent capabilities, statuses, licensing statements or URLs. Leave an unknown value empty and add `# TODO(verify)`. Set `status` (preview, frontier-preview) only when a source states it.
- Set `lastVerified` to the date you checked the source. Values older than 90 days produce a build warning.
- No prices anywhere. Link to the official page instead.
- Recommendation levels are "Essential", "Recommended" and "Consider". Never "Required": that word belongs to the service description's licensing column.
- Write in a neutral, factual voice, and paraphrase rather than copying long passages. Follow [the style guide](../../docs/CONTENT-STYLE.md).
- Add an entry to `changelog.md` with an `affects:` list of capability ids (`[all]` for the whole catalog). Wording-only changes to site copy do not need one.
- Run `npm run content:build` before committing. It fails on unknown references, duplicate ids and invalid values.
