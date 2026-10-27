import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { EXHIBIT_KEYS, exhibitId, exhibitPlan } from './plan.ts';

const technicalOnly = ['capabilities', 'readiness', 'operatingModel', 'integration', 'whatIfs'];

describe('readout exhibit plan', () => {
  it('has a title in the content for every exhibit and no title without an exhibit', () => {
    expect([...EXHIBIT_KEYS].sort()).toEqual(Object.keys(content.site.readout.exhibits).sort());
  });

  it('starts every view with the requirement areas, then the layers and the risks', () => {
    for (const technical of [false, true])
      expect(exhibitPlan(technical).slice(0, 3)).toEqual(['pillars', 'anatomy', 'risks']);
  });

  it('leaves the technical exhibits out of the executive view and keeps the shared order', () => {
    const executive = exhibitPlan(false);
    const technical = exhibitPlan(true);
    expect(technical).toEqual(EXHIBIT_KEYS);
    expect(executive.filter((key) => technicalOnly.includes(key))).toEqual([]);
    expect(executive).toEqual(technical.filter((key) => !technicalOnly.includes(key)));
  });

  it('gives each exhibit one stable anchor', () => {
    const ids = EXHIBIT_KEYS.map(exhibitId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('exhibit-pillars');
  });
});
