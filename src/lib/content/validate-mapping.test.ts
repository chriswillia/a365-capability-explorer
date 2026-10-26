import { describe, expect, it } from 'vitest';
import { content } from './index.ts';
import { validateContent } from './validate.ts';

const errors = (edit: (data: typeof content) => void) => {
  const data = structuredClone(content);
  edit(data);
  return validateContent(data, {
    now: new Date('2026-10-25T00:00:00Z'),
    failOnOrphanedSources: true,
  }).errors.join('\n');
};

describe('mapping cross-reference validation', () => {
  it('validates diagnostic section coverage, scopes, consultant notes, quick ids and visibility', () => {
    const result = errors((d) => {
      d.diagnostic.sections.push(structuredClone(d.diagnostic.sections[0]!));
      d.diagnostic.sections[1]!.questionIds.push('cloudEnvironment');
      d.diagnostic.sections.find((s) => s.id === 'details')!.questionIds = [];
      delete d.diagnostic.consultantNotes.orgName;
      d.diagnostic.quickQuestionIds.push('retiredQuestion');
      d.diagnostic.visibility.push({
        questionId: 'retiredQuestion',
        when: { q: 'buildPlatform', equals: 'typo' },
      });
    });
    expect(result).toContain('duplicate section id');
    expect(result).toContain('wrong scope');
    expect(result).toContain('questions must belong to one section');
    expect(result).toContain('missing section');
    expect(result).toContain('missing consultant note');
    expect(result).toContain('unknown question "retiredQuestion"');
    expect(result).toContain('unknown option');
  });
  it('accepts real content and warns, rather than failing, on unsigned scenarios', () => {
    const result = validateContent(content, {
      now: new Date('2026-10-25T00:00:00Z'),
      failOnOrphanedSources: true,
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings.filter((w) => w.includes('unsigned'))).toHaveLength(
      content.goldenScenarios.length,
    );
  });
  it('checks duplicate ids, question options, scopes and operator compatibility', () => {
    expect(
      errors((d) => {
        d.patterns.push(structuredClone(d.patterns[0]!));
        d.rules[0]!.when = { q: 'missingQuestion', equals: 'yes' };
        d.rules[1]!.when = { q: 'stage', includes: 'bad-option' };
        d.rules.find((r) => r.id === 'large-estate')!.when = { q: 'stage', equals: 'pilot' };
      }),
    ).toMatch(
      /duplicate id.*\n.*unknown question.*\n.*incompatible operator.*\n.*unknown option.*\n.*organization rule references/s,
    );
    expect(
      errors((d) => {
        d.questions[0]!.options.push(structuredClone(d.questions[0]!.options[0]!));
      }),
    ).toContain('duplicate options');
  });
  it('checks every output, mitigation, source and advisory reference', () => {
    const result = errors((d) => {
      d.rules[0]!.recommend[0]!.capability = 'missing-capability';
      d.rules[0]!.recommend[0]!.sourceIds = ['missing-source'];
      d.rules[0]!.advisories = ['missing-advisory'];
      d.risks[0]!.mitigatedBy = ['another-missing-capability'];
      d.integrationPaths[0]!.sourceIds = ['other-missing-source'];
    });
    expect(result).toContain('unknown capability "missing-capability"');
    expect(result).toContain('unknown source "missing-source"');
    expect(result).toContain('unknown advisory');
    expect(result).toContain('unknown capability "another-missing-capability"');
    expect(result).toContain('unknown source "other-missing-source"');
  });
  it('requires rule and risk coverage for every catalog capability', () => {
    const result = errors((d) => {
      d.risks.forEach((r) => {
        r.mitigatedBy = r.mitigatedBy.filter((id) => id !== 'intune-device-compliance');
      });
      d.rules.forEach((r) => {
        r.recommend = r.recommend.filter((rec) => rec.capability !== 'intune-device-compliance');
      });
    });
    expect(result).toContain('intune-device-compliance: no risk mitigation association');
    expect(result).toContain('intune-device-compliance: no recommendation rule');
  });
  it('rejects invalid canonical answers, multi-select conflicts and scope leakage', () => {
    expect(
      errors((d) => {
        d.patterns[0]!.answers.tools = ['none', 'computer-use'];
      }),
    ).toContain('must be exclusive');
    expect(
      errors((d) => {
        d.patterns[0]!.answers.agentEstate = 'hundreds';
      }),
    ).toContain('belongs to org');
    expect(
      errors((d) => {
        d.mappingConfig.neutralOrg.stage = 'pilot';
      }),
    ).toContain('belongs to useCase');
    expect(
      errors((d) => {
        d.samples[0]!.answers.stage = 'typo';
      }),
    ).toContain('unknown option');
  });
  it('requires matching samples, noncontradictory expectations and golden coverage', () => {
    expect(
      errors((d) => {
        d.goldenScenarios[0]!.sampleId = 'askhr';
      }),
    ).toContain('sample does not match pattern');
    expect(
      errors((d) => {
        d.goldenScenarios[0]!.mustNotInclude = ['registry-inventory'];
      }),
    ).toContain('contradictory expectations');
    expect(
      errors((d) => {
        d.goldenScenarios = [];
      }),
    ).toContain('missing golden scenario');
    expect(
      errors((d) => {
        d.samples[0]!.patternId = 'missing';
      }),
    ).toContain('unknown pattern');
    expect(
      errors((d) => {
        d.frontierMappings[0]!.phaseId = 'missing';
      }),
    ).toContain('unknown phase');
  });
  it('checks prerequisite conditions, what-if patches, integration conditions and hosting citations', () => {
    expect(
      errors((d) => {
        d.capabilities.find((c) => c.prerequisites)!.prerequisites![0]!.when = {
          q: 'tools',
          equals: 'none',
        };
      }),
    ).toContain('incompatible operator');
    expect(
      errors((d) => {
        d.whatIfs[0]!.org.stage = 'production';
      }),
    ).toContain('belongs to useCase');
    expect(
      errors((d) => {
        d.integrationPaths[0]!.when = { q: 'buildPlatform', equals: 'typo' };
      }),
    ).toContain('unknown option');
    expect(
      errors((d) => {
        d.site.mapping.hostingSourceIds.push('unknown-source');
      }),
    ).toContain('unknown source');
  });
});
