import { describe, expect, it } from 'vitest';
import { seededAssumptions, standingAssumptions } from './assumptions.ts';

describe('seededAssumptions', () => {
  it('marks every known scenario answer except the use case name', () => {
    expect(
      seededAssumptions({
        useCaseName: 'Fictional scenario',
        stage: 'pilot',
        channels: ['teams', 'outlook'],
        autonomy: 'approval-gated',
      }),
    ).toEqual(['stage', 'channels', 'autonomy']);
  });

  it('skips answers that are blank, unknown or empty', () => {
    expect(
      seededAssumptions({
        stage: 'unknown',
        autonomy: '  ',
        tools: [],
        channels: ['unknown'],
        businessOutcome: null,
        audience: ['employees'],
      }),
    ).toEqual(['audience']);
  });

  it('returns nothing for an empty scenario', () => {
    expect(seededAssumptions({})).toEqual([]);
  });
});

describe('standingAssumptions', () => {
  it('keeps the assumptions that have not been confirmed or edited', () => {
    expect(
      standingAssumptions({
        assumedQuestionIds: ['stage', 'autonomy'],
        answers: { stage: 'pilot', autonomy: 'approval-gated' },
      }),
    ).toEqual(['stage', 'autonomy']);
  });

  it('drops an assumption whose answer was later cleared or marked unknown', () => {
    expect(
      standingAssumptions({
        assumedQuestionIds: ['stage', 'autonomy', 'tools'],
        answers: { stage: 'unknown', autonomy: null },
      }),
    ).toEqual([]);
  });

  it('treats an assessment that was not started from a scenario as having no assumptions', () => {
    expect(standingAssumptions({ answers: { stage: 'pilot' } })).toEqual([]);
  });

  it('does not mark an answer that was never assumed', () => {
    expect(
      standingAssumptions({
        assumedQuestionIds: ['stage'],
        answers: { stage: 'pilot', autonomy: 'autonomous' },
      }),
    ).toEqual(['stage']);
  });
});
