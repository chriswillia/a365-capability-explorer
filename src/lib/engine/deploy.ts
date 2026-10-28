import { ownerTeamOf } from '../content/derive.ts';
import type {
  Capability,
  ConsoleDef,
  Content,
  DeployCopy,
  Guardrails,
} from '../content/schemas.ts';
import { evaluateAssessment, type AssessmentAnswers, type InScope } from './evaluate.ts';
import {
  byUrgency,
  evaluateGuardrails,
  type GuardrailStatus,
  type GuardrailView,
} from './guardrails.ts';

type Gate = Guardrails['gates'][number];
type Period = DeployCopy['plan']['periods'][number];

export interface DeployStep {
  view: GuardrailView;
  /** The capabilities the step brings in, in catalog order. */
  capabilities: Capability[];
  /** Where those capabilities are configured, each once, in console order. */
  consoles: ConsoleDef[];
  /** The teams that own those capabilities, each once. */
  ownerTeams: string[];
}

export interface DeployGate {
  gate: Gate;
  /** Gaps first, then what is still to confirm, then what is in place. */
  steps: DeployStep[];
}

export interface DeployPeriod {
  period: Period;
  gate: Gate;
  steps: DeployStep[];
  /** Essential and Recommended controls for this agent that the roadmap puts in this period's wave. */
  controls: InScope[];
}

export interface Deploy {
  gates: DeployGate[];
  periods: DeployPeriod[];
  counts: Record<GuardrailStatus, number>;
  total: number;
}

/**
 * The go-live baseline and the 30, 60 and 90 day plan. The steps are the guardrails, checked against the answers
 * with the same code as the readout, and the controls come from the assessment's rules and the roadmap waves.
 * With no assessment every step is listed, none is marked as in place, and there are no controls to place.
 */
export function buildDeploy(
  data: Content,
  input: AssessmentAnswers | null,
  version: string,
): Deploy {
  const answers = input === null ? null : { ...input.org, ...input.useCase };
  const plan = evaluateGuardrails(data, answers);
  const consoleOrder = [...data.consoles].sort((a, b) => a.order - b.order);
  const step = (view: GuardrailView): DeployStep => {
    const capabilities = data.capabilities.filter((capability) =>
      view.item.capabilityIds.includes(capability.id),
    );
    return {
      view,
      capabilities,
      consoles: consoleOrder.filter(
        (console_) =>
          console_.id !== 'N/A' &&
          capabilities.some((capability) => capability.source.console === console_.id),
      ),
      ownerTeams: [...new Set(capabilities.map((c) => ownerTeamOf(c, data.consoles)))],
    };
  };
  const gates = plan.gates.map(({ gate, items }): DeployGate => ({
    gate,
    steps: byUrgency(items).map(step),
  }));
  const inScope =
    input === null
      ? []
      : evaluateAssessment(data, input, version).inScope.filter(
          (entry) => entry.level === 'essential' || entry.level === 'recommended',
        );
  const periods = data.deploy.plan.periods.map((period): DeployPeriod => {
    const found = gates.find((g) => g.gate.id === period.gate);
    return {
      period,
      gate: found!.gate,
      steps: found!.steps,
      controls: inScope.filter((entry) => entry.wave === period.wave),
    };
  });
  return { gates, periods, counts: plan.counts, total: plan.total };
}
