---
description: 'Turn a source-change issue (a changed Microsoft Agent 365 service description) into the content updates: capability YAML, source snapshot, proposed rules, risk, layer and lifecycle mappings, golden scenarios, changelog and tests.'
argument-hint: 'Issue number, or the added, removed or changed rows'
agent: 'agent'
---

Handle the service-description change described in the issue (or in the text I give you). Follow [the content rules](../instructions/content.instructions.md).

1. Fetch the live service description (source `sd-a365` in [sources.yaml](../../content/sources.yaml)). List each added, removed or changed row exactly as published, and note the page's last-updated date. If you cannot confirm a value, stop and say so instead of guessing.
2. Update [source-snapshot.json](../../content/source-snapshot.json) with the raw published rows (escape non-ASCII characters) and the new `pageUpdatedAt`.
3. For each added or changed row, edit [capabilities.yaml](../../content/capabilities.yaml): verbatim `featureText`, the three availability flags, the console and `lastVerified` set to today. Draft the fit metadata (pillar, wave, layer, setup, lifecycle stages) and the editorial text as `reviewStatus: draft`, within the word limits and the sources.
4. For a removed row, list every rule, risk, pattern and golden scenario that references it before removing it.
5. If `content/rules.yaml`, `content/risks.yaml`, `content/patterns.yaml` or `content/golden-scenarios.yaml` exist, propose the changes there: rules with an evidence tag and source on every recommendation, risk and layer mappings, and `mustInclude` or `mustNotInclude` entries. Leave `reviewedBy` and `reviewedOn` empty.
6. Add a [changelog](../../content/changelog.md) entry whose `affects:` line lists the capability ids.
7. Say what the capability needs and how it treats the way the agent acts, from public Microsoft pages only. Add its prerequisites to [requirements.yaml](../../content/requirements.yaml), each with a source, `lastVerified`, an `askPrompt` (the question to ask the customer, 30 words or fewer) and `appliesTo` only where the source says where it applies. Add a row to [access-patterns.yaml](../../content/access-patterns.yaml) only if a Microsoft page says delegated access, own access or an agent account differ for it; otherwise leave it out, and the card says "not split by Microsoft". Place the capability in exactly one value theme in [value.yaml](../../content/value.yaml).
8. Update the expected numbers in [catalog.test.ts](../../src/lib/content/catalog.test.ts) to match the new catalog, and add or adjust tests for any new rule.
9. Run `npm run content:build`, `npm run lint`, `npm run typecheck` and `npm test`, and fix any failure.
10. Summarize what changed, what is marked `TODO(verify)`, and which kind of SME should review it (Entra, Purview, Defender, Intune, Microsoft 365 admin or licensing).
