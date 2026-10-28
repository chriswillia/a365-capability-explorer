import {
  CONSOLES,
  CONTROL_POINTS,
  METRIC_NUMBER_KEYS,
  METRIC_TEXT_KEYS,
  PILLARS,
  SETUPS,
} from './constants.ts';
import type {
  Capability,
  ConsoleDef,
  ConsoleId,
  ControlPointDef,
  ControlPointId,
  MetricNumberKey,
  MetricTextKey,
  PillarDef,
  PillarId,
  Setup,
} from './schemas.ts';
import type { TemplateValues } from './template.ts';
import type { AssessmentResult } from '../engine/evaluate.ts';
import { countReadiness } from '../engine/readiness.ts';
import type { Portfolio } from '../portfolio/portfolio.ts';

export interface MetricsInput {
  capabilities: Capability[];
  pillars: PillarDef[];
  consoles: ConsoleDef[];
  controlPoints: ControlPointDef[];
  contentVersion: string;
  /** The sources the content cites. The newest check date is shown in the footer. */
  sources?: { lastVerified: string | null }[];
}

export type Metrics = Record<MetricNumberKey, number> &
  Record<MetricTextKey, string> & {
    platformShare: number;
    byConsole: Record<ConsoleId, number>;
    gccByConsole: Record<ConsoleId, number>;
    byPillar: Record<PillarId, number>;
    byControlPoint: Record<ControlPointId, number>;
    bySetup: Record<Setup, number>;
  };

function tally<K extends string>(keys: readonly K[], values: K[]): Record<K, number> {
  const result = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const value of values) result[value] += 1;
  return result;
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** The scalar metrics a content template may use as {placeholders}. */
export function templateValues(metrics: Metrics): TemplateValues {
  const values: TemplateValues = {};
  for (const key of METRIC_NUMBER_KEYS) values[key] = metrics[key];
  for (const key of METRIC_TEXT_KEYS) values[key] = metrics[key];
  return values;
}

export function computeReadoutMetrics(result: AssessmentResult) {
  // Each capability is counted once, so the three setup counts add up to the capabilities in scope.
  const setups = tally(
    SETUPS,
    result.inScope.map((r) => r.capability.setup),
  );
  return {
    levels: tally(
      ['essential', 'recommended', 'consider'],
      result.inScope.map((r) => r.level),
    ),
    capabilityCount: result.inScope.length,
    foundational: result.licensing.foundational,
    premium: result.licensing.premium,
    platform: setups.platform,
    agent: setups.agent,
    both: setups.both,
    unresolved: result.readiness.checks.filter((check) => check.status !== 'ready').length,
    unanswered: result.openQuestions.length,
    readiness: countReadiness(result.readiness.checks),
  };
}

export function computePortfolioMetrics(portfolio: Portfolio) {
  const checks = portfolio.cases.flatMap((item) => item.result.readiness.checks);
  return {
    selected: portfolio.assessments.length,
    evaluated: portfolio.cases.length,
    blocked: portfolio.blocked.length,
    sharedFoundations: portfolio.foundations.length,
    gaps: checks.filter((check) => check.status === 'gap').length,
    unknown: checks.filter((check) => check.status === 'unknown').length,
    readiness: countReadiness(checks),
    uniqueCapabilities: portfolio.capabilities.length,
    foundational: portfolio.capabilities.filter(
      ({ capability }) => capability.source.includedWithBasePlans,
    ).length,
    premium: portfolio.capabilities.filter(
      ({ capability }) => !capability.source.includedWithBasePlans,
    ).length,
    unplotted: portfolio.cases.filter((item) => item.value === null).length,
  };
}

export const computeWorkshopMinutes = (agenda: { minutes: number }[]) =>
  agenda.reduce((sum, item) => sum + item.minutes, 0);

/** Every number shown in a headline, KPI or action title comes from here, never from typed copy. */
export function computeMetrics(input: MetricsInput): Metrics {
  const { capabilities, pillars, controlPoints } = input;
  const total = capabilities.length;

  const byConsole = tally(
    CONSOLES,
    capabilities.map((c) => c.source.console),
  );
  const gccByConsole = tally(
    CONSOLES,
    capabilities.filter((c) => c.source.gccAvailable).map((c) => c.source.console),
  );
  const byPillar = tally(
    PILLARS,
    capabilities.map((c) => c.pillar),
  );
  const byControlPoint = tally(
    CONTROL_POINTS,
    capabilities.map((c) => c.controlPoints[0] as ControlPointId),
  );
  const bySetup = tally(
    SETUPS,
    capabilities.map((c) => c.setup),
  );

  const foundational = capabilities.filter((c) => c.source.includedWithBasePlans).length;
  const gcc = capabilities.filter((c) => c.source.gccAvailable).length;
  const agentDecisions = bySetup.both + bySetup.agent;

  const orderedPillars = [...pillars].sort((a, b) => a.order - b.order);
  const largestPillarCount = Math.max(0, ...orderedPillars.map((p) => byPillar[p.id]));
  const largestPillarLabels = orderedPillars
    .filter((p) => byPillar[p.id] === largestPillarCount)
    .map((p) => p.label);

  const lastVerified =
    capabilities
      .map((c) => c.source.lastVerified)
      .sort()
      .at(-1) ?? '';
  const sourcesChecked =
    (input.sources ?? [])
      .flatMap((s) => (s.lastVerified === null ? [] : [s.lastVerified]))
      .sort()
      .at(-1) ?? lastVerified;

  return {
    capabilityCount: total,
    foundationalCount: foundational,
    premiumCount: total - foundational,
    gccCount: gcc,
    notInGccCount: total - gcc,
    platformCount: bySetup.platform,
    bothCount: bySetup.both,
    agentOnlyCount: bySetup.agent,
    agentDecisionCount: agentDecisions,
    consoleCount: CONSOLES.filter((id) => byConsole[id] > 0).length,
    controlPointCount: controlPoints.length,
    coveredControlPointCount: controlPoints.filter((cp) => byControlPoint[cp.id] > 0).length,
    pillarCount: pillars.length,
    observeCount: byPillar.observe,
    governCount: byPillar.govern,
    secureCount: byPillar.secure,
    largestPillarCount,
    largestPillarLabel: joinLabels(largestPillarLabels),
    lastVerified,
    sourcesChecked,
    contentVersion: input.contentVersion,
    platformShare: total === 0 ? 0 : bySetup.platform / total,
    byConsole,
    gccByConsole,
    byPillar,
    byControlPoint,
    bySetup,
  };
}
