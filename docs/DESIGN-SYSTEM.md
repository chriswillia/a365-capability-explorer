# Design system: Frontier Executive

A confident, calm, modern look in the spirit of a consulting-firm client tool. Every brand decision lives in [`src/theme/tokens.ts`](../src/theme/tokens.ts). It feeds the CSS variables (injected into `index.html` at build time) and the Fluent UI v9 theme ([`fluentTheme.ts`](../src/theme/fluentTheme.ts)). The values are placeholders until brand-approved values arrive. No Microsoft logos or Frontier Firm artwork ship unless approved assets are placed in `public/brand/`.

## Color

| Token                            | Value                  | Use                                                                |
| -------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| `ink`                            | `#0A1A2F`              | Text, dark bands (16.5:1 on paper)                                 |
| `slate`                          | `#5A6B82`              | Secondary text (5.1:1 on paper)                                    |
| `paper`                          | `#FAF8F4`              | Page canvas                                                        |
| `white`                          | `#FFFFFF`              | Cards                                                              |
| `hairline`                       | `#E4DFD6`              | Decorative rules only (1.25:1, so never a control border)          |
| `blue`                           | `#0078D4`              | Fills, focus rings, large text. Hover `#106EBE`, pressed `#005A9E` |
| `link`                           | `#106EBE`              | Link text on paper (4.95:1). `#0078D4` is only 4.27:1 there        |
| `controlBorder`                  | `#7C8AA0`              | Borders of form controls (at least 3:1, WCAG 1.4.11)               |
| `frontierFrom` → `frontierTo`    | `#0078D4` → `#7B5CD6`  | Only the hero band, the phase rail and accent rules                |
| `amberText` on `amberBackground` | `#8A5300` on `#FFF4DE` | "Sources differ, verify" (5.8:1)                                   |

- **Levels:** Essential is solid ink navy, Recommended is interactive blue, Consider is a slate outline.
- **Evidence tags:** Stated is a solid outline, Inferred a dashed outline, Advisor judgment a dotted outline with a text label.
- **Heatmaps:** one blue hue, light to dark (`heat` in the tokens).
- **Color is never the only signal.** Always pair it with text or an icon.

[`tokens.test.ts`](../src/theme/tokens.test.ts) encodes the contrast rules, so a token change cannot break WCAG 2.2 AA silently. [`no-raw-colors.test.ts`](../tests/no-raw-colors.test.ts) fails on a raw color outside `src/theme`.

## Type

- **Display and exhibit titles:** Source Serif 4, weights 600 and 700, self-hosted through Fontsource (Latin subset).
- **Interface and body:** Segoe UI Variable, then Segoe UI, then the system font.
- **Scale:** 12, 14, 16, 20, 24, 32, 44, 56 px, set in rem so it follows the reader's browser settings.
- **Numbers:** tabular numerals in tables and KPI tiles.
- **Eyebrows:** small, uppercase, letter-spaced, for example "EXHIBIT 2 · OBSERVE, GOVERN, SECURE".

## Layout

A 12-column grid with a 1,240px maximum width and an 8-point spacing scale (with a 4px half step). Hairline rules and 2–4px radii. Shadows appear on overlays only. Fluent UI System Icons are used sparingly; no emoji and no stock imagery.

## Motion and print

Motion is 150–200ms and respects `prefers-reduced-motion`. Print output hides navigation and keeps the disclaimer. Readouts extend `print.css` with a cover page, expanded evidence, responsive tables and a running draft/version/disclaimer footer in CSS page-margin boxes. The document-end disclaimer is also retained for browsers without margin-box support. Canvases use a landscape grid for Letter and A4. Blank and filled canvases are one page; filled print views show bounded summaries with a visible shortening notice, while complete answers remain on screen and in the readout/Markdown.

PowerPoint uses token-derived ink/paper/white/slate, Georgia and Segoe UI fallback fonts, editable shapes/text and locally embedded optional logos. The eight-slide readout alternates dark cover/conclusion with light requirement-area, summary, anatomy, risk, guardrails and roadmap layouts. The canvas uses eleven compact discussion boxes on one slide. Every slide carries a draft/version/disclaimer and a speaker-note detail notice. Dense inputs are explicitly summarized rather than silently shrunk into unreadable text; each slide's own speaker notes hold what to say and the detail it shortens. Out-of-scope anatomy uses muted slate plus explicit scope labels, never color alone.

Portfolio charts use token-based shapes and numbered bubbles with a full table alternative. Expected-user bands control illustrative area, never fabricated headcounts; unknown ranges have dashed outlines. Heatmap levels retain visible text as well as color. Scroll regions make wide comparisons keyboard-accessible and remain contained on mobile. In a scroll region the row header stays in view while the other columns scroll (from 40rem up), and a hint says to scroll sideways when the table is wider than the screen; the hint is hidden from assistive technology, which already hears that the region scrolls, and from print. The readout toolbar is sticky only from 64rem, and each exhibit keeps a scroll margin below it, so a Contents link never lands a heading under the toolbar. Workshop cards pair front/back content with a dashed fold boundary and keep pairs together in print; the requirements checklist prints one requirement area per page with ruled write-in cells. Presentation mode enlarges type and hides editing controls without entering browser fullscreen or storing a preference; an always-available exit button and Escape restore the normal view.

## Patterns for a seller's workflow

- **Disclosure for the less common.** Actions that most visits do not need (more ways to share, the logo editor, a saved assessment's rename and delete, customer management, backup, the rules behind a recommendation) sit in a native `<details>` section whose summary says what is inside. They open for print, and anything linked to by address opens its section first.
- **Sticky bars carry one job.** The Full discovery toolbar (question set, answered and assumed counts, Open readout), the readout toolbar and the comparison bar stay in view; each is a labeled group. A sticky bar must not cover what a link scrolls to, so the target keeps a scroll margin, and a bar that wraps on a phone is not sticky there.
- **The requirement areas have one presentation.** `PillarSummary` shows an area's name, how many of the catalog's capabilities are in scope, their levels, licensing and GCC flags and the teams to involve. Use it, not a new card, wherever a result is grouped by Security, Governance or Observability.
- **Chips are toggle buttons.** The requirement-area filter uses `aria-pressed` buttons with the count in the name, not color, to show what is selected.
- **Assumed answers say so in words.** A badge and a Confirm button mark an answer that has not been confirmed with the customer; exports append "assumed, not yet confirmed". Color is never the only signal.
- **Every statement of fact shows its source.** `SourceNote` is the one quiet line under a statement: the Microsoft sources as links and the date they were read, plus the evidence tag in the Technical view. Use it, not a new footnote style, on the playbook pages.
- **One signal of trust, at every level.** A "Verified {date}" badge (`VerifiedBadge`) shows when a source was last read. "Needs SME review" and the evidence tags belong to the Technical view (`ReviewBadge`), so a seller sees one clear signal per item rather than a hedge on every card. The footer says when the content was last checked. There is no banner.
- **A requirement says where it applies and what to ask.** `RequirementLine` shows what is needed, an "Applies to" chip only where the source says so, the status when an assessment is chosen and, while the answer is unknown, the question to ask the customer. Use it on every page that lists requirements.
- **Access fit is a chip, and silence is stated.** `AccessFitBadge` says whether Microsoft documents a capability differently by how the agent acts. A capability Microsoft does not split shows "not split by Microsoft", never "the same".
- **Status is a word first.** A guardrail or prerequisite is "In place", "Gap" or "Confirm" in a `Badge`, with the colored border as reinforcement only. "Check whether this applies" is a second badge, so unknown never reads as a gap.
- **Selling as is a toggle group in the header**, beside the detail-level switch: `aria-pressed` buttons in a labeled group with a visible hint. It never hides content a seller might need; it changes which angle leads.
- **The header carries jobs, not sections.** The jobs (Pitch, Map an agent, Licensing and Deploy) are links beside Home. Everything else sits in one **Library** menu: a native `<details>` that closes on Escape, on blur and after a page change, and opens inline on a phone so it needs no hover or pointer. The header styles only its own top-level list, so the menu's lists keep their own layout.
- **Choices belong in the URL.** Platform, tool and way-of-acting choices use native checkboxes and selects and are restored from the address. A customer name is typed into an input that is never stored or placed in the address.
- **A handout prints on one page, and a test says so.** The leave-behind uses the smallest type in the scale, tight lines and a two-column pair of blocks in print, and caps its lists (`CONTROL_LIMIT`, `STEP_LIMIT`, `QUESTION_LIMIT`). The print styles hide every `<footer>`, so anything that must reach the paper, such as sources and the disclaimer, sits in a `div`. An end-to-end test prints the fullest agent on A4 and Letter and expects one page.
- **Sample data is marked in words.** `SampleChip` is an amber `Badge` that says "Sample data" next to the fictional customer wherever it appears, including on the leave-behind and in its slides. It never relies on color alone.
- **A line that must fit says how it fits.** Where a list is cut to fit a page or a slide, the remainder is counted in words ("+5 more Essential"), never a bare number.

## Components

| Built                                                                                                                                                                                                                                                                                                                                                                                                  | Planned                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AccessChange`, `AccessFitBadge`, `AccessTable`, `AssessmentPicker`, `AudienceToggle`, `Badge`, `ButtonLink`, `DataTable`, `ExhibitFrame`, `ExternalLink`, `GuardrailList`, `HeroBand`, `KeyTakeaway`, `KpiStrip`, `PageContainer`, `PageHeading`, `PillarSummary`, `RequirementLine`, `ReviewBadge`, `SourceNote`, `VerifiedBadge`, `ViewDepthToggle`, `CurrentCustomer`, `LibraryMenu`, `SampleChip` | `AgentAnatomy`, `RequestFlow`, `PatternMatrix`, `RiskControlMap`, `PillarConsoleMatrix`, `FrontierPhaseRail`, `ReadinessMeter`, `OwnershipGrid`, `WhatIfPanel`, `TwoByTwo`, `RoadmapSwimlane`, `DiagnosticStepper`, `CapabilityDrawer`, `UseCaseCanvas`, `CapabilityCard`, `GlossaryTerm`, `EvidenceTag`, `LensSwitcher` |

## Adding a token

1. Add it to `tokens.ts` (and to `cssVariables()` if CSS needs it).
2. If it is a text or control color, add its pairs to `tokens.test.ts`.
3. Use it as `var(--color-…)`. Never copy the value.
