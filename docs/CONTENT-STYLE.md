# Writing style

The aim is the clarity of a good consulting deliverable: short, plain and checkable. Write for an executive first, then add the detail a practitioner needs.

## Rules

- **Lead with the answer.** The first sentence says what to do or what is true. Explain after.
- **Action titles.** Every exhibit title is a full-sentence takeaway, generated from data with `{placeholders}`, never typed numbers. Good: "22 of 26 capabilities need Agent 365 (or E7/G7); 4 are included with no Agent 365 license needed." Weak: "Licensing overview."
- **Plurals follow the number.** Write counts with `{n?singular|plural}`, for example `{count} {count?answer comes|answers come}`, so a sentence never reads "1 are".
- **MECE grouping.** Groups do not overlap, and nothing is missing. If two categories could both claim an item, redraw the line.
- **Short sentences.** One idea each. Prefer concrete verbs.
- **A "Source:" line under every exhibit.** Name the source, link it, and say when editorial content is a draft pending review.
- **"Draft for discussion"** on every readout.
- **No hype.** Avoid "powerful", "seamless", "unlock", "supercharge", "revolutionary", "best-in-class" and similar. Say what a capability does.
- **Neutral, factual voice.** No claim beyond the feature text and the sources.

## Words we use

Sellers read this site, so it uses their words rather than the code's.

- Recommendation levels: **Essential**, **Recommended**, **Consider**. Never "Required": that is the service description's licensing column.
- Evidence tags (Technical view): **Stated** (a source says it), **Inferred** (follows from the official description), **Recommendation (needs review)** (an editorial choice).
- Licensing: **Included (no Agent 365 license needed)** and **Needs Agent 365 (or E7/G7)**. The code still says foundational and premium.
- Setup: **Set up once**, **Decide per agent** and **Set up once + decide per agent**.
- Grouping: **Area** (short) and **requirement area** (spelled out) for Security, Governance and Observability; **Where it's configured** for the console a capability is set up in.
- Pages: **Pitch**, **Map an agent** (the agent passport; **Full discovery** for the longer assessment), **Licensing**, **Deploy**, **Library**, **Agent scenarios**, **Agent portfolio** and **How recommendations work**. The measure on the portfolio is **Governance effort**. What a seller leaves with the customer is the **leave-behind**.
- Status: **In place**, **Gap** and **Confirm**. A missing answer is "to confirm" with the question to ask, never a gap, and never a bare 0%: say "Not assessed yet". In a customer handout, list what is not confirmed under **Questions to confirm** and never as a headline.
- The sample customer is **fictional** and **Sample data**: name it as obviously fictional and never after a real company.
- Access: **delegated access**, **own access** and **agent account**. Never "owned".
- Say "Agent 365", not "A365", in text people read.

## Limits

| Field                                   | Limit    |
| --------------------------------------- | -------- |
| `summary`                               | 40 words |
| `executiveValue`, `withoutIt`, `withIt` | 30 words |
| Pillar definition                       | 25 words |

The build enforces these.

## Facts

- Quote Microsoft text verbatim only where verbatim is required (the feature text). Otherwise paraphrase, and do not copy long passages.
- Never state a price. Link to the official page.
- Never state a licensing fact a source does not state. Use `# TODO(verify)` instead.
- Where public sources describe the same thing differently, show each one with its source rather than choosing. The Microsoft Product Terms govern a purchase.
- Use only public Microsoft sources. Never copy text from, or link to, internal material.
- A hedge ("may", "can") belongs on anything inferred. Do not hedge what a source states.
