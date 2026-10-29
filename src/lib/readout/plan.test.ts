import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { EXHIBIT_KEYS, READOUT_PARTS, exhibitId, exhibitPlan, readoutParts } from './plan.ts';

const technicalOnly = ['capabilities', 'readiness', 'operatingModel', 'integration', 'whatIfs'];

describe('readout exhibit plan', () => {
  it('has a title in the content for every exhibit and no title without an exhibit', () => {
    expect([...EXHIBIT_KEYS].sort()).toEqual(Object.keys(content.site.readout.exhibits).sort());
  });

  it('starts every view with the requirement areas, then how the agent acts, the layers and the risks', () => {
    for (const technical of [false, true])
      expect(exhibitPlan(technical).slice(0, 5)).toEqual([
        'pillars',
        'access',
        'anatomy',
        'risks',
        'guardrails',
      ]);
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

describe('readout parts', () => {
  it('has a label in the content for every part and no label without a part', () => {
    expect(READOUT_PARTS.map((part) => part.id).sort()).toEqual(
      Object.keys(content.site.readout.views).sort(),
    );
  });

  it('holds every exhibit once, in plan order, so the numbers read in sequence from part to part', () => {
    expect(READOUT_PARTS.flatMap((part) => part.exhibits)).toEqual(EXHIBIT_KEYS);
  });

  it('offers every part in the Technical view, and in the Executive view only the parts that have an exhibit to show', () => {
    expect(readoutParts(true)).toEqual(READOUT_PARTS);
    const plan = exhibitPlan(false);
    const executive = readoutParts(false);
    expect(executive.map((part) => part.id)).toEqual(['summary', 'controls', 'golive', 'next']);
    for (const part of executive)
      expect(
        part.exhibits.some((key) => plan.includes(key)),
        part.id,
      ).toBe(true);
  });

  it('names each section a link can point at once, apart from the exhibits', () => {
    const named = READOUT_PARTS.flatMap((part) => part.anchors);
    expect(new Set(named).size).toBe(named.length);
    for (const anchor of named) expect(EXHIBIT_KEYS.map(exhibitId)).not.toContain(anchor);
  });
});
