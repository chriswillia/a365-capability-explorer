---
description: 'Use when editing content YAML or the changelog: capabilities, sources, rules, patterns, risks, licensing notes, glossary or site copy. Covers verbatim source text, required fields, evidence tags, review status, lastVerified and the no-prices rule.'
applyTo: 'content/**'
---

# Editing content

- `source.featureText` and the three availability flags in `capabilities.yaml` are copied from the Microsoft Agent 365 service description (`sd-a365`). Do not paraphrase or "fix" them. The content tests compare them with `source-snapshot.json` after normalization.
- Editorial fields (summary, executiveValue, withoutIt, withIt, questions, tags, pillar, wave, layer, setup, lifecycle stages) stay `reviewStatus: draft` until a subject-matter expert signs them off. Respect the word limits: summary 40 words, the other text fields 30.
- Every claim needs a `sourceId` that exists in `sources.yaml`. Evidence tags: `stated` (a source says it), `inferred` (follows from the official description), `judgment` (an editorial recommendation; the Technical view shows it as "Recommendation (needs review)").
- Never invent capabilities, statuses, licensing statements or URLs. Leave an unknown value empty and add `# TODO(verify)`. Set `status` (preview, frontier-preview) only when a source states it.
- Set `lastVerified` to the date you checked the source. Values older than 90 days produce a build warning, and so do licensing and requirements values older than 30 days.
- No prices anywhere. Link to the official page instead.
- Use only public Microsoft sources, and never copy text from or link to internal material. `npm run check:public` rejects confidentiality markings, internal hosts, unlisted `aka.ms` links and email addresses.
- Every item in `requirements.yaml` needs an `askPrompt`: the question to ask the customer while the answer is unknown (30 words or fewer, ending in a question mark). Set `appliesTo` only where the source says where the requirement applies.
- Where public sources describe the same thing differently, add each statement to `prerequisites.differs` in `licensing.yaml`, with the source also listed in the item's `sourceIds`. Do not pick one.
- A row in `access-patterns.yaml` needs a source that says delegated access, own access or an agent account differ for the capability. Capabilities without a row show "not split by Microsoft".
- A plan family in `licensing.yaml` `calculator.planFamilies` is `included` only where a Microsoft page says Agent 365 comes with it, and `qualifies` only where the Product Terms or the FAQ name it as a prerequisite. A plan Microsoft does not mention is `unknown`. Never add example quantities.
- Every guardrail in `guardrails.yaml` needs `proveIt`: how a seller can ask the customer to show it is in place (35 words or fewer).
- A proof point says whose figure it is: Microsoft's, a survey Microsoft commissioned, or independent research. Do not round a figure up.
- The sample customer in `site.yaml` `ui.sample` is fictional, and its `sampleIds` name entries in `samples.yaml` that cover both delegated and own access.
- Recommendation levels are "Essential", "Recommended" and "Consider". Never "Required": that word belongs to the service description's licensing column.
- Write in a neutral, factual voice, and paraphrase rather than copying long passages. Follow [the style guide](../../docs/CONTENT-STYLE.md).
- Add an entry to `changelog.md` with an `affects:` list of capability ids (`[all]` for the whole catalog). Wording-only changes to site copy do not need one.
- Run `npm run content:build` before committing. It fails on unknown references, duplicate ids and invalid values.
