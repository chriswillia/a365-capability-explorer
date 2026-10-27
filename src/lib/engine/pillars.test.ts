import { describe, expect, it } from 'vitest';
import { licensingTier } from '../content/derive.ts';
import { content } from '../content/index.ts';
import { renderTemplate } from '../content/template.ts';
import { conditionQuestions } from './conditions.ts';
import { evaluateAssessment, patternAnswers } from './evaluate.ts';
import { peopleRows, pillarCoverage, pillarLabel, pillarRows, questionPillars } from './pillars.ts';

const pillarIds = [...content.pillars].sort((a, b) => a.order - b.order).map((p) => p.id);
const inScope = (patternId: string) =>
  evaluateAssessment(content, patternAnswers(content, patternId), 'test').inScope;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe('pillarRows', () => {
  it('orders the rows by requirement area and places every in-scope capability in exactly one row', () => {
    for (const pattern of content.patterns) {
      const items = inScope(pattern.id);
      const rows = pillarRows(content, items);
      expect(rows.map((row) => row.pillar.id)).toEqual(pillarIds);
      expect(rows.flatMap((row) => row.items.map((item) => item.capability.id)).sort()).toEqual(
        items.map((item) => item.capability.id).sort(),
      );
      for (const row of rows) {
        expect(row.items.every((item) => item.capability.pillar === row.pillar.id)).toBe(true);
        expect(sum(Object.values(row.levels))).toBe(row.items.length);
        expect(row.catalogTotal).toBe(
          content.capabilities.filter((c) => c.pillar === row.pillar.id).length,
        );
        expect(row.items.length).toBeLessThanOrEqual(row.catalogTotal);
      }
    }
  });

  it('counts premium and not-in-GCC capabilities from the catalog', () => {
    for (const pattern of content.patterns) {
      const items = inScope(pattern.id);
      const rows = pillarRows(content, items);
      expect(sum(rows.map((row) => row.premium))).toBe(
        items.filter((item) => licensingTier(item.capability) === 'premium').length,
      );
      expect(sum(rows.map((row) => row.notInGcc))).toBe(
        items.filter((item) => !item.capability.source.gccAvailable).length,
      );
    }
  });

  it('names each owner team once, in alphabetical order', () => {
    for (const row of pillarRows(content, inScope('ai-teammate'))) {
      expect(row.owners).toEqual(
        [...new Set(row.items.map((item) => item.ownerTeam))].sort((a, b) =>
          a.localeCompare(b, 'en'),
        ),
      );
    }
  });

  it('still reports the catalog size when nothing is in scope', () => {
    const rows = pillarRows(content, []);
    expect(rows).toHaveLength(content.pillars.length);
    for (const row of rows) {
      expect(row.items).toEqual([]);
      expect(row.levels).toEqual({ essential: 0, recommended: 0, consider: 0 });
      expect(row.owners).toEqual([]);
      expect(row.catalogTotal).toBeGreaterThan(0);
    }
  });
});

describe('questionPillars', () => {
  const informs = questionPillars(content);
  const pillarOf = new Map(content.capabilities.map((c) => [c.id, c.pillar]));

  it('maps each question in a rule to the requirement areas of the capabilities that rule recommends', () => {
    for (const rule of content.rules)
      for (const questionId of conditionQuestions(rule.when))
        for (const recommendation of rule.recommend)
          expect(informs.get(questionId)?.has(pillarOf.get(recommendation.capability)!)).toBe(true);
  });

  it('maps each question in a readiness check to the area of the capability it checks', () => {
    for (const capability of content.capabilities)
      for (const check of capability.prerequisites ?? [])
        for (const questionId of conditionQuestions(check.when))
          expect(informs.get(questionId)?.has(capability.pillar)).toBe(true);
  });

  it('never claims a question informs an area that no rule or readiness check connects it to', () => {
    for (const [questionId, pillars] of informs)
      for (const pillar of pillars) {
        const byRule = content.rules.some(
          (rule) =>
            conditionQuestions(rule.when).includes(questionId) &&
            rule.recommend.some((r) => pillarOf.get(r.capability) === pillar),
        );
        const byReadiness = content.capabilities.some(
          (capability) =>
            capability.pillar === pillar &&
            (capability.prerequisites ?? []).some((check) =>
              conditionQuestions(check.when).includes(questionId),
            ),
        );
        expect(byRule || byReadiness, `${questionId} → ${pillar}`).toBe(true);
      }
  });

  it('leaves labels and report details out, and informs every requirement area', () => {
    expect(informs.has('useCaseName')).toBe(false);
    expect(informs.has('preparedBy')).toBe(false);
    for (const pillar of content.pillars)
      expect([...informs.values()].some((pillars) => pillars.has(pillar.id))).toBe(true);
  });
});

describe('pillarCoverage', () => {
  const everyQuestion = new Set(content.questions.map((q) => q.id));
  const answers = patternAnswers(content, 'ai-teammate').useCase;

  it('reports nothing answered when nothing is known', () => {
    for (const row of pillarCoverage(content, {}, everyQuestion)) {
      expect(row.answered).toBe(0);
      expect(row.assumed).toBe(0);
      expect(row.total).toBe(row.questions.length);
      expect(row.total).toBeGreaterThan(0);
    }
  });

  it('counts only the visible questions and only the answers that are known', () => {
    const rows = pillarCoverage(content, { ...answers, autonomy: 'unknown' }, everyQuestion);
    for (const row of rows) {
      expect(row.answered).toBeLessThanOrEqual(row.total);
      expect(row.questions.every((q) => q.id !== 'autonomy' || row.answered < row.total)).toBe(
        true,
      );
    }
    const hidden = pillarCoverage(content, answers, new Set(['accessModel']));
    for (const row of hidden) expect(row.total).toBeLessThanOrEqual(1);
    expect(sum(hidden.map((row) => row.total))).toBeGreaterThan(0);
  });

  it('counts an assumed answer once, and only when the answer is known', () => {
    const visible = new Set(['accessModel', 'autonomy']);
    const rows = pillarCoverage(
      content,
      { accessModel: 'own-teammate' },
      visible,
      new Set(['accessModel', 'autonomy']),
    );
    for (const row of rows) {
      expect(row.assumed).toBeLessThanOrEqual(row.answered);
      expect(row.assumed).toBe(row.questions.filter((q) => q.id === 'accessModel').length);
    }
  });

  it('keeps the requirement areas in reading order', () => {
    expect(pillarCoverage(content, {}, everyQuestion).map((row) => row.pillar.id)).toEqual(
      pillarIds,
    );
  });
});

describe('peopleRows', () => {
  it('lists each owner team once with the product areas it works in and every capability it owns', () => {
    for (const pattern of content.patterns) {
      const items = inScope(pattern.id);
      const rows = peopleRows(content, items);
      const teams = rows.map((row) => row.team);
      expect(teams).toEqual([...new Set(teams)].sort((a, b) => a.localeCompare(b, 'en')));
      expect(rows.flatMap((row) => row.capabilities.map((c) => c.id)).sort()).toEqual(
        items.map((item) => item.capability.id).sort(),
      );
      for (const row of rows) {
        const owned = items.filter((item) => item.ownerTeam === row.team);
        expect(row.capabilities.map((c) => c.id)).toEqual(owned.map((item) => item.capability.id));
        expect(row.areas).toEqual(
          [
            ...new Set(
              owned.map(
                (item) =>
                  content.consoles.find((c) => c.id === item.capability.source.console)!
                    .displayName,
              ),
            ),
          ].sort((a, b) => a.localeCompare(b, 'en')),
        );
      }
    }
  });

  it('returns no teams when nothing is in scope', () => {
    expect(peopleRows(content, [])).toEqual([]);
  });
});

describe('pillarLabel', () => {
  it('combines the requirement and the short label from the content template', () => {
    for (const pillar of content.pillars) {
      expect(pillarLabel(content, pillar)).toBe(
        renderTemplate(content.site.capabilities.pillarName, {
          requirement: pillar.requirement,
          label: pillar.label,
        }),
      );
      expect(pillarLabel(content, pillar)).toContain(pillar.requirement);
    }
  });
});
