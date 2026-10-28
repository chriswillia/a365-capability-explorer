# Changelog

Every content change gets an entry, newest first. Format:

- A heading `## YYYY-MM-DD · Title`.
- An `affects:` line listing the capability ids the change touches, for example `affects: [purview-dlp, purview-labels]`. Use `[all]` for a change that touches the whole catalog.
- A short plain-language description.

The newest entry's date becomes part of the content version shown in the footer and in every export.

## 2026-10-28 · One part at a time: Pitch, Licensing, Deploy and the example agents

affects: [all]

Pitch, Licensing, Deploy and the example agents no longer run down one long page. Each shows one part at a time, with the parts as links under the opening sentence. Pitch has Say it, Prepare, Run the meeting and Value brief; Licensing has Who needs a license, Size the licenses, Ways to license, Prerequisites and Take to a specialist; Deploy has one part for each gate and one for the 30, 60 and 90 day plan; the example agents have Browse examples and Compare controls, and each example has Recommended controls, Risks and mitigations and Rollout and licensing, with Technical detail added in the Technical view. Every part is at most about four screens on a laptop, where Pitch had run to 19 and Licensing to 23. An example agent now opens on its recommended controls. The conversation guide's three requirement areas and the prerequisites' product areas are closed until opened, a Deploy step shows what to do and how to prove it with the reason, place, owner and sources behind one link, and the jump lists on those pages are gone. Every earlier link into a section, such as Licensing's calculator or the pushback answers, opens the part that holds it, and the license calculator, discovery picker and value brief keep what you typed while you look at another part. An example with no sample use cases no longer shows an empty heading. Product statements, sources, rules and recommendations are unchanged.

## 2026-10-28 · Lighter pages: a one-row header, example agents first, and sources one click away

affects: [all]

Made the site lighter to scan and easier to get around. The header is now one row (two on a narrow laptop, and a single Menu button on a phone) instead of about a quarter of the screen: Selling as and Detail level moved into one View menu that says what is chosen, for example "View: Both · Executive". Navigation now reads Pitch, Example agents, Map an agent, Licensing and Deploy, with a More menu for stack fit, how agents act, the capabilities, Learn, the agent portfolio, the workshop kit and how recommendations work. Agent scenarios are renamed Example agents and moved out of the Library menu, and Home now leads with them: ten cards, each saying how the agent acts, ahead of the four jobs, under a much shorter banner. Pages open with one sentence, and the notices that used to follow it sit behind About this page; the disclaimer is still printed once on every page. Each statement's sources are one toggle that says how many there are and when they were read; it opens by itself in the Technical view and in print. Product statements, source availability flags and recommendation rules are unchanged.

## 2026-10-28 · Seller workflows: agent passport, license sizing, leave-behind, go-live plan and a sample customer

affects: [all]

Added the pages a seller uses once the conversation turns to a particular agent. Map an agent now opens the agent passport: six questions in the seller's words give how the agent acts, the controls that matter most by area, what must be in place, who to license, where it is built and the risks to cover, and the longer assessment stays available as Full discovery. Licensing gains a calculator that turns the counts a seller enters into the number of people who need an Agent 365 license, using the Microsoft licensing FAQ and Product Terms for the rules and the seller's own numbers for the quantities; it copies as Markdown or downloads as CSV, and nothing is stored. A new Deploy page gives the go-live baseline in three gates, with why each step matters, what to do, how to prove it works and who owns it, and a 30, 60 and 90 day plan. A leave-behind for each saved agent prints on one page (A4 or Letter) or downloads as three slides with their own speaker notes, and lists everything not yet confirmed under Questions to confirm instead of stating it as fact.

The Pitch page adds seven openings by customer situation (a customer with Microsoft 365 E5, E3 only, heavy Copilot use, building in Foundry, mostly third-party agents, frontline workers or GCC), each with its licensing path, and a picker that turns up to five discovery questions into a meeting agenda. Three proof points are added with their caveats: the share of employees using unsanctioned agents from Microsoft's Cyber Pulse report (a survey Microsoft commissioned), and Deloitte's figures on agent governance maturity and the top AI risk, which are independent and not Microsoft's. Every capability page gains a Say this card, composed from the capability's existing text, that copies what to say and what to ask. Stack fit adds the seven platforms Microsoft lists for registry sync, with their environment and observability status and the limits Microsoft states. Every guardrail now says how to prove it is in place. Home adds a sample customer, a fictional Contoso Retail with three agents, marked Sample data and reset or removed in one click without touching real customers. Product statements, source availability flags and recommendation rules are unchanged; all new editorial text is draft guidance pending SME review, no price is shown, and what Microsoft's pages leave unstated, such as licensing for external users and administrators, is still shown as not stated.

## 2026-10-27 · Seller brief v3: jobs, the Product Terms, requirements to confirm and access fit

affects: [all]

Reorganized the site around the jobs a seller does with a customer. The header now offers Pitch, Map an agent and Licensing, and a Library menu holds the rest. The customer conversation guide moved into the Pitch page, and the old conversation address redirects to it. Home asks what you need to do and shows recent customers; the catalog numbers moved to the Capabilities page, which opens as cards with a short list of filters and the rest under More filters. Labels now use sellers' words: Area, Where it's configured, Included (no Agent 365 license needed), Needs Agent 365 (or E7/G7), Set up once and Decide per agent, Agent scenarios, Agent portfolio, Governance effort and Recommendation (needs review). The preview banner is replaced by a footer stamp that says when the content was last checked and a Verified date on each item; review status and evidence tags now show in the Technical view only.

Licensing now shows what the Microsoft Product Terms require for an Agent 365 user license, and where the Product Terms, the licensing FAQ, the partner blog and the product overview describe the prerequisite differently, each with its source. It adds the multi-tenant management and July 1, 2026 Defender transition points and public help with deployment (FastTrack and the adoption hub). Each requirement now says where it applies, where the source does, and gives the question to ask the customer while it is unconfirmed; that question also appears in the readout and its Markdown. New requirements from public Microsoft pages cover Defender onboarding and its Microsoft 365 connector, Shadow AI, Global Secure Access for local agents, sponsors, connected platforms, ownerless agents and third-party identity providers, with 16 new sources and six glossary terms. Licensing and requirements dates now warn after 30 days instead of 90.

Every capability card says whether Microsoft documents it differently by how the agent acts (delegated access or own access), and says "not split by Microsoft" where it does not. Each capability page now lists what it needs and how the agent acts, at every detail level. Added a scenario for an assistant that chats for the signed-in user and also runs scheduled jobs under its own access, and every scenario now shows how the agent acts. Readouts say "Not assessed yet" or give confirmed, gap and to-confirm counts instead of 0%, count each capability once as set up once, decided per agent or both, and say "Not applicable (Commercial cloud)" for GCC. Each PowerPoint slide now has its own speaker notes. Fixed Contents links in the readout that landed a section heading under the sticky toolbar. Product statements, source availability flags and recommendation rules are unchanged; all new editorial text is draft guidance pending SME review.

## 2026-10-27 · Seller playbook: a value story, the licensing basis, prerequisites, access patterns and guardrails

affects: [all]

Added a Pitch page that works before a use case is known: a 60-second pitch for AI sellers, Security sellers and both together, the problem in Microsoft's words, seven outcomes that group all 26 capabilities, buyer questions, objection answers, proof with its caveats, and a value brief that prints or copies. A Selling as switch in the header changes the pitch and talk tracks, not the facts. Added a Licensing and prerequisites page built from the Microsoft licensing FAQ, which was read in full for the first time: licensing is per user, who needs a license depends on how the agent acts, the plan prerequisites by customer type, what stays unavailable without the underlying licenses, the sizing reports, and what each capability needs (license, administrator role, underlying service, enrollment, onboarding). The seven licensing myth-and-fact answers, the Copilot, E5 and E7 positioning card and the license basis shown in readouts and PowerPoint are now filled from that source; the five "sources differ" notes were checked against it. Added a Stack fit page, a How an agent acts page for Microsoft's three access patterns (delegated, own access, own access with an agent account) with what Microsoft documents for each and how the in-scope capabilities change for a saved assessment, and production guardrails for before pilot, before production and as the estate scales, shown in the assessment review and the readout. Readouts gain two numbered exhibits (how the agent acts, production guardrails) and a licensing exhibit that says who to license and what the capabilities need; the Markdown export follows, and the PowerPoint adds a production guardrails slide. The assessment now asks how the agent acts earlier. The header leads with the playbook pages and keeps the explorer, scenarios, Learn and the customer pack in a menu. No price is repeated. Product statements, source availability flags and recommendation rules are unchanged; all new editorial text is draft guidance pending SME review.

## 2026-10-26 · Seller guidance: requirement areas first, a faster assessment and a customer conversation guide

affects: [all]

Reorganized the site around the three requirement areas a seller discusses with a customer: Security, Governance and Observability. The explorer now opens grouped by requirement area, with area chips that show counts, filters for product area, licensing, GCC and setup, plain-language search shortcuts and a sticky comparison bar. Home numbers and persona cards link to the capabilities they count; per-row draft markers are replaced by one computed draft summary, and the markers remain on briefs, readouts and prints. Renamed navigation and labels (Assess, Compare use cases, scenario, customer, product area) without changing any address, and moved the methodology page to the footer as "How recommendations work".

Added a customer conversation guide built from the catalog (questions, owner teams and licensing and availability flags for each requirement area) and a printable requirements checklist in the workshop kit. The assessment now starts from a customer name, opens a quick scan at the use case, asks each question in plain language with the requirement areas it informs, and marks answers that came from a starting scenario as assumed until the seller confirms or edits them. Readouts, canvases and the PowerPoint deck lead with the requirement areas, add the teams to involve and the open questions, number their exhibits without gaps and show assumed answers as such. Added a header shortcut to the customer being worked on, and a built page for each main address so a shared link to it answers with HTTP 200 and a page title. Product statements, source availability flags, licensing assumptions and recommendation rules are unchanged; all new editorial text is draft guidance pending SME review.

## 2026-10-26 · Organization portfolios and workshop kit

affects: [all]

Added local, organization-scoped portfolio comparisons with a labeled business-value/control-intensity chart and table alternative, capability heatmap, reusable platform foundations, grouped configured readiness checks and deduplicated licensing capability counts. User bands remain illustrative, unknowns remain unknown, and incompatible assessments are visibly excluded from calculations without discarding their answers. Selected portfolios export and import through the existing copy-only JSON workflow. Added a draft timed facilitator guide, paired printable pattern and capability cards derived from existing content and rule conditions, and non-persisting presentation mode for portfolios, workshops, readouts and canvases. Product statements, source availability flags and recommendation engine semantics are unchanged. Editorial content and planning cutoffs remain draft guidance pending SME review.

## 2026-10-26 · Readout exhibits, PowerPoint and local co-branding

affects: [all]

Added eleven numbered readout exhibits with Executive/Technical depth, configured-check readiness percentages, scope-aware anatomy, grouped platform and agent decisions, complete technical evidence and a discovery appendix. Added six-slide editable readout PowerPoint exports and one-slide populated or blank canvases, with complete speaker notes and explicit summary notices. Optional local raster logos are normalized and preserved through saved assessments and copy-only JSON transfer. Added workshop success-measure and accountable-owner inputs, explicit one-page canvas print summaries with complete answers retained in the readout/Markdown, and running readout print footers. Product statements, recommendation semantics, licensing assumptions and source availability flags are unchanged. Editorial guidance remains draft pending SME review.

## 2026-10-26 · Saved readouts and portable assessments

affects: [all]

Added discussion readouts with generated executive summaries, planning roadmaps, control-plane anatomy and current engine evidence. Added a printable Use Case Canvas and blank workshop canvas, local Markdown and JSON downloads, clipboard summaries and copy-only JSON import with explicit validation and save-status notices. Downloads include personal answers and must be reviewed before sharing. PowerPoint, logo co-branding and further exhibit refinements remain in development. Product statements, licensing semantics and source availability flags are unchanged.

The repository and Pages path now use a365-capability-explorer; browser-storage keys remain unchanged.

## 2026-10-26 · Local diagnostic and organization profiles

affects: [all]

Added organization and use-case questions, Quick and Full diagnostic sections, conditional developer-stack questions and editorial consultant notes. Assessments can start blank or from illustrative patterns and samples while reusing the chosen organization context. Local autosave, recovery, conflict and unsaved-change notices accompany assessment management and a live anatomy and mapping preview. Formal readouts, exports and import remain Phase 5. Product statements and source availability flags are unchanged.

Renamed the project to A365 Capability Explorer. The repository URL, Pages path and existing browser-storage keys remain unchanged for compatibility.

## 2026-10-25 · Rules, patterns and risk mapping

affects: [all]

Added typed rule questions, draft recommendation rules, nine illustrative patterns, ten risk themes, sourced advisories and conditional integration checklists. The pattern matrix and briefs use one deterministic evaluator that retains every reason and preserves unknown answers. Added editorial readiness checks, operating-model and anatomy tables, planning intensity, what-if deltas, sample use cases and fourteen unsigned golden scenarios. Capability briefs and explorer lenses now expose rules, generated pattern membership and risk associations. Methodology explains the semantics and pending SME review. Unverified licensing remains unknown; source-description text and availability flags are unchanged.

## 2026-10-24 · Persona paths and Learn

affects: [all]

Added role-based starting paths, planning questions, the Frontier Firm phase rail and a sourced Learn hub. Added conceptual flow, integration paths, related building blocks, glossary and myths-versus-facts content. Unverified licensing answers remain empty and visibly pending verification. Verified the organizational phases against the official Work Trend Index article and the SDK boundaries against Microsoft Learn. The capability catalog and its availability flags are unchanged.

## 2026-10-24 · Explorer and capability briefs

affects: [all]

Added explorer and capability brief interface copy, including explicit draft, source-difference and assessment-pending notices. Capability facts and their verification dates are unchanged.

## 2026-10-23 · Initial seed

affects: [all]

Seeded the 26 capabilities from the Microsoft Agent 365 service description (page last updated 2026-10-01), with fit metadata (pillar, wave, layer, setup, lifecycle stages) and draft editorial text. Added the sources, pillars, consoles, control points, lifecycle stages, site copy and a snapshot of the published feature table.
