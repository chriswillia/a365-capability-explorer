import { licensingTier, needsAgentDecision, ownerTeamOf } from '../content/derive.ts';
import type {
  Answers,
  Capability,
  Condition,
  Content,
  Level,
  Recommendation,
  Rule,
} from '../content/schemas.ts';
import { answerErrors, knownAnswer } from './answers.ts';
import { evaluateCondition, questionIsVisible, type Truth } from './conditions.ts';

export interface AssessmentAnswers {
  org: Answers;
  useCase: Answers;
}
export interface Reason extends Recommendation {
  ruleId: string;
  origin: Rule['scope'];
  when: Condition;
  reviewStatus: Rule['reviewStatus'];
}
export type ReadinessStatus = 'ready' | 'gap' | 'unknown';
export interface ReadinessCheck {
  id: string;
  capabilityId?: string;
  gap: string;
  evidence: 'stated' | 'inferred' | 'judgment';
  sourceId?: string;
  when: Condition;
  status: ReadinessStatus;
}
export interface InScope {
  capability: Capability;
  level: Level;
  reasons: Reason[];
  wave: Capability['defaultWave'];
  ownerTeam: string;
  readiness: { status: ReadinessStatus; checks: ReadinessCheck[] };
}
const weight: Record<Level, number> = { essential: 3, recommended: 2, consider: 1 };
const statusOf = (gap: Truth): ReadinessStatus =>
  gap === null ? 'unknown' : gap ? 'gap' : 'ready';
const readinessOf = (checks: ReadinessCheck[]): ReadinessStatus =>
  checks.some((c) => c.status === 'gap')
    ? 'gap'
    : checks.length === 0 || checks.some((c) => c.status === 'unknown')
      ? 'unknown'
      : 'ready';
const percent = (numerator: number, denominator: number) =>
  denominator === 0 ? null : Math.round((100 * numerator) / denominator);
const compareText = (a: string, b: string) => a.localeCompare(b, 'en');

export function evaluateAssessment(
  data: Content,
  input: AssessmentAnswers,
  contentVersion: string,
) {
  const errors = [
    ...answerErrors(data.questions, input.org, 'org'),
    ...answerErrors(data.questions, input.useCase, 'useCase'),
  ];
  if (errors.length) throw new Error(`Invalid assessment answers: ${errors.join('; ')}`);
  const answers = { ...input.org, ...input.useCase };
  const reasons = new Map<string, Reason[]>();
  const advisoryIds = new Set<string>();
  const matchedRuleIds: string[] = [];
  const unknownRuleIds: string[] = [];
  for (const rule of data.rules) {
    const match = evaluateCondition(rule.when, answers);
    if (match === null) unknownRuleIds.push(rule.id);
    if (match !== true) continue;
    matchedRuleIds.push(rule.id);
    for (const recommendation of rule.recommend) {
      const list = reasons.get(recommendation.capability) ?? [];
      list.push({
        ...recommendation,
        ruleId: rule.id,
        origin: rule.scope,
        when: rule.when,
        reviewStatus: rule.reviewStatus,
      });
      reasons.set(recommendation.capability, list);
    }
    rule.advisories.forEach((id) => advisoryIds.add(id));
  }
  const inScope: InScope[] = data.capabilities.flatMap((capability) => {
    const matches = reasons.get(capability.id);
    if (!matches) return [];
    matches.sort((a, b) => compareText(a.ruleId, b.ruleId));
    const level = matches.reduce<Level>(
      (highest, reason) => (weight[reason.level] > weight[highest] ? reason.level : highest),
      'consider',
    );
    const waves = matches.flatMap((r) => (r.wave === undefined ? [] : [r.wave])).sort();
    const checks = (capability.prerequisites ?? []).map((p, i): ReadinessCheck => ({
      ...p,
      id: `${capability.id}-${i + 1}`,
      capabilityId: capability.id,
      status: statusOf(evaluateCondition(p.when, answers)),
    }));
    return [
      {
        capability,
        level,
        reasons: matches,
        wave: waves[0] ?? capability.defaultWave,
        ownerTeam: ownerTeamOf(capability, data.consoles),
        readiness: { status: readinessOf(checks), checks },
      },
    ];
  });
  const pillarOrder = (c: Capability) => data.pillars.find((p) => p.id === c.pillar)!.order;
  inScope.sort(
    (a, b) =>
      pillarOrder(a.capability) - pillarOrder(b.capability) ||
      weight[b.level] - weight[a.level] ||
      compareText(a.capability.shortName, b.capability.shortName) ||
      compareText(a.capability.id, b.capability.id),
  );
  const included = new Set(inScope.map((r) => r.capability.id));
  const notInScope = data.capabilities
    .filter((c) => !included.has(c.id))
    .map((capability) => ({
      capability,
      becomesRelevantIf: data.rules
        .flatMap((rule) =>
          rule.recommend
            .filter((r) => r.capability === capability.id)
            .map((r) => ({
              ...r,
              ruleId: rule.id,
              origin: rule.scope,
              when: rule.when,
            })),
        )
        .sort((a, b) => compareText(a.ruleId, b.ruleId)),
    }));
  const riskResults = data.risks.map((risk) => ({
    risk,
    applies: evaluateCondition(risk.triggeredWhen, answers),
    inScope: risk.mitigatedBy.filter((id) => included.has(id)),
    outOfScope: risk.mitigatedBy.filter((id) => !included.has(id)),
  }));
  const globalChecks = data.mappingConfig.readinessChecks.flatMap((check): ReadinessCheck[] => {
    const applicable = evaluateCondition(check.appliesWhen, answers);
    if (applicable === false) return [];
    return [
      {
        ...check,
        status: applicable === null ? 'unknown' : statusOf(evaluateCondition(check.when, answers)),
      },
    ];
  });
  const checks = [...inScope.flatMap((r) => r.readiness.checks), ...globalChecks];
  const readyCount = checks.filter((c) => c.status === 'ready').length;
  const intensity = (items: InScope[], catalog: Capability[]) =>
    percent(
      items.reduce((sum, r) => sum + weight[r.level], 0),
      catalog.length * 3,
    ) ?? 0;
  const userOption = data.questions
    .find((q) => q.id === 'expectedUsers')
    ?.options.find((o) => o.value === answers.expectedUsers);
  const licenseKey =
    answers.accessModel === 'delegated'
      ? 'delegated'
      : answers.accessModel === 'mixed'
        ? 'mixed'
        : answers.accessModel === 'own-teammate' || answers.accessModel === 'own-background'
          ? 'own'
          : null;
  return {
    contentVersion,
    inScope,
    notInScope,
    matchedRuleIds: matchedRuleIds.sort(compareText),
    unknownRuleIds: unknownRuleIds.sort(compareText),
    advisories: data.advisories.filter((a) => advisoryIds.has(a.id)),
    anatomy: [...data.controlPoints]
      .sort((a, b) => a.order - b.order)
      .map((point) => ({
        point,
        capabilities: inScope.filter((r) => r.capability.controlPoints.includes(point.id)),
      })),
    risks: riskResults.filter((r) => r.applies === true),
    potentialRisks: riskResults.filter((r) => r.applies === null),
    readiness: {
      status: readinessOf(checks),
      checks,
      readyCount,
      total: checks.length,
      percent: percent(readyCount, checks.length),
      checkedCapabilities: inScope.filter((r) => r.readiness.checks.length > 0).length,
      uncheckedCapabilities: inScope
        .filter((r) => r.readiness.checks.length === 0)
        .map((r) => r.capability.id),
    },
    operatingModel: [...new Set(inScope.map((r) => r.ownerTeam))]
      .sort(compareText)
      .map((ownerTeam) => ({
        ownerTeam,
        stages: [...data.lifecycle]
          .sort((a, b) => a.order - b.order)
          .map((stage) => ({
            stage,
            capabilities: inScope.filter(
              (r) => r.ownerTeam === ownerTeam && r.capability.lifecycleStages.includes(stage.id),
            ),
          })),
      })),
    agentDecisions: inScope.filter((r) => needsAgentDecision(r.capability)),
    integrationPaths: data.integrationPaths.filter(
      (p) => evaluateCondition(p.when, answers) === true,
    ),
    frontier: data.frontierMappings.filter(
      (f) =>
        typeof answers.accessModel === 'string' && f.accessModels.includes(answers.accessModel),
    ),
    licensing: {
      foundational: inScope.filter((r) => licensingTier(r.capability) === 'foundational').length,
      premium: inScope.filter((r) => licensingTier(r.capability) === 'premium').length,
      basis: licenseKey === null ? null : data.mappingConfig.licenseBasis[licenseKey],
      eligibility: 'unknown' as const,
      expectedUsers: userOption?.range ?? null,
      expectedUsersLabel: userOption?.label ?? null,
      note: data.mappingConfig.licensingNote,
      sourceIds: data.mappingConfig.licensingSourceIds,
    },
    intensity: {
      overall: intensity(inScope, data.capabilities),
      pillars: data.pillars.map((pillar) => ({
        pillar,
        value: intensity(
          inScope.filter((r) => r.capability.pillar === pillar.id),
          data.capabilities.filter((c) => c.pillar === pillar.id),
        ),
      })),
    },
    gccGaps:
      answers.cloudEnvironment === 'gcc'
        ? inScope.filter((r) => !r.capability.source.gccAvailable)
        : [],
    sovereignVerification:
      answers.cloudEnvironment === 'gcc-high-dod' || answers.cloudEnvironment === 'other-sovereign',
    openQuestions: data.questions
      .filter(
        (q) => questionIsVisible(q.id, data.diagnostic, answers) && !knownAnswer(answers[q.id]),
      )
      .map((q) => ({ id: q.id, label: q.label, scope: q.scope, guidance: q.ifUnknown })),
  };
}

export type AssessmentResult = ReturnType<typeof evaluateAssessment>;

export function patternAnswers(
  data: Content,
  patternId: string,
  sampleId?: string,
): AssessmentAnswers {
  const pattern = data.patterns.find((p) => p.id === patternId);
  if (!pattern) throw new Error(`Unknown pattern "${patternId}"`);
  const sample =
    sampleId === undefined
      ? undefined
      : data.samples.find((s) => s.id === sampleId && s.patternId === patternId);
  if (sampleId !== undefined && !sample)
    throw new Error(`Unknown sample "${sampleId}" for pattern "${patternId}"`);
  return {
    org: { ...data.mappingConfig.neutralOrg },
    useCase: { ...pattern.answers, ...sample?.answers },
  };
}

export function evaluatePatterns(data: Content, version: string) {
  return data.patterns.map((pattern) => ({
    pattern,
    result: evaluateAssessment(data, patternAnswers(data, pattern.id), version),
  }));
}

export function evaluateWhatIfs(data: Content, input: AssessmentAnswers, version: string) {
  const baseline = evaluateAssessment(data, input, version);
  return data.whatIfs.map((whatIf) => {
    const result = evaluateAssessment(
      data,
      { org: { ...input.org, ...whatIf.org }, useCase: { ...input.useCase, ...whatIf.answers } },
      version,
    );
    return {
      whatIf,
      added: result.inScope.filter(
        (r) => !baseline.inScope.some((b) => b.capability.id === r.capability.id),
      ),
      removed: baseline.inScope.filter(
        (b) => !result.inScope.some((r) => r.capability.id === b.capability.id),
      ),
      changed: result.inScope.flatMap((r) => {
        const before = baseline.inScope.find((b) => b.capability.id === r.capability.id);
        return before && before.level !== r.level
          ? [{ capability: r.capability, from: before.level, to: r.level }]
          : [];
      }),
      gccGaps: result.gccGaps,
    };
  });
}
