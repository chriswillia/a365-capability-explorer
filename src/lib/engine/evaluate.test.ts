import { describe, expect, it } from 'vitest';
import { content, contentMeta } from '../content/index.ts';
import type { Answers } from '../content/schemas.ts';
import {
  evaluateAssessment,
  evaluatePatterns,
  evaluateWhatIfs,
  patternAnswers,
} from './evaluate.ts';

const evaluate = (org: Answers = {}, useCase: Answers = {}) =>
  evaluateAssessment(content, { org, useCase }, 'test-version');

describe('seed rule groups', () => {
  const cases: [string, Answers, Answers][] = [
    ['baseline', {}, {}],
    ['pilot', {}, { stage: 'pilot' }],
    ['production', {}, { stage: 'production' }],
    ['external-platform', {}, { buildPlatform: 'hyperscaler' }],
    ['pro-code', {}, { buildPlatform: 'pro-code-third-party' }],
    ['copilot-studio', {}, { buildPlatform: 'copilot-studio' }],
    ['copilot-network', {}, { buildPlatform: 'copilot-studio', networkEgress: 'yes' }],
    ['local-agent', {}, { buildPlatform: 'local-agent' }],
    ['org-shadow-ai', { shadowAI: 'yes' }, {}],
    ['delegated', {}, { accessModel: 'delegated' }],
    ['delegated-devices', {}, { accessModel: 'mixed', managedDevices: 'mixed' }],
    ['own-access', {}, { accessModel: 'own-background' }],
    ['teammate', {}, { accessModel: 'own-teammate' }],
    ['no-sponsor', {}, { sponsor: 'not-yet' }],
    ['active-actions', {}, { actions: ['transactions'] }],
    ['external-audience', {}, { audience: ['partners'] }],
    ['sensitive-data', {}, { regulatedData: ['health'] }],
    ['labeling-gap', { labelsProgram: 'partial' }, { dataSensitivity: 'confidential' }],
    ['retention', {}, { generatesContent: 'yes' }],
    ['investigation', {}, { obligations: ['legal-hold'] }],
    ['ai-regulation', {}, { obligations: ['ai-regulation'] }],
    ['tools', {}, { tools: ['microsoft-mcp'] }],
    ['computer-use', {}, { tools: ['computer-use'] }],
    ['agent-to-agent', {}, { agentToAgent: 'yes' }],
    ['large-estate', { agentEstate: 'hundreds' }, {}],
    ['cmdb', { orgGovernance: ['cmdb-integration'] }, {}],
    ['ownerless', { orgGovernance: ['ownerless-handling'] }, {}],
    ['policy-baseline', { orgGovernance: ['policy-baseline'] }, {}],
    ['org-reporting', { orgGovernance: ['exec-reporting'] }, {}],
    ['agent-reporting', {}, { agentGovernance: ['exec-reporting'] }],
    ['approval-audience', {}, { agentGovernance: ['restrict-audience'] }],
    ['soc', { securityOps: ['soc-monitoring'] }, {}],
    ['hunting', { securityOps: ['threat-hunting'] }, {}],
    ['posture', { securityOps: ['posture-management'] }, {}],
    ['insider-risk', { securityOps: ['insider-risk'] }, {}],
    ['sovereign', { cloudEnvironment: 'gcc-high-dod' }, {}],
  ];
  it('covers every configured rule with a table-driven positive fixture', () => {
    expect(cases.map(([id]) => id).sort()).toEqual(content.rules.map((r) => r.id).sort());
  });
  it.each(cases)('%s emits each reason and advisory with its provenance', (id, org, answers) => {
    const result = evaluate(org, answers);
    const rule = content.rules.find((r) => r.id === id)!;
    expect(result.matchedRuleIds).toContain(id);
    for (const r of rule.recommend) {
      expect(result.inScope.find((c) => c.capability.id === r.capability)?.reasons).toContainEqual({
        ...r,
        ruleId: rule.id,
        origin: rule.scope,
        when: rule.when,
        reviewStatus: rule.reviewStatus,
      });
    }
    expect(result.advisories.map((a) => a.id)).toEqual(expect.arrayContaining(rule.advisories));
  });
});

describe('assessment engine', () => {
  it('promotes to the highest level and retains every reason, source, evidence and origin', () => {
    const result = evaluate(
      { orgGovernance: ['exec-reporting'] },
      { stage: 'production', buildPlatform: 'pro-code-microsoft' },
    );
    const observability = result.inScope.find((r) => r.capability.id === 'observability')!;
    expect(observability.level).toBe('essential');
    expect(observability.reasons.map((r) => [r.ruleId, r.level, r.origin])).toEqual([
      ['org-reporting', 'essential', 'org'],
      ['pilot', 'recommended', 'useCase'],
      ['pro-code', 'essential', 'useCase'],
      ['production', 'essential', 'useCase'],
    ]);
    expect(observability.capability).toEqual(
      content.capabilities.find((c) => c.id === 'observability'),
    );
    expect(result.contentVersion).toBe('test-version');
  });
  it('is deterministic if rules and catalog arrays are reordered, and never mutates content or answers', () => {
    const data = structuredClone(content);
    const input = patternAnswers(data, 'process-agent');
    const before = structuredClone({ data, input });
    const result = evaluateAssessment(data, input, 'test');
    expect({ data, input }).toEqual(before);
    data.rules.reverse();
    data.capabilities.reverse();
    expect(evaluateAssessment(data, input, 'test').inScope).toEqual(result.inScope);
    const rank = { essential: 0, recommended: 1, consider: 2 };
    expect(result.inScope.map((r) => r.capability.id)).toEqual(
      [...result.inScope]
        .sort((a, b) => {
          const pillar = (id: string) => data.pillars.find((p) => p.id === id)!.order;
          return (
            pillar(a.capability.pillar) - pillar(b.capability.pillar) ||
            rank[a.level] - rank[b.level] ||
            a.capability.shortName.localeCompare(b.capability.shortName, 'en')
          );
        })
        .map((r) => r.capability.id),
    );
  });
  it('uses the earliest explicit wave override without discarding the default for other capabilities', () => {
    const data = structuredClone(content);
    data.rules[0]!.recommend[0]!.wave = 3;
    data.rules.push({
      ...structuredClone(data.rules[0]!),
      id: 'earlier-wave',
      recommend: [{ ...data.rules[0]!.recommend[0]!, wave: 2 }],
    });
    expect(
      evaluateAssessment(data, { org: {}, useCase: {} }, 'test').inScope.find(
        (r) => r.capability.id === 'registry-inventory',
      )!.wave,
    ).toBe(2);
  });
  it('does not turn missing answers or not-conditions into confident recommendations or readiness', () => {
    const result = evaluate({}, { dataSensitivity: 'confidential', accessModel: 'own-teammate' });
    expect(result.advisories.map((a) => a.id)).not.toContain('labeling-readiness');
    expect(result.unknownRuleIds).toContain('labeling-gap');
    expect(result.readiness.checks.every((c) => c.status === 'unknown')).toBe(true);
    expect(result.readiness.status).toBe('unknown');
    expect(result.openQuestions.map((q) => q.id)).toContain('labelsProgram');
    expect(result.potentialRisks.length).toBeGreaterThan(0);
    expect(
      evaluate({}, { regulatedData: ['none'], tools: ['none'] }).inScope.map(
        (r) => r.capability.id,
      ),
    ).not.toContain('tool-controls');
  });
  it('reports exact readiness denominators, keeps unknowns, and excludes unchecked capabilities', () => {
    const result = evaluate(
      { labelsProgram: 'broad' },
      { dataSensitivity: 'confidential', accessModel: 'own-background' },
    );
    expect(result.readiness).toMatchObject({
      readyCount: 2,
      total: 2,
      percent: 100,
      checkedCapabilities: 2,
    });
    expect(result.inScope.find((r) => r.capability.id === 'registry-inventory')!.readiness).toEqual(
      { status: 'unknown', checks: [] },
    );
    expect(evaluate({}, { accessModel: 'delegated' }).readiness).toMatchObject({
      readyCount: 0,
      total: 0,
      percent: null,
      status: 'unknown',
    });
    expect(
      evaluate(
        { labelsProgram: 'partial' },
        { dataSensitivity: 'confidential', accessModel: 'own-background' },
      ).readiness,
    ).toMatchObject({ readyCount: 0, total: 2, percent: 0, status: 'gap' });
    expect(
      evaluate({ frontierProgram: 'not-enrolled' }, { accessModel: 'own-teammate' }).readiness
        .checks,
    ).toContainEqual(expect.objectContaining({ id: 'teammate-frontier', status: 'gap' }));
  });
  it('partitions every capability, retains relevance conditions and maps risk mitigations on both sides', () => {
    const result = evaluate({}, { stage: 'idea', accessModel: 'delegated', tools: ['none'] });
    expect(
      new Set([
        ...result.inScope.map((r) => r.capability.id),
        ...result.notInScope.map((r) => r.capability.id),
      ]).size,
    ).toBe(content.capabilities.length);
    const graph = result.notInScope.find((r) => r.capability.id === 'registry-graph-api')!;
    expect(graph.becomesRelevantIf.map((r) => r.ruleId)).toEqual(['cmdb', 'large-estate']);
    const blind = result.risks.find((r) => r.risk.id === 'blind-spots')!;
    expect(blind.inScope).toEqual(['registry-inventory']);
    expect(blind.outOfScope).toEqual(['observability', 'registry-graph-api']);
  });
  it('computes exact intensity, licensing counts, audience bounds and explicit unknown eligibility', () => {
    const baseline = evaluate({}, {});
    expect(baseline.intensity.overall).toBe(8); // 6 / (26 * 3), rounded.
    expect(baseline.licensing.foundational + baseline.licensing.premium).toBe(2);
    expect(baseline.licensing).toMatchObject({
      basis: null,
      eligibility: 'unknown',
      expectedUsers: null,
    });
    expect(evaluate({}, { expectedUsers: 'gt-5000' }).licensing.expectedUsers).toEqual({
      min: 5001,
      max: null,
    });
    expect(evaluate({}, { expectedUsers: 'lt-50' }).licensing.expectedUsers).toEqual({
      min: 0,
      max: 49,
    });
    const all = evaluate(
      {
        agentEstate: 'hundreds',
        orgGovernance: ['cmdb-integration', 'ownerless-handling', 'policy-baseline'],
        securityOps: ['soc-monitoring', 'threat-hunting', 'posture-management', 'insider-risk'],
        shadowAI: 'yes',
      },
      {
        stage: 'production',
        buildPlatform: 'hyperscaler',
        accessModel: 'mixed',
        managedDevices: 'yes',
        autonomy: 'autonomous',
        dataSensitivity: 'confidential',
        tools: ['computer-use'],
        generatesContent: 'yes',
        obligations: ['ai-regulation'],
      },
    );
    expect(all.inScope).toHaveLength(26);
    expect(all.intensity.overall).toBe(94); // 73 / 78: five supporting controls remain Recommended.
    for (const pillar of all.intensity.pillars) expect(pillar.value).toBeGreaterThanOrEqual(0);
  });
  it('does not extrapolate GCC availability to other sovereign clouds', () => {
    const useCase = {};
    const org = { orgGovernance: ['cmdb-integration'] };
    expect(
      evaluate({ ...org, cloudEnvironment: 'gcc' }, useCase).gccGaps.map((r) => r.capability.id),
    ).toContain('registry-graph-api');
    expect(evaluate({ cloudEnvironment: 'gcc-high-dod' }, useCase)).toMatchObject({
      gccGaps: [],
      sovereignVerification: true,
    });
    expect(evaluate({ cloudEnvironment: 'commercial' }, useCase).gccGaps).toEqual([]);
  });
  it('provides owner × stage cells, all control-point memberships and per-agent decisions', () => {
    const result = evaluate({}, { accessModel: 'mixed', managedDevices: 'yes' });
    for (const rec of result.inScope) {
      expect(
        result.anatomy
          .filter((a) => a.capabilities.some((c) => c.capability.id === rec.capability.id))
          .map((a) => a.point.id)
          .sort(),
      ).toEqual([...rec.capability.controlPoints].sort());
      expect(
        result.operatingModel
          .find((o) => o.ownerTeam === rec.ownerTeam)!
          .stages.filter((s) => s.capabilities.some((r) => r.capability.id === rec.capability.id))
          .map((s) => s.stage.id)
          .sort(),
      ).toEqual([...rec.capability.lifecycleStages].sort());
    }
    expect(
      result.agentDecisions.every(
        (r) => r.capability.setup === 'agent' || r.capability.setup === 'both',
      ),
    ).toBe(true);
    expect(result.frontier).toHaveLength(3);
  });
  it('throws actionable errors on invalid inputs instead of returning success-shaped defaults', () => {
    expect(() => evaluate({}, { tools: ['none', 'code-execution'] })).toThrow('must be exclusive');
    expect(() => evaluate({ stage: 'pilot' }, {})).toThrow('belongs to useCase');
    expect(() => patternAnswers(content, 'not-a-pattern')).toThrow('Unknown pattern');
    expect(() => patternAnswers(content, 'knowledge-agent', 'askhr')).toThrow('Unknown sample');
  });
});

describe('generated mappings and authored golden scenarios', () => {
  it('has a mixed-access scenario whose recommendations cover both delegated and own access', () => {
    const mixed = content.patterns.find((p) => p.answers.accessModel === 'mixed')!;
    expect(mixed).toBeDefined();
    const result = evaluateAssessment(
      content,
      patternAnswers(content, mixed.id),
      contentMeta.contentVersion,
    );
    const level = (id: string) => result.inScope.find((r) => r.capability.id === id)?.level;
    expect(level('entra-conditional-access')).toBe('essential');
    expect(level('entra-access-packages')).toBe('essential');
    expect(level('entra-sponsor-lifecycle')).toBe('essential');
    expect(result.licensing.basis).toBe(content.mappingConfig.licenseBasis.mixed);
  });
  it.each([
    ['delegated', 'delegated'],
    ['own-teammate', 'own'],
    ['own-background', 'own'],
    ['mixed', 'mixed'],
  ] as const)('states who to license for the access answer "%s"', (answer, key) => {
    const basis = evaluate({}, { accessModel: answer }).licensing.basis;
    expect(basis).toBe(content.mappingConfig.licenseBasis[key]);
    expect(basis?.length).toBeGreaterThan(20);
  });
  it('states no license basis, rather than a guess, while the access answer is missing or unknown', () => {
    expect(evaluate({}, {}).licensing.basis).toBeNull();
    expect(evaluate({}, { accessModel: 'unknown' }).licensing.basis).toBeNull();
  });
  it.each(content.goldenScenarios)(
    '$id matches essential inclusions and exclusions',
    (scenario) => {
      const input = patternAnswers(content, scenario.patternId, scenario.sampleId);
      const result = evaluateAssessment(
        content,
        {
          org: { ...input.org, ...scenario.org },
          useCase: { ...input.useCase, ...scenario.answers },
        },
        contentMeta.contentVersion,
      );
      const ids = result.inScope.map((r) => r.capability.id);
      for (const id of scenario.mustInclude)
        expect(result.inScope.find((r) => r.capability.id === id)?.level, id).toBe('essential');
      for (const id of scenario.mustNotInclude) expect(ids, id).not.toContain(id);
    },
  );
  it('generates every matrix cell from the same evaluation with the neutral organization', () => {
    const generated = evaluatePatterns(content, contentMeta.contentVersion);
    expect(generated).toHaveLength(content.patterns.length);
    for (const row of generated)
      expect(row.result).toEqual(
        evaluateAssessment(
          content,
          patternAnswers(content, row.pattern.id),
          contentMeta.contentVersion,
        ),
      );
    expect(patternAnswers(content, 'knowledge-agent').org).toEqual(
      content.mappingConfig.neutralOrg,
    );
  });
  it('calculates added, removed, changed levels and GCC gaps without mutating the baseline', () => {
    const input = patternAnswers(content, 'personal-assistant');
    const original = structuredClone(input);
    const deltas = evaluateWhatIfs(content, input, 'test');
    expect(input).toEqual(original);
    expect(
      deltas
        .find((d) => d.whatIf.id === 'to-production')!
        .changed.map((c) => [c.capability.id, c.from, c.to]),
    ).toContainEqual(['observability', 'recommended', 'essential']);
    expect(
      deltas.find((d) => d.whatIf.id === 'go-autonomous')!.removed.map((r) => r.capability.id),
    ).toContain('entra-conditional-access');
    expect(
      deltas.find((d) => d.whatIf.id === 'add-mcp-tools')!.added.map((r) => r.capability.id),
    ).toContain('tool-controls');
  });
});
