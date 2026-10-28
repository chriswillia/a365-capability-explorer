import { ACCESS_PATTERNS, GATES, PASSPORT_QUESTION_IDS } from './schemas.ts';
import type { Condition, Content, Question } from './schemas.ts';

/*
 * Cross-reference checks for the seller playbook files (value, licensing, requirements, access patterns,
 * guardrails and fit). Runs on content that already passed its schema. Pure: no file access.
 */
export interface PlaybookValidation {
  errors: string[];
  /** Every lastVerified date in the playbook files, for the staleness check in validate.ts. */
  dates: { where: string; date: string }[];
}

export function validatePlaybook(
  content: Content,
  citeSource: (where: string, id: string) => void,
): PlaybookValidation {
  const errors: string[] = [];
  const dates: PlaybookValidation['dates'] = [];
  const capabilityIds = content.capabilities.map((c) => c.id);
  const questionById = new Map(content.questions.map((q) => [q.id, q]));
  const optionValues = (id: string): string[] =>
    questionById.get(id)?.options.map((o) => o.value) ?? [];

  const duplicates = (label: string, values: string[]) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) errors.push(`${label}: duplicate id "${value}"`);
      seen.add(value);
    }
  };
  const known = (where: string, kind: string, id: string, ids: readonly string[]) => {
    if (!ids.includes(id)) errors.push(`${where}: unknown ${kind} "${id}"`);
  };

  // Sources and dates, wherever a record names them.
  const walk = (where: string, value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(`${where}[${index}]`, item));
      return;
    }
    if (value === null || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    const here = typeof record.id === 'string' ? `${where} › ${record.id}` : where;
    if (Array.isArray(record.sourceIds))
      for (const id of record.sourceIds) if (typeof id === 'string') citeSource(here, id);
    if (typeof record.lastVerified === 'string')
      dates.push({ where: here, date: record.lastVerified });
    for (const [key, child] of Object.entries(record)) walk(`${here} › ${key}`, child);
  };
  walk('value.yaml', content.value);
  walk('licensing.yaml', content.licensing);
  walk('requirements.yaml', content.requirements);
  walk('access-patterns.yaml', content.accessPatterns);
  walk('guardrails.yaml', content.guardrails);
  walk('fit.yaml', content.fit);

  const checkCondition = (where: string, value: Condition): void => {
    if ('always' in value) return;
    if ('not' in value) return checkCondition(where, value.not);
    if ('all' in value || 'any' in value) {
      for (const child of 'all' in value ? value.all : value.any) checkCondition(where, child);
      return;
    }
    const question: Question | undefined = questionById.get(value.q);
    if (question === undefined) {
      errors.push(`${where}: unknown question "${value.q}"`);
      return;
    }
    const multi = value.includes !== undefined || value.includesAny !== undefined;
    const single = value.equals !== undefined || value.in !== undefined;
    if (
      (multi && question.type !== 'multi') ||
      (single && !['single', 'scale'].includes(question.type))
    )
      errors.push(`${where}: incompatible operator for ${question.type} question "${question.id}"`);
    for (const operand of [
      value.equals,
      value.includes,
      ...(value.in ?? []),
      ...(value.includesAny ?? []),
    ]) {
      if (operand !== undefined)
        known(where, `option for ${question.id}`, operand, optionValues(question.id));
    }
  };

  // ---------- value.yaml ----------
  const value = content.value;
  const themeIds = value.themes.items.map((t) => t.id);
  duplicates('value.yaml themes', themeIds);
  duplicates(
    'value.yaml problem',
    value.problem.statements.map((s) => s.id),
  );
  duplicates(
    'value.yaml gaps',
    value.gaps.items.map((g) => g.id),
  );
  duplicates(
    'value.yaml buyers',
    value.buyers.items.map((b) => b.id),
  );
  duplicates(
    'value.yaml objections',
    value.objections.items.map((o) => o.id),
  );
  duplicates(
    'value.yaml proof',
    value.proof.items.map((p) => p.id),
  );
  duplicates(
    'value.yaml entryPoints',
    value.entryPoints.items.map((e) => e.id),
  );
  duplicates(
    'value.yaml jointPlan',
    value.jointPlan.rows.map((r) => r.id),
  );
  duplicates(
    'value.yaml proofOfValue',
    value.proofOfValue.steps.map((s) => s.id),
  );
  const themeOf = new Map<string, string>();
  for (const theme of value.themes.items) {
    for (const id of theme.capabilityIds) {
      known(`value.yaml › ${theme.id}`, 'capability', id, capabilityIds);
      const earlier = themeOf.get(id);
      if (earlier !== undefined)
        errors.push(`value.yaml › ${theme.id}: capability "${id}" is also in theme "${earlier}"`);
      themeOf.set(id, theme.id);
    }
  }
  for (const id of capabilityIds)
    if (!themeOf.has(id)) errors.push(`value.yaml: capability "${id}" is not in any value theme`);
  for (const gap of value.gaps.items)
    known(`value.yaml › gaps › ${gap.id}`, 'theme', gap.themeId, themeIds);
  for (const buyer of value.buyers.items)
    for (const id of buyer.themeIds) known(`value.yaml › ${buyer.id}`, 'theme', id, themeIds);

  // ---------- licensing.yaml ----------
  const licensing = content.licensing;
  const accessValues = optionValues('accessModel');
  const populationIds = licensing.who.populations.map((p) => p.id);
  duplicates('licensing.yaml populations', populationIds);
  duplicates(
    'licensing.yaml principles',
    licensing.who.principles.map((p) => p.id),
  );
  duplicates(
    'licensing.yaml segments',
    licensing.prerequisites.segments.map((s) => s.id),
  );
  duplicates(
    'licensing.yaml without',
    licensing.prerequisites.without.map((w) => w.id),
  );
  duplicates(
    'licensing.yaml regulated',
    licensing.regulated.items.map((r) => r.id),
  );
  duplicates(
    'licensing.yaml other',
    licensing.other.items.map((o) => o.id),
  );
  duplicates(
    'licensing.yaml help',
    licensing.help.items.map((h) => h.id),
  );
  duplicates(
    'licensing.yaml differs',
    licensing.prerequisites.differs.items.map((d) => d.id),
  );
  for (const item of licensing.prerequisites.differs.items) {
    duplicates(
      `licensing.yaml › ${item.id} statements`,
      item.statements.map((s) => s.sourceId),
    );
    for (const statement of item.statements)
      if (!item.sourceIds.includes(statement.sourceId))
        errors.push(
          `licensing.yaml › ${item.id}: a statement cites "${statement.sourceId}", which is not in the item's sourceIds`,
        );
  }
  duplicates(
    'licensing.yaml sizing',
    licensing.sizing.reports.map((r) => r.id),
  );
  duplicates(
    'licensing.yaml calculator plans',
    licensing.calculator.planFamilies.map((family) => family.id),
  );
  for (const standing of ['included', 'qualifies'] as const)
    if (!licensing.calculator.planFamilies.some((family) => family.standing === standing))
      errors.push(`licensing.yaml calculator: no plan family has the standing "${standing}"`);
  for (const population of licensing.who.populations) {
    for (const answer of population.appliesTo ?? [])
      known(`licensing.yaml › ${population.id}`, 'accessModel answer', answer, accessValues);
    for (const audience of population.whenAudience ?? [])
      known(
        `licensing.yaml › ${population.id}`,
        'audience answer',
        audience,
        optionValues('audience'),
      );
  }
  for (const answer of accessValues) {
    const covered = licensing.who.populations.some(
      (p) => p.need === 'required' && p.appliesTo?.includes(answer as never),
    );
    if (!covered)
      errors.push(`licensing.yaml: no required population for the accessModel answer "${answer}"`);
  }
  const coveredPlans = new Set<string>();
  for (const segment of licensing.prerequisites.segments)
    for (const plan of segment.basePlans) {
      known(`licensing.yaml › ${segment.id}`, 'basePlan answer', plan, optionValues('basePlan'));
      coveredPlans.add(plan);
    }
  for (const plan of optionValues('basePlan'))
    if (plan !== 'other' && !coveredPlans.has(plan))
      errors.push(`licensing.yaml: no prerequisite segment for the basePlan answer "${plan}"`);
  for (const item of licensing.prerequisites.without)
    for (const id of item.capabilityIds)
      known(`licensing.yaml › ${item.id}`, 'capability', id, capabilityIds);

  // ---------- requirements.yaml ----------
  const requirementIds: string[] = [];
  for (const [index, set] of content.requirements.entries()) {
    const where = `requirements.yaml › set ${index + 1}`;
    if (set.capabilityIds.includes('all') && set.capabilityIds.length > 1)
      errors.push(`${where}: "all" must be the only capability id`);
    for (const id of set.capabilityIds)
      if (id !== 'all') known(where, 'capability', id, capabilityIds);
    for (const item of set.items) {
      requirementIds.push(item.id);
      if (item.readyWhen !== undefined) checkCondition(`${where} › ${item.id}`, item.readyWhen);
    }
  }
  duplicates('requirements.yaml items', requirementIds);

  // ---------- access-patterns.yaml ----------
  const access = content.accessPatterns;
  const patternIds = access.patterns.map((p) => p.id);
  duplicates('access-patterns.yaml patterns', patternIds);
  for (const id of ACCESS_PATTERNS)
    if (!patternIds.includes(id)) errors.push(`access-patterns.yaml: missing pattern "${id}"`);
  const coveredAnswers = new Set<string>();
  for (const pattern of access.patterns) {
    for (const answer of pattern.answers) {
      known(`access-patterns.yaml › ${pattern.id}`, 'accessModel answer', answer, accessValues);
      coveredAnswers.add(answer);
    }
    for (const id of pattern.licensingIds)
      known(`access-patterns.yaml › ${pattern.id}`, 'licensing population', id, populationIds);
  }
  for (const answer of accessValues)
    if (!coveredAnswers.has(answer))
      errors.push(`access-patterns.yaml: no pattern for the accessModel answer "${answer}"`);
  duplicates(
    'access-patterns.yaml statuses',
    access.statuses.map((s) => s.id),
  );
  duplicates(
    'access-patterns.yaml capabilities',
    access.capabilities.map((c) => c.capabilityId),
  );
  for (const item of access.capabilities)
    known(
      `access-patterns.yaml › ${item.capabilityId}`,
      'capability',
      item.capabilityId,
      capabilityIds,
    );

  // ---------- guardrails.yaml ----------
  const guardrails = content.guardrails;
  duplicates(
    'guardrails.yaml gates',
    guardrails.gates.map((g) => g.id),
  );
  duplicates(
    'guardrails.yaml items',
    guardrails.items.map((i) => i.id),
  );
  for (const gate of GATES)
    if (!guardrails.items.some((i) => i.gate === gate))
      errors.push(`guardrails.yaml: no guardrail in the "${gate}" gate`);
  for (const item of guardrails.items) {
    for (const id of item.capabilityIds)
      known(`guardrails.yaml › ${item.id}`, 'capability', id, capabilityIds);
    checkCondition(`guardrails.yaml › ${item.id} › appliesWhen`, item.appliesWhen);
    if (item.doneWhen !== undefined)
      checkCondition(`guardrails.yaml › ${item.id} › doneWhen`, item.doneWhen);
  }

  // ---------- fit.yaml ----------
  const fit = content.fit;
  duplicates(
    'fit.yaml statements',
    fit.statements.items.map((s) => s.id),
  );
  duplicates(
    'fit.yaml platforms',
    fit.platforms.items.map((p) => p.id),
  );
  duplicates(
    'fit.yaml stack',
    fit.stack.items.map((s) => s.id),
  );
  duplicates(
    'fit.yaml stack consoles',
    fit.stack.items.map((s) => s.console),
  );
  const platformValues = optionValues('buildPlatform');
  const platformCount = new Map<string, number>();
  for (const platform of fit.platforms.items)
    for (const answer of platform.buildPlatforms) {
      known(`fit.yaml › ${platform.id}`, 'buildPlatform answer', answer, platformValues);
      platformCount.set(answer, (platformCount.get(answer) ?? 0) + 1);
    }
  for (const answer of platformValues) {
    const count = platformCount.get(answer) ?? 0;
    if (count !== 1)
      errors.push(
        `fit.yaml: the buildPlatform answer "${answer}" must belong to exactly one platform (found ${count})`,
      );
  }
  for (const id of fit.netNew.capabilityIds)
    known('fit.yaml › netNew', 'capability', id, capabilityIds);

  // ---------- passport.yaml ----------
  const passport = content.passport;
  duplicates(
    'passport.yaml questions',
    passport.questions.map((q) => q.id),
  );
  for (const id of PASSPORT_QUESTION_IDS) {
    if (!passport.questions.some((q) => q.id === id))
      errors.push(`passport.yaml: no wording for the question "${id}"`);
    if (questionById.get(id)?.scope !== 'useCase')
      errors.push(`passport.yaml: "${id}" must be a use-case question in questions.yaml`);
  }

  // ---------- leave-behind.yaml ----------
  const problemIds = content.value.problem.statements.map((s) => s.id);
  for (const id of content.leaveBehind.whyStatementIds)
    known('leave-behind.yaml › whyStatementIds', 'value.yaml problem statement', id, problemIds);

  // ---------- deploy.yaml ----------
  const periods = content.deploy.plan.periods;
  duplicates(
    'deploy.yaml periods',
    periods.map((p) => p.id),
  );
  for (const gate of content.guardrails.gates)
    if (periods.filter((p) => p.gate === gate.id).length !== 1)
      errors.push(`deploy.yaml: the gate "${gate.id}" must belong to exactly one period`);
  duplicates(
    'deploy.yaml waves',
    periods.map((p) => String(p.wave)),
  );

  // ---------- site.yaml sample customer ----------
  const sampleIds = content.site.ui.sample.sampleIds;
  duplicates('site.yaml ui.sample.sampleIds', sampleIds);
  for (const id of sampleIds)
    known(
      'site.yaml › ui.sample.sampleIds',
      'sample',
      id,
      content.samples.map((s) => s.id),
    );

  return { errors, dates };
}
