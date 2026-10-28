import { describe, expect, it } from 'vitest';
import { countReadiness, describeReadiness, isAssessed } from './readiness.ts';

const copy = {
  readinessSummary: '{ready} confirmed · {gap} {gap?gap|gaps} · {unknown} to confirm',
  readinessNotAssessed: 'Not assessed yet',
};
const checks = (...statuses: ('ready' | 'gap' | 'unknown')[]) =>
  statuses.map((status) => ({ status }));

describe('countReadiness', () => {
  it('counts each status', () => {
    expect(countReadiness(checks('ready', 'gap', 'unknown', 'unknown', 'ready'))).toEqual({
      ready: 2,
      gap: 1,
      unknown: 2,
    });
  });

  it('counts nothing for no checks', () => {
    expect(countReadiness([])).toEqual({ ready: 0, gap: 0, unknown: 0 });
  });
});

describe('describeReadiness', () => {
  it('says not assessed, never 0%, when nothing has been answered', () => {
    expect(describeReadiness(countReadiness(checks('unknown', 'unknown')), copy)).toBe(
      'Not assessed yet',
    );
  });

  it('says not assessed when there are no checks at all', () => {
    expect(describeReadiness(countReadiness([]), copy)).toBe('Not assessed yet');
  });

  it('reports the three counts once any check is decided', () => {
    expect(describeReadiness(countReadiness(checks('ready', 'unknown', 'unknown')), copy)).toBe(
      '1 confirmed · 0 gaps · 2 to confirm',
    );
  });

  it('counts a gap as an answer and agrees the noun with one gap', () => {
    expect(describeReadiness(countReadiness(checks('gap', 'unknown')), copy)).toBe(
      '0 confirmed · 1 gap · 1 to confirm',
    );
  });
});

describe('isAssessed', () => {
  it('is false until a check is confirmed or found to be a gap', () => {
    expect(isAssessed({ ready: 0, gap: 0, unknown: 9 })).toBe(false);
    expect(isAssessed({ ready: 1, gap: 0, unknown: 0 })).toBe(true);
    expect(isAssessed({ ready: 0, gap: 1, unknown: 0 })).toBe(true);
  });
});
