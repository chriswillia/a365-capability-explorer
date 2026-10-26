# How to update content

You do not need to be a developer. Capabilities, sources and all interface copy are YAML files in the [`content/`](../content) folder, and the site rebuilds itself when a change is merged.

## The flow

1. **Edit.** Open a file in `content/` on GitHub and select the pencil icon (the web editor).
2. **Propose.** Select **Commit changes**, choose **Create a new branch and start a pull request**, and open the pull request.
3. **Check.** CI validates the change. Open the **Checks** tab. A green tick means the content is valid. A red cross shows the exact file, entry and field to fix.
4. **Merge.** A maintainer reviews and merges.
5. **Publish.** The site redeploys to GitHub Pages automatically. A published change can take up to about ten minutes to appear.

## What the files are

| File                                                                     | Holds                                                                                               |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `capabilities.yaml`                                                      | The 26 capabilities: verbatim service-description text, availability, and editorial drafts          |
| `sources.yaml`                                                           | Every source, with its URL and when it was last verified                                            |
| `site.yaml`                                                              | All interface copy, page titles and the footer disclaimer                                           |
| `personas.yaml`                                                          | Role-based starting paths to available explorer lenses and Learn sections                           |
| `learn.yaml`                                                             | Conceptual flow, integration paths, product positioning and Frontier Firm phases                    |
| `building-blocks.yaml`                                                   | Related concepts; these do not add service-description capabilities                                 |
| `glossary.yaml`                                                          | Terms, aliases, definitions and source evidence                                                     |
| `faq.yaml`                                                               | Assumptions to check and verified answers; unknown answers stay empty                               |
| `questions.yaml`                                                         | Typed rule inputs, option labels and open-question guidance                                         |
| `rules.yaml`, `advisories.yaml`                                          | Conditions, recommendation levels, reasons, evidence and verification advice                        |
| `patterns.yaml`, `risks.yaml`                                            | Canonical pattern answers and editorial risk-to-capability associations                             |
| `samples.yaml`, `golden-scenarios.yaml`                                  | Illustrative overrides, authored expectations and nullable SME signoff                              |
| `integration-paths.yaml`, `frontier-phases.yaml`                         | Conditional builder checklists and editorial access-model associations                              |
| `mapping.yaml`, `what-ifs.yaml`                                          | Neutral organization, configured global checks, unknown licensing basis and answer-change scenarios |
| `pillars.yaml`, `consoles.yaml`, `control-points.yaml`, `lifecycle.yaml` | The labels and groupings that capabilities refer to                                                 |
| `changelog.md`                                                           | What changed, and which capabilities each change touches                                            |
| `source-snapshot.json`                                                   | The service description's feature table as published. Do not edit by hand                           |

## Rules of thumb

- **Official wording is verbatim.** Do not edit `featureText` or the three availability flags to fix a typo or "improve" them. If the service description changed, update `source-snapshot.json` and the capability together.
- **Never invent.** If you do not know a value, leave the field empty and add `# TODO(verify)` on the line above it.
- **No prices.** Link to the official page instead.
- **Editorial text stays `reviewStatus: draft`** until a subject-matter expert signs it off. Keep to the word limits: 40 words for `summary`, 30 for the other text fields.
- **Every claim needs a source** that exists in `sources.yaml`.
- Use "Essential", "Recommended" and "Consider" for recommendation levels. Never "Required".

## Add a capability

1. Copy an existing entry in `capabilities.yaml`. Give it a new kebab-case `id` that never changes once published.
2. Paste the feature text exactly as published, and set the console and the three availability flags from the service description.
3. Fill in the fit metadata (pillar, wave, layer, setup, lifecycle stages) and the editorial text, all as drafts.
4. Add an entry to `changelog.md` with an `affects:` line that lists the new id.
5. Update the expected numbers in `src/lib/content/catalog.test.ts` (see below).

6. Add at least one recommendation rule and one risk mitigation association. Update affected golden expectations intentionally.

The capability appears in the computed metrics, explorer and generated pattern matrix. Do not maintain a second pattern-to-capability list.

## Update rules or patterns

Change schemas and schema tests before adding a field. Conditions have exactly one operator per question leaf: `equals`/`in` for single choice, `includes`/`includesAny` for multiple choice, or `answered`/`unknown`. Groups use nonempty `all`/`any` or `not`. Use option values in data; the renderer supplies human-readable labels. Missing, empty and explicitly `unknown` answers preserve uncertainty, including under `not`. Multi-select `none` and `unknown` must be exclusive.

Each rule declares an organization or use-case scope and retains every recommendation's reason, evidence and source ids. Organization rules cannot depend on use-case questions. Recommendation levels are editorial, even when a source states the underlying applicability. Keep drafts until SME review. A YAML anchor shares the endpoint recommendation data between local-agent and organization shadow-AI rules; their conditions and reason origins remain separate.

Pattern answers and sample overrides are illustrative use-case inputs. `mapping.yaml` supplies the displayed neutral organization; do not silently inject large-estate or security-operations priorities. Readiness gap conditions belong in capability prerequisites or conditional global checks. Ready covers configured checks only, never product eligibility. Keep unverified licensing basis fields null with `TODO(verify)`.

Add a golden scenario for every pattern and sample: `mustInclude` means **Essential**, while `mustNotInclude` means absent at every level. Author expectations independently; never regenerate them from actual output to make a test pass. Leave `reviewedBy` and `reviewedOn` null until genuine SME signoff, then fill both together. Run `npm test` to exercise golden expectations and table-driven rule cases; a content build validates references but does not substitute for engine tests.

## Diagnostic questions

Update the question schema and its tests first when adding a question kind or field. Choices and scales use string-valued options; text, long-text and date fields have explicit maximum lengths and no option list. Dates use real `YYYY-MM-DD` values. Every question needs exactly one correctly scoped section and a consultant note in `diagnostic.yaml`. Quick-scan ids must exist. Visibility conditions use the same validated three-valued condition language as rules.

Question ids and option values are persisted data: avoid renaming them casually. Older incompatible answers are preserved on load, block live previews, and can be corrected or explicitly cleared; they are never silently coerced. Organization-profile edits affect all linked assessments. Quick/Full switching changes the questions shown, not the answers saved. Pattern customization seeds only use-case answers, retaining the selected organization.

All diagnostic and readout copy is in `site.yaml`. Readout takeaways use computed `{count}` values; canvas boxes reference question ids and are checked for duplicate ids and unknown questions. Empty question lists deliberately leave a workshop discussion box, not an invented answer. Document storage keys, deletion behavior and export privacy on Privacy.

Run schema, reference, storage, wizard, transfer, report and browser tests when changing these behaviors. JSON backups use a strict versioned envelope; never silently accept a new format or overwrite local entities during import. Imports create new ids and remap relationships while retaining original answers for explicit compatibility checks. Update round-trip, invalid-file, download and A4/Letter print checks when changing exports.

Readout exhibit labels, notices, PowerPoint copy and logo-validation messages are schema-validated site data. Keep the eleven exhibit numbers stable and preserve Executive/Technical gating. Markdown and speaker notes carry the full technical detail; any visual PowerPoint shortening must remain explicitly disclosed. Check exactly six readout slides and one canvas slide, no external asset relationships, complete speaker notes and local rendering when changing presentation layouts. Safe logos are optional assessment data in workspace v1; do not add defaults to legacy records, accept URLs/SVG, bypass normalization or write outside the storage adapter.

## When CI fails

### Learning content

Learning items need a `sourceId`, `evidence`, `reviewStatus` and `lastVerified`. Keep text draft until SME approval. Use `summary:` or `fact:` with no value, `lastVerified:` with no value, and a `# TODO(verify)` comment when the source is not verified. The UI displays a pending-verification notice. Do not fill a missing fact from memory or copy the unverified build brief's claims.

`capabilityIds` must reference catalog ids; related building blocks never increase catalog metrics. Technical guidance needs `technicalSourceId`. Glossary terms and aliases must be unique ignoring case. Persona links must point to an available Learn anchor or explorer lens, not a future assessment. The content build checks all of these references and warns about stale or unverified learning items.

| The message says                   | What to do                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `Unrecognized key: "sumary"`       | A field name is misspelled                                                   |
| `unknown source "a365-registy"`    | The `sourceId` is not in `sources.yaml`                                      |
| `must be 40 words or fewer`        | Shorten the text                                                             |
| `duplicate value "…"`              | Two entries share an id                                                      |
| `unknown placeholder {…}`          | A `{placeholder}` in `site.yaml` is not one of the computed values           |
| `catalog.test.ts` fails on a count | You changed the catalog on purpose. Update the expected numbers in that test |

Warnings (stale `lastVerified`, unverified facts and unsigned golden scenarios) do not fail the build. Orphaned sources now fail content builds: cite them in a meaningful displayed surface or remove them. Unknown questions/options, mismatched scopes/operators and missing capability/risk/rule/scenario coverage also fail.

## Check it on your computer

```bash
npm ci
npm run content:build   # validates and compiles /content
npm run dev             # shows the site
```
