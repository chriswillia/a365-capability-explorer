# Writing style

The aim is the clarity of a good consulting deliverable: short, plain and checkable. Write for an executive first, then add the detail a practitioner needs.

## Rules

- **Lead with the answer.** The first sentence says what to do or what is true. Explain after.
- **Action titles.** Every exhibit title is a full-sentence takeaway, generated from data with `{placeholders}`, never typed numbers. Good: "22 of 26 capabilities require Microsoft 365 E7/G7 or Agent 365; 4 come with base plans." Weak: "Licensing overview."
- **MECE grouping.** Groups do not overlap, and nothing is missing. If two categories could both claim an item, redraw the line.
- **Short sentences.** One idea each. Prefer concrete verbs.
- **A "Source:" line under every exhibit.** Name the source, link it, and say when editorial content is a draft pending review.
- **"Draft for discussion"** on every readout.
- **No hype.** Avoid "powerful", "seamless", "unlock", "supercharge", "revolutionary", "best-in-class" and similar. Say what a capability does.
- **Neutral, factual voice.** No claim beyond the feature text and the sources.

## Words we use

- Recommendation levels: **Essential**, **Recommended**, **Consider**. Never "Required": that is the service description's licensing column.
- Evidence tags: **Stated** (a source says it), **Inferred** (follows from the official description), **Advisor judgment** (needs SME review).
- Licensing tier: **foundational** (included with base plans) and **premium** (requires Microsoft 365 E7/G7 or Agent 365).
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
- A hedge ("may", "can") belongs on anything inferred. Do not hedge what a source states.
