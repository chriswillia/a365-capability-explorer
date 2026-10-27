import { answerErrors } from '../engine/answers.ts';
import type { Answers, Condition, Content, Question } from './schemas.ts';

export function validateMapping(
  content: Content,
  citeSource: (where: string, id: string) => void,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const collections = [
    ['questions', content.questions],
    ['rules', content.rules],
    ['advisories', content.advisories],
    ['patterns', content.patterns],
    ['risks', content.risks],
    ['samples', content.samples],
    ['goldenScenarios', content.goldenScenarios],
    ['integrationPaths', content.integrationPaths],
    ['frontierMappings', content.frontierMappings],
    ['whatIfs', content.whatIfs],
    ['readinessChecks', content.mappingConfig.readinessChecks],
  ] as const;
  for (const [file, items] of collections) {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id)) errors.push(`${file}: duplicate id "${item.id}"`);
      seen.add(item.id);
      if ('sourceIds' in item)
        item.sourceIds.forEach((id) => citeSource(`${file} › ${item.id}`, id));
    }
  }
  const reference = (where: string, kind: string, id: string, ids: string[]) => {
    if (!ids.includes(id)) errors.push(`${where}: unknown ${kind} "${id}"`);
  };
  const capabilityIds = content.capabilities.map((c) => c.id);
  const patternIds = content.patterns.map((p) => p.id);
  const advisoryIds = content.advisories.map((a) => a.id);
  const answers = (where: string, value: Answers, scope: Question['scope']) => {
    errors.push(...answerErrors(content.questions, value, scope).map((e) => `${where}: ${e}`));
  };
  const condition = (where: string, value: Condition, scope?: Question['scope']): void => {
    if ('not' in value) return condition(where, value.not, scope);
    if ('all' in value || 'any' in value) {
      for (const child of 'all' in value ? value.all : value.any) condition(where, child, scope);
      return;
    }
    if (!('q' in value)) return;
    const q = content.questions.find((q) => q.id === value.q);
    if (!q) {
      errors.push(`${where}: unknown question "${value.q}"`);
      return;
    }
    if (scope === 'org' && q.scope !== 'org')
      errors.push(`${where}: organization rule references use-case question "${q.id}"`);
    const multi = value.includes !== undefined || value.includesAny !== undefined;
    const single = value.equals !== undefined || value.in !== undefined;
    if ((multi && q.type !== 'multi') || (single && q.type !== 'single' && q.type !== 'scale')) {
      errors.push(`${where}: incompatible operator for ${q.type} question "${q.id}"`);
    }
    const operands = [
      value.equals,
      value.includes,
      ...(value.in ?? []),
      ...(value.includesAny ?? []),
    ].filter((v) => v !== undefined);
    if (new Set(operands).size !== operands.length)
      errors.push(`${where}: duplicate condition operands`);
    operands.forEach((v) =>
      reference(
        where,
        `option for ${q.id}`,
        v,
        q.options.map((o) => o.value),
      ),
    );
  };
  const assigned: string[] = [];
  const sectionIds = content.diagnostic.sections.map((s) => s.id);
  if (new Set(sectionIds).size !== sectionIds.length)
    errors.push('diagnostic: duplicate section id');
  for (const section of content.diagnostic.sections) {
    for (const id of section.questionIds) {
      const q = content.questions.find((q) => q.id === id);
      if (!q || q.scope !== section.scope)
        errors.push(`diagnostic › ${section.id}: unknown question or wrong scope "${id}"`);
      assigned.push(id);
    }
  }
  if (new Set(assigned).size !== assigned.length)
    errors.push('diagnostic: questions must belong to one section');
  for (const q of content.questions) {
    if (!assigned.includes(q.id)) errors.push(`diagnostic: missing section for "${q.id}"`);
    if (!content.diagnostic.consultantNotes[q.id])
      errors.push(`diagnostic: missing consultant note for "${q.id}"`);
    if (!content.diagnostic.askPrompts[q.id])
      errors.push(`diagnostic: missing ask-the-customer prompt for "${q.id}"`);
  }
  for (const id of [
    ...content.diagnostic.quickQuestionIds,
    ...Object.keys(content.diagnostic.consultantNotes),
    ...Object.keys(content.diagnostic.askPrompts),
  ])
    reference(
      'diagnostic',
      'question',
      id,
      content.questions.map((q) => q.id),
    );
  for (const item of content.diagnostic.visibility) {
    reference(
      'diagnostic visibility',
      'question',
      item.questionId,
      content.questions.map((q) => q.id),
    );
    condition('diagnostic visibility', item.when);
  }
  for (const q of content.questions) {
    const options = q.options.map((o) => o.value);
    if (new Set(options).size !== options.length)
      errors.push(`questions › ${q.id}: duplicate options`);
    if (options.includes('unknown')) errors.push(`questions › ${q.id}: unknown is reserved`);
    for (const o of q.options)
      if (o.range && o.range.max !== null && o.range.max < o.range.min)
        errors.push(`questions › ${q.id}: inverted user range`);
  }
  for (const rule of content.rules) {
    const where = `rules › ${rule.id}`;
    condition(where, rule.when, rule.scope);
    if (new Set(rule.recommend.map((r) => r.capability)).size !== rule.recommend.length)
      errors.push(`${where}: duplicate capability output`);
    if (new Set(rule.advisories).size !== rule.advisories.length)
      errors.push(`${where}: duplicate advisory output`);
    for (const r of rule.recommend) {
      reference(where, 'capability', r.capability, capabilityIds);
      r.sourceIds.forEach((id) => citeSource(where, id));
    }
    rule.advisories.forEach((id) => reference(where, 'advisory', id, advisoryIds));
  }
  for (const c of content.capabilities) {
    for (const p of c.prerequisites ?? [])
      condition(`capabilities › ${c.id} prerequisites`, p.when);
    if (!content.risks.some((r) => r.mitigatedBy.includes(c.id)))
      errors.push(`capabilities › ${c.id}: no risk mitigation association`);
    if (!content.rules.some((r) => r.recommend.some((rec) => rec.capability === c.id)))
      errors.push(`capabilities › ${c.id}: no recommendation rule`);
  }
  for (const r of content.risks) {
    condition(`risks › ${r.id}`, r.triggeredWhen);
    r.mitigatedBy.forEach((id) => reference(`risks › ${r.id}`, 'capability', id, capabilityIds));
  }
  for (const p of content.patterns) answers(`patterns › ${p.id}`, p.answers, 'useCase');
  for (const s of content.samples) {
    reference(`samples › ${s.id}`, 'pattern', s.patternId, patternIds);
    answers(`samples › ${s.id}`, s.answers, 'useCase');
  }
  for (const s of content.goldenScenarios) {
    const where = `goldenScenarios › ${s.id}`;
    reference(where, 'pattern', s.patternId, patternIds);
    if (s.sampleId) {
      const sample = content.samples.find((sample) => sample.id === s.sampleId);
      if (!sample || sample.patternId !== s.patternId)
        errors.push(`${where}: sample does not match pattern`);
    }
    answers(where, s.org, 'org');
    answers(where, s.answers, 'useCase');
    [...s.mustInclude, ...s.mustNotInclude].forEach((id) =>
      reference(where, 'capability', id, capabilityIds),
    );
    if (s.mustInclude.some((id) => s.mustNotInclude.includes(id)))
      errors.push(`${where}: contradictory expectations`);
    if (s.reviewedBy === null) warnings.push(`${where}: unsigned, pending SME review`);
  }
  for (const p of content.patterns)
    if (!content.goldenScenarios.some((s) => s.patternId === p.id && s.sampleId === undefined))
      errors.push(`patterns › ${p.id}: missing golden scenario`);
  for (const s of content.samples)
    if (!content.goldenScenarios.some((g) => g.sampleId === s.id))
      errors.push(`samples › ${s.id}: missing golden scenario`);
  for (const path of content.integrationPaths)
    condition(`integrationPaths › ${path.id}`, path.when);
  for (const f of content.frontierMappings) {
    reference(
      `frontierMappings › ${f.id}`,
      'phase',
      f.phaseId,
      content.learn.frontier.map((p) => p.id),
    );
    f.accessModels.forEach((v) =>
      reference(
        `frontierMappings › ${f.id}`,
        'access model',
        v,
        content.questions.find((q) => q.id === 'accessModel')?.options.map((o) => o.value) ?? [],
      ),
    );
  }
  for (const w of content.whatIfs) {
    answers(`whatIfs › ${w.id}`, w.org, 'org');
    answers(`whatIfs › ${w.id}`, w.answers, 'useCase');
  }
  answers('mapping neutralOrg', content.mappingConfig.neutralOrg, 'org');
  content.mappingConfig.licensingSourceIds.forEach((id) => citeSource('mapping licensing', id));
  for (const check of content.mappingConfig.readinessChecks) {
    condition(`mapping readiness › ${check.id}`, check.appliesWhen);
    condition(`mapping readiness › ${check.id}`, check.when);
    citeSource(`mapping readiness › ${check.id}`, check.sourceId);
  }
  content.site.mapping.hostingSourceIds.forEach((id) => citeSource('methodology hosting', id));
  return { errors, warnings };
}
