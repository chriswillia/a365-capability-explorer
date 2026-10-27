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

PowerPoint uses token-derived ink/paper/white/slate, Georgia and Segoe UI fallback fonts, editable shapes/text and locally embedded optional logos. The six-slide readout alternates dark cover/conclusion with light summary, anatomy, risk and roadmap layouts. The canvas uses eleven compact discussion boxes on one slide. Every slide carries a draft/version/disclaimer and a speaker-note detail notice. Dense inputs are explicitly summarized rather than silently shrunk into unreadable text; full content remains in notes. Out-of-scope anatomy uses muted slate plus explicit scope labels, never color alone.

Portfolio charts use token-based shapes and numbered bubbles with a full table alternative. Expected-user bands control illustrative area, never fabricated headcounts; unknown ranges have dashed outlines. Heatmap levels retain visible text as well as color. Scroll regions make wide comparisons keyboard-accessible and remain contained on mobile. Workshop cards pair front/back content with a dashed fold boundary and keep pairs together in print. Presentation mode enlarges type and hides editing controls without entering browser fullscreen or storing a preference; an always-available exit button and Escape restore the normal view.

## Components

| Built                                                                                                                                                        | Planned                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Badge`, `ButtonLink`, `DataTable`, `ExhibitFrame`, `ExternalLink`, `HeroBand`, `KeyTakeaway`, `KpiStrip`, `PageContainer`, `PageHeading`, `ViewDepthToggle` | `AgentAnatomy`, `RequestFlow`, `PatternMatrix`, `RiskControlMap`, `PillarConsoleMatrix`, `FrontierPhaseRail`, `ReadinessMeter`, `OwnershipGrid`, `WhatIfPanel`, `TwoByTwo`, `RoadmapSwimlane`, `DiagnosticStepper`, `CapabilityDrawer`, `UseCaseCanvas`, `CapabilityCard`, `GlossaryTerm`, `EvidenceTag`, `LensSwitcher` |

## Adding a token

1. Add it to `tokens.ts` (and to `cssVariables()` if CSS needs it).
2. If it is a text or control color, add its pairs to `tokens.test.ts`.
3. Use it as `var(--color-…)`. Never copy the value.
