import type { Answers, Content, Guardrails } from '../content/schemas.ts';
import { evaluateCondition } from './conditions.ts';

type Item = Guardrails['items'][number];
type Gate = Guardrails['gates'][number];

export type GuardrailStatus = 'ready' | 'gap' | 'unknown';

export interface GuardrailView {
  item: Item;
  /** True when the answers say the guardrail matters for this agent, null while an answer is missing. */
  applies: boolean | null;
  status: GuardrailStatus;
}

export interface GateView {
  gate: Gate;
  items: GuardrailView[];
}

export interface GuardrailPlan {
  gates: GateView[];
  counts: Record<GuardrailStatus, number>;
  total: number;
}

const URGENCY: Record<GuardrailStatus, number> = { gap: 0, unknown: 1, ready: 2 };

/** Gaps first, then what is still to confirm, then what is in place. The written order holds within each. */
export const byUrgency = (items: GuardrailView[]): GuardrailView[] =>
  [...items].sort((a, b) => URGENCY[a.status] - URGENCY[b.status]);

/**
 * The production checklist for an agent. A guardrail the answers rule out is left off; one they cannot decide
 * stays on the list, marked "check whether this applies". With no done-condition, an unanswered one, or an
 * applicability the answers cannot decide, the status is "confirm": an unknown answer is never counted as a gap.
 */
export function evaluateGuardrails(data: Content, answers: Answers | null): GuardrailPlan {
  const known = answers ?? {};
  const gates = data.guardrails.gates.map((gate): GateView => {
    const items = data.guardrails.items
      .filter((item) => item.gate === gate.id)
      .flatMap((item): GuardrailView[] => {
        const applies = evaluateCondition(item.appliesWhen, known);
        if (applies === false) return [];
        const done = item.doneWhen === undefined ? null : evaluateCondition(item.doneWhen, known);
        const status: GuardrailStatus =
          applies === null || done === null ? 'unknown' : done ? 'ready' : 'gap';
        return [{ item, applies, status }];
      });
    return { gate, items };
  });
  const counts: Record<GuardrailStatus, number> = { ready: 0, gap: 0, unknown: 0 };
  for (const gate of gates) for (const view of gate.items) counts[view.status] += 1;
  return { gates, counts, total: counts.ready + counts.gap + counts.unknown };
}
