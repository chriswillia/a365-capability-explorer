---
description: 'Add a requirement a capability needs (a license, role, service, enrollment, onboarding step, telemetry or scope) to requirements.yaml, with its source, where it applies and the question to ask the customer.'
argument-hint: 'The requirement, the capability ids it applies to, and the Microsoft page that states it'
agent: 'agent'
---

Add a requirement to [requirements.yaml](../../content/requirements.yaml). Follow [the content rules](../instructions/content.instructions.md). If the requirement, the capabilities or the source page are missing, ask for them before continuing.

Use only public Microsoft sources. Never state a price, and never state a requirement a source does not state.

1. Read the Microsoft page in full and confirm it states the requirement. If it does not, stop and say so.
2. Add the source to [sources.yaml](../../content/sources.yaml) if it is not there, with today's `lastVerified` and a note of what it supports. Every source must be cited by some content, or the build fails.
3. Add an item to the set whose `capabilityIds` match (or add a new set, using `[all]` only for what every premium capability needs):
   - a kebab-case `id` and a `kind` (license, role, service, enrollment, onboarding, telemetry or scope);
   - `text` in 45 words or fewer, paraphrased from the page;
   - `askPrompt`: the question to put to the customer while the answer is unknown, 30 words or fewer, ending in a question mark;
   - `appliesTo` (each-user, tenant, device, agent or data) only if the page says where it applies. Leave it out rather than guess;
   - `readyWhen` only if the customer's answers in [questions.yaml](../../content/questions.yaml) can decide it (an unanswered question stays "to confirm", never a gap);
   - `status` (preview or frontier-preview) only if the page states it;
   - `sourceIds`, `evidence`, `reviewStatus: draft` and `lastVerified`.
4. Add or adjust tests in `src/lib/content/requirements.test.ts`, and update the count in `playbook-content.test.ts` if it changed.
5. Add a [changelog](../../content/changelog.md) entry whose `affects:` line lists the capability ids.
6. Run `npm run content:build`, `npm run check:public`, `npm run lint`, `npm run typecheck` and `npm test`, and fix any failure.
7. Summarize the requirement, where it shows (the capability page, the Licensing page and the readout) and anything marked `TODO(verify)`.
