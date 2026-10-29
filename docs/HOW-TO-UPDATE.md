# How to update content

You do not need to be a developer. Capabilities, sources and all interface copy are YAML files in the [`content/`](../content) folder, and the site rebuilds itself when a change is merged.

## The flow

1. **Edit.** Open a file in `content/` on GitHub and select the pencil icon (the web editor).
2. **Propose.** Select **Commit changes**, choose **Create a new branch and start a pull request**, and open the pull request.
3. **Check.** CI validates the change. Open the **Checks** tab. A green tick means the content is valid. A red cross shows the exact file, entry and field to fix.
4. **Merge.** A maintainer reviews and merges.
5. **Publish.** The site redeploys to GitHub Pages automatically. A published change can take up to about ten minutes to appear.

## What the files are

| File                                                                     | Holds                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capabilities.yaml`                                                      | The 26 capabilities: verbatim service-description text, availability, and editorial drafts                                                                                                                              |
| `sources.yaml`                                                           | Every source, with its URL and when it was last verified                                                                                                                                                                |
| `site.yaml`                                                              | All interface copy, page titles and the footer disclaimer                                                                                                                                                               |
| `personas.yaml`                                                          | Role-based starting paths to available explorer lenses and Learn sections                                                                                                                                               |
| `learn.yaml`                                                             | Conceptual flow, integration paths, product positioning and Frontier Firm phases                                                                                                                                        |
| `building-blocks.yaml`                                                   | Related concepts; these do not add service-description capabilities                                                                                                                                                     |
| `glossary.yaml`                                                          | Terms, aliases, definitions and source evidence                                                                                                                                                                         |
| `faq.yaml`                                                               | Assumptions to check and verified answers; unknown answers stay empty                                                                                                                                                   |
| `questions.yaml`                                                         | Typed rule inputs, option labels and open-question guidance                                                                                                                                                             |
| `rules.yaml`, `advisories.yaml`                                          | Conditions, recommendation levels, reasons, evidence and verification advice                                                                                                                                            |
| `patterns.yaml`, `risks.yaml`                                            | Canonical pattern answers and editorial risk-to-capability associations                                                                                                                                                 |
| `samples.yaml`, `golden-scenarios.yaml`                                  | Illustrative overrides, authored expectations and nullable SME signoff                                                                                                                                                  |
| `integration-paths.yaml`, `frontier-phases.yaml`                         | Conditional builder checklists and editorial access-model associations                                                                                                                                                  |
| `mapping.yaml`, `what-ifs.yaml`                                          | Neutral organization, configured global checks, unknown licensing basis and answer-change scenarios                                                                                                                     |
| `pillars.yaml`, `consoles.yaml`, `control-points.yaml`, `lifecycle.yaml` | The labels and groupings that capabilities refer to; each pillar's `requirement` names it for customers                                                                                                                 |
| `conversation.yaml`                                                      | Facilitation advice for the customer conversation guide. It states no product facts                                                                                                                                     |
| `value.yaml`                                                             | The value story: pitches by seller, the problem, outcomes by capability, buyers, pushback, proof, openings by customer situation (`entryPoints`), the discovery-question picker, plans                                  |
| `licensing.yaml`, `requirements.yaml`                                    | Who to license by how the agent acts, the license calculator (`calculator`), what the Product Terms require, where public sources differ, and what each capability needs, with where it applies and the question to ask |
| `access-patterns.yaml`                                                   | Delegated access, own access and an agent account, what Microsoft documents for each, and the access fit shown on capability cards                                                                                      |
| `guardrails.yaml`                                                        | The production checklist in three gates, with when each applies, what shows it is in place and how to prove it works (`proveIt`)                                                                                        |
| `fit.yaml`                                                               | How each agent platform connects, the platforms Microsoft lists for registry sync (`connected`), and what Agent 365 adds to the Microsoft tools a customer runs                                                         |
| `passport.yaml`                                                          | The six agent-passport questions in the seller's words, the three-question access helper and the result card                                                                                                            |
| `deploy.yaml`                                                            | The go-live page and the 30, 60 and 90 day plan, which maps each period to one gate and one roadmap wave                                                                                                                |
| `leave-behind.yaml`                                                      | The one-page summary and three-slide deck: labels, the speaker notes and the problem statements that say why it matters                                                                                                 |
| `changelog.md`                                                           | What changed, and which capabilities each change touches                                                                                                                                                                |
| `source-snapshot.json`                                                   | The service description's feature table as published. Do not edit by hand                                                                                                                                               |

## Rules of thumb

- **Official wording is verbatim.** Do not edit `featureText` or the three availability flags to fix a typo or "improve" them. If the service description changed, update `source-snapshot.json` and the capability together.
- **Never invent.** If you do not know a value, leave the field empty and add `# TODO(verify)` on the line above it.
- **No prices.** Link to the official page instead.
- **Editorial text stays `reviewStatus: draft`** until a subject-matter expert signs it off. Keep to the word limits: 40 words for `summary`, 30 for the other text fields.
- **Every claim needs a source** that exists in `sources.yaml`.
- Use "Essential", "Recommended" and "Consider" for recommendation levels. Never "Required".

## Portfolio and workshop content

`site.yaml` holds portfolio labels, quadrant labels and draft planning cutoffs (`valueCutoff` and `intensityCutoff`). These are discussion aids, not Microsoft recommendations, a financial valuation or a risk score. Keep the chart disclosure synchronized with the configured values; numeric values are inserted through templates. Relative value uses the existing `businessValue` scale. Expected-user options remain bands, not precise headcounts or license quantities.

`workshop.yaml` holds the editorial facilitator guide and the labels of the printable requirements checklist. Minutes are positive integers and agenda ids are unique; the duration headline is computed from the agenda. Keep `reviewStatus: draft` until reviewed. The checklist rows and the printable cards derive from capabilities, patterns and rules. Do not copy their mappings into workshop content. Recheck paired-card printing, and that the checklist prints one requirement area per page, on A4 and Letter after lengthening summaries or rule conditions.

## Seller playbook content

`value.yaml`, `licensing.yaml`, `requirements.yaml`, `access-patterns.yaml`, `guardrails.yaml` and `fit.yaml` drive the Pitch, Licensing, How agents act and Stack fit pages, the "What it needs" and "How the agent acts" sections of each capability page, the guardrails in the assessment review and readout, and the licensing and access exhibits. The build checks that they agree with each other and with the questions.

- **A statement of fact needs `sourceIds`, an `evidence` tag and `lastVerified`.** `lastVerified` is the date a person read the source. It must not be in the future. The build warns when it is more than 90 days old, and after 30 days for `licensing.yaml` and `requirements.yaml`, which change faster. Read the Microsoft page again before you move the date. Paraphrase rather than quote, and never copy a price.
- **Say when Microsoft is silent.** Use `not-stated` (access patterns, licensing populations) and a `confirm` line that tells the seller what to ask a licensing specialist. Do not fill a gap from memory. If two sources differ, say so and name both (see `tension` in `access-patterns.yaml`).
- **Where sources differ on the prerequisite, show each one.** `prerequisites.differs` in `licensing.yaml` lists, per topic, what each public page says in its own statement. Each statement names a `sourceId` that the item also lists in `sourceIds`, and no source appears twice in one item. The Product Terms govern a purchase, and the advice line says so.
- **A requirement says where it applies and what to ask.** Each item in `requirements.yaml` has an `askPrompt`: the question to put to the customer while the answer is unknown, 30 words or fewer and ending in a question mark. `appliesTo` (each licensed user, the whole tenant, each device, each agent or the data the agent uses) is set only where the source says where the requirement applies. Leave it out rather than guess.
- **Access fit is derived, not authored.** The chip on a capability card reads the capability's row in `access-patterns.yaml`. A capability with no row shows "Access: not split by Microsoft", which is not the same as "the same for every pattern". Add a row only when a Microsoft page states how the capability treats delegated access, own access or an agent account, and cite it.
- **Use Microsoft's terms.** Delegated access (on behalf of a user), own access (the agent acts with its own identity, credentials or access) and an agent account (the agent also has its own user account). The Microsoft pages reviewed do not say "owned", so neither does the site.
- **One home for each capability.** Every capability belongs to exactly one value theme in `value.yaml`. A new capability fails the build until it has a theme.
- **Questions stay the single source of answers.** Conditions in `guardrails.yaml`, `requirements.yaml` and `licensing.yaml` refer to question ids and option values in `questions.yaml`. An unanswered question is "to confirm", never a gap, so prefer a condition on a single-choice question over `answered`. The same holds when a guardrail's applicability is unknown: it shows "to confirm" until the answers say it applies. If you rename an option, the build lists everything that referred to it.
- **Guardrails are editorial.** `appliesWhen` decides whether an item matters for the agent and `doneWhen` reads the customer's answers to say whether it is in place. Neither checks a tenant, and the page says so. Keep items to the three gates (`pilot`, `production`, `scale`).
- **Selling as changes emphasis only.** The `ai`, `security` and `joint` text in `value.yaml` may differ; the capabilities, sources and licensing facts may not.
- **Platform and tool choices** in `fit.yaml` list the `buildPlatform` answers each platform entry covers (`buildPlatforms`); every answer except `other` must map to exactly one entry.
- **Link only to pages of this site.** Links in `site.yaml`, `conversation.yaml` and `personas.yaml` are checked against the routes.
- **Write counts with the plural form.** A template such as `{count} {count?answer comes|answers come}` chooses the singular or plural wording from the number, so a sentence never reads "1 are".

When you change any of these files, add an entry to `changelog.md` with an `affects:` line, and update the golden expectations only if a rule changed.

## Seller workflow content

`passport.yaml`, `leave-behind.yaml` and `deploy.yaml`, and the newer blocks of `licensing.yaml`, `value.yaml`, `guardrails.yaml`, `fit.yaml` and `site.yaml`, drive the pages a seller uses once the conversation is about one agent. The rules above about sources, silence and drafts apply to all of them. In addition:

- **Passport questions reuse diagnostic questions.** Each of the six entries in `passport.yaml` names a question id from `questions.yaml` and gives it a seller-facing wording and a hint. The answer options are the diagnostic question's, so what the passport saves is what Full discovery and the rules read; the build fails when an id is missing or is not a use-case question. The three-question access helper is the site's own wording, not Microsoft's, and its note says so. Keep that note.
- **Calculator plan families need a source.** Each entry in `licensing.yaml` under `calculator.planFamilies` has a `standing` (`included`, `qualifies`, `does-not-qualify` or `unknown`), a short explanation, `sourceIds`, an `evidence` tag and `lastVerified`. Mark a plan `included` only where a Microsoft page says Agent 365 comes with it (today, Microsoft 365 E7). Add a plan as `qualifies` only where the Product Terms or the FAQ name it as a prerequisite. A plan Microsoft does not mention belongs under `unknown`, which the calculator does not count. The seller's numbers are the seller's: never add example quantities.
- **Every guardrail says how to prove it.** `proveIt` in `guardrails.yaml` is required, in 35 words or fewer. Write the evidence a seller can ask the customer to show, for example a report, a policy or a log, and do not promise that Microsoft's product produces it unless a source says so.
- **A go-live period takes one gate.** In `deploy.yaml`, each period names one gate (`pilot`, `production` or `scale`) and one roadmap wave, and no gate or wave is repeated. The build fails otherwise.
- **The leave-behind says why from Microsoft's words.** `whyStatementIds` in `leave-behind.yaml` must name problem statements in `value.yaml`. How much fits on the page and the slides is set in code (`CONTROL_LIMIT`, `STEP_LIMIT` and `QUESTION_LIMIT` in `src/lib/engine/leave-behind.ts`), and an end-to-end test prints the fullest agent on A4 and Letter and expects one page, so keep labels short and run it after you lengthen any.
- **Openings by customer situation are seller guidance.** Each entry under `entryPoints` in `value.yaml` has the situation, a way to open the conversation (60 words or fewer), the licensing path (60 words or fewer), links to pages of this site, sources, an evidence tag and a date. Say what Microsoft states and nothing about a customer's contract.
- **Proof points say whose figure it is.** A survey Microsoft commissioned is said to be Microsoft's, and independent research, such as Deloitte's, is said to be independent. Each has its own caveat. Never round a figure up.
- **Connected platforms are a table of what Microsoft lists.** `fit.yaml` `connected.rows` copies the platform, the supported environment and the observability status (`yes`, `coming-soon` or `frontier`) from Microsoft's Connected platforms page. Re-read the page and move `lastVerified` when you change a row. Do not add a claim about how a platform is governed.
- **The sample customer is fictional.** `ui.sample` in `site.yaml` names the customer, its industry and the scenarios its agents start from (`sampleIds`, each an id in `samples.yaml`, at most five). Keep the name obviously fictional, never a real company, and keep the scenarios covering both delegated and own access, which a test checks.

When you change any of these, add an entry to `changelog.md` with an `affects:` line.

## Pages that show one part at a time

Pitch, Licensing, Deploy and the example agents show one part of the page at a time, chosen by `?view=` in the address. Each page lists its parts in `VIEWS` in its page file (`ValuePage.tsx`, `LicensingPage.tsx`, `DeployPage.tsx`, `PatternsPage.tsx` and `PatternPage.tsx`). The labels are in YAML: `views` in `value.yaml` and `licensing.yaml`, `mapping.views` in `site.yaml`, and the gate titles in `guardrails.yaml`, which Deploy uses for its gate parts.

- **A new section goes in a part.** Put it where a seller would look for it and add its id to that part's `sections`, or an id prefix to `prefixes` for ids made from data. A link such as `/licensing#plans` opens the part that holds `plans`, so every existing link keeps working. A section that is in no part is never shown.
- **Link into a section with a `#hash`.** Links in the YAML (`to:`) can name a section but never `?view=`; the schema accepts only a hash.
- **Keep a part to about five screens.** An end-to-end test measures every part at 1280 by 800 and fails past five. Split the part, or fold detail into a closed panel (`AnchoredDetails`, which a link can open, or a plain `<details>`), instead of letting it grow.
- **Anything a seller types stays mounted.** Give a part that holds an input or a picker `keep` on its `ViewPane`, so leaving the part does not lose what was entered.

## Before you publish: the public-safety guard

This repository and the site are public. Use only public Microsoft sources, such as Microsoft Learn, the Microsoft Product Terms, the Microsoft licensing FAQs, microsoft.com pages and official Microsoft blogs. Never commit internal Microsoft documents, decks, FAQs or roadmaps (or text copied from them), links to internal sites, customer names or deal data, pipeline or compensation information, or colleagues' names.

`npm run check:public` enforces the mechanical part. It scans `content/`, `src/`, `public/` and the built site (`dist-root/`, `dist-repo/` and `dist/`), and fails on:

- a blocked phrase, such as a confidentiality marking, "do not share" or NDA wording;
- a link to a blocked host, such as an internal SharePoint, BI, ticketing or Teams address;
- an `aka.ms` link that `sources.yaml` does not list with a verified date;
- an email address, except on the reserved example domains.

The phrases, hosts and allowed domains are in `scripts/public-safety.config.json`. Keep phrases specific: "confidential" alone is also the name of a sensitivity label, so it is not blocked. `docs/` is not scanned, so a brief that describes these rules does not trip the guard. CI runs it after the build, and the deploy workflow runs it again before anything is published. It does not replace judgement: if a source is not public, do not use it.

## Seller guidance content

`conversation.yaml` holds only editorial advice for the customer conversation guide: the steps, section labels and the note about unverified myth-and-fact answers. The capabilities, discovery questions, owner teams and licensing and availability counts on that page are computed from `capabilities.yaml` and `consoles.yaml`, so fix a question or an owner at its source rather than on the page. Links in `conversation.yaml` must target a page of this site. Keep `reviewStatus: draft` until reviewed, and do not present the steps as an approved sales process.

Each pillar's `requirement` in `pillars.yaml` (Security, Governance, Observability) is the name customers hear; the short `label` is shown beside it. The workshop checklist, the readout's requirement-area exhibit and the canvas strip all group by it.

The site says "Area" (short) and "requirement area" (spelled out) for the `pillars.yaml` entries, "Where it's configured" for the `consoles.yaml` entries, "Example agents" for `patterns.yaml` (the page that lists them is "Scope an agent"), "Agent passport" for the six-question assessment, "Full discovery" for its longer form ("Add detail" where it follows the passport), "Agent portfolio" for the portfolio and "customer" for the organization profile. A capability is "Included (no Agent 365 license needed)" or "Needs Agent 365 (or E7/G7)", and its setup is "Set up once", "Decide per agent" or "Set up once + decide per agent". Keep to those words in `site.yaml`, and say "Agent 365" in prose. Ids, file names and route paths keep their old names. `feedbackEmail` in `site.yaml` stays empty until the owner supplies a monitored address; do not invent one.

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

Pattern answers and sample overrides are illustrative use-case inputs. Each pattern answers `accessModel`, which its card and brief show as "how the agent acts"; keep one pattern for every way of acting, including `mixed` (delegated in chat plus own access for background jobs). `mapping.yaml` supplies the displayed neutral organization; do not silently inject large-estate or security-operations priorities. Readiness gap conditions belong in capability prerequisites or conditional global checks. Ready covers configured checks only, never product eligibility. Keep unverified licensing basis fields null with `TODO(verify)`.

Add a golden scenario for every pattern and sample: `mustInclude` means **Essential**, while `mustNotInclude` means absent at every level. Author expectations independently; never regenerate them from actual output to make a test pass. Leave `reviewedBy` and `reviewedOn` null until genuine SME signoff, then fill both together. Run `npm test` to exercise golden expectations and table-driven rule cases; a content build validates references but does not substitute for engine tests.

## Diagnostic questions

Update the question schema and its tests first when adding a question kind or field. Choices and scales use string-valued options; text, long-text and date fields have explicit maximum lengths and no option list. Dates use real `YYYY-MM-DD` values. Every question needs exactly one correctly scoped section, a consultant note and an `askPrompts` entry in `diagnostic.yaml`. The ask prompt is the question as a seller would put it to a customer, in plain words; the build fails when one is missing. Which requirement areas a question informs is derived from the rules and readiness checks, so do not write it by hand. Quick-scan ids must exist. Visibility conditions use the same validated three-valued condition language as rules.

Question ids and option values are persisted data: avoid renaming them casually. Older incompatible answers are preserved on load, block live previews, and can be corrected or explicitly cleared; they are never silently coerced. Customer-profile edits affect all linked assessments. Quick/Full switching changes the questions shown, not the answers saved. Scenario customization seeds only use-case answers, retaining the selected customer, and marks those answers as assumed until the seller confirms or changes them.

All diagnostic and readout copy is in `site.yaml`. Readout takeaways use computed `{count}` values; canvas boxes reference question ids and are checked for duplicate ids and unknown questions. Empty question lists deliberately leave a workshop discussion box, not an invented answer. Document storage keys, deletion behavior and export privacy on Privacy.

Run schema, reference, storage, wizard, transfer, report and browser tests when changing these behaviors. JSON backups use a strict versioned envelope; never silently accept a new format or overwrite local entities during import. Imports create new ids and remap relationships while retaining original answers for explicit compatibility checks. Update round-trip, invalid-file, download and A4/Letter print checks when changing exports.

Readout exhibit labels, notices, PowerPoint copy and logo-validation messages are schema-validated site data. Keep the exhibit order in `src/lib/readout/plan.ts` and the titles in `site.yaml` in step, and preserve Executive/Technical gating: numbers are positions in that view's plan, so a new exhibit renumbers the ones after it everywhere at once. Markdown carries the full technical detail. Each PowerPoint slide's speaker notes carry what to say (`readout.slideNotes` in `site.yaml`) and the detail that slide has to shorten, built in `src/lib/readout/notes.ts`; any visual shortening must remain explicitly disclosed. Check exactly eight readout slides and one canvas slide, no external asset relationships, per-slide speaker notes and local rendering when changing presentation layouts. Safe logos are optional assessment data in workspace v1; do not add defaults to legacy records, accept URLs/SVG, bypass normalization or write outside the storage adapter. The same holds for `assumedQuestionIds`, which is optional, display-only and never written for assessments that did not start from a scenario.

## When CI fails

### Learning content

Learning items need a `sourceId`, `evidence`, `reviewStatus` and `lastVerified`. Keep text draft until SME approval. Use `summary:` or `fact:` with no value, `lastVerified:` with no value, and a `# TODO(verify)` comment when the source is not verified. The UI displays a pending-verification notice. Do not fill a missing fact from memory or copy the unverified build brief's claims.

`capabilityIds` must reference catalog ids; related building blocks never increase catalog metrics. Technical guidance needs `technicalSourceId`. Glossary terms and aliases must be unique ignoring case. Persona links must point to a page of this site: a Learn anchor, the explorer or the customer conversation guide, not a future assessment. The content build checks all of these references and warns about stale or unverified learning items.

| The message says                    | What to do                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `Unrecognized key: "sumary"`        | A field name is misspelled                                                                                     |
| `unknown source "a365-registy"`     | The `sourceId` is not in `sources.yaml`                                                                        |
| `must be 40 words or fewer`         | Shorten the text                                                                                               |
| `duplicate value "…"`               | Two entries share an id                                                                                        |
| `unknown placeholder {…}`           | A `{placeholder}` in `site.yaml` is not one of the computed values                                             |
| `catalog.test.ts` fails on a count  | You changed the catalog on purpose. Update the expected numbers in that test                                   |
| `Public-safety guard: N finding(s)` | A phrase, link, `aka.ms` address or email address looks internal or private. Remove it, or use a public source |

Warnings (stale `lastVerified`, unverified facts and unsigned golden scenarios) do not fail the build. `lastVerified` goes stale after 90 days, or after 30 days in `licensing.yaml` and `requirements.yaml`. Orphaned sources now fail content builds: cite them in a meaningful displayed surface or remove them. Unknown questions/options, mismatched scopes/operators and missing capability/risk/rule/scenario coverage also fail.

## Check it on your computer

```bash
npm ci
npm run content:build   # validates and compiles /content
npm run dev             # shows the site
npm run check:public    # after a build: nothing internal in the content, source or built site
```
