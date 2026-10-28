import { describe, expect, it } from 'vitest';
import {
  MAX_COUNT,
  calculateSeats,
  parseCount,
  type PlanFamily,
  type SeatInputs,
} from './seats.ts';

const families: PlanFamily[] = [
  { id: 'e7', standing: 'included' },
  { id: 'e5', standing: 'qualifies' },
  { id: 'bp', standing: 'qualifies' },
  { id: 'e3', standing: 'does-not-qualify' },
  { id: 'other', standing: 'unknown' },
];
const blank: SeatInputs = {
  delegating: null,
  owners: null,
  overlap: null,
  everyone: null,
  seats: {},
  includedEstimate: null,
  qualifyingEstimate: null,
};
const run = (changes: Partial<SeatInputs>) => calculateSeats({ ...blank, ...changes }, families);

describe('parseCount', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['abc', null],
    ['-3', null],
    ['1e3', null],
    ['0x10', null],
    ['0', 0],
    ['12', 12],
    [' 7 ', 7],
    ['1,250', 1250],
    ['3.9', 3],
    ['99999999999', MAX_COUNT],
  ])('reads %j as %j', (text, expected) => {
    expect(parseCount(text)).toBe(expected);
  });
});

describe('people who must be licensed (delegating + owners - overlap)', () => {
  it.each([
    { name: 'nothing entered', d: null, s: null, o: null, required: null, reduced: false },
    { name: 'zeros', d: 0, s: 0, o: null, required: 0, reduced: false },
    { name: 'delegating only', d: 100, s: null, o: null, required: 100, reduced: false },
    { name: 'owners only', d: null, s: 20, o: null, required: 20, reduced: false },
    { name: 'two groups that overlap', d: 100, s: 10, o: 4, required: 106, reduced: false },
    { name: 'every owner also delegates', d: 100, s: 10, o: 10, required: 100, reduced: false },
    { name: 'overlap above the owners', d: 50, s: 5, o: 9, required: 50, reduced: true },
    { name: 'overlap above the delegating users', d: 3, s: 10, o: 7, required: 10, reduced: true },
    { name: 'overlap with no delegating users', d: 0, s: 10, o: 5, required: 10, reduced: true },
  ])('$name', ({ d, s, o, required, reduced }) => {
    const result = run({ delegating: d, owners: s, overlap: o });
    expect(result.required).toBe(required);
    expect(result.overlapReduced).toBe(reduced);
  });
});

describe('recommended coverage (the larger of required and everyone)', () => {
  it.each([
    { name: 'everyone not entered', d: 100, s: 10, o: 4, u: null, expected: null },
    { name: 'everyone above required', d: 100, s: 10, o: 4, u: 200, expected: 200 },
    { name: 'everyone below required', d: 100, s: 10, o: 4, u: 50, expected: 106 },
    { name: 'only everyone entered', d: null, s: null, o: null, u: 40, expected: 40 },
    { name: 'everyone equal to required', d: 10, s: 0, o: null, u: 10, expected: 10 },
  ])('$name', ({ d, s, o, u, expected }) => {
    expect(run({ delegating: d, owners: s, overlap: o, everyone: u }).recommended).toBe(expected);
  });
});

describe('what the customer already holds', () => {
  it('counts only plans that qualify, and plans that already include Agent 365', () => {
    const result = run({
      delegating: 100,
      seats: { e7: 30, e5: 50, bp: 5, e3: 400, other: 900 },
    });
    expect(result).toMatchObject({
      includedSeats: 30,
      eligibleSeats: 55,
      included: 30,
      qualifying: 55,
      needsPlan: 15,
      toAdd: 70,
    });
  });

  it('needs a prerequisite for the people the qualifying seats do not cover', () => {
    const result = run({ delegating: 100, seats: { e5: 40 } });
    expect(result).toMatchObject({ included: 0, qualifying: 40, needsPlan: 60, toAdd: 100 });
  });

  it('needs a prerequisite for everyone when no seats are entered', () => {
    const result = run({ delegating: 25 });
    expect(result).toMatchObject({ included: 0, qualifying: 0, needsPlan: 25, toAdd: 25 });
  });

  it('adds nothing when the seats on a plan that includes Agent 365 cover everyone', () => {
    const result = run({ delegating: 10, seats: { e7: 30, e5: 20 } });
    expect(result).toMatchObject({ included: 10, qualifying: 0, needsPlan: 0, toAdd: 0 });
  });

  it('gives no figures for the seats until the people are counted', () => {
    const result = run({ seats: { e7: 30, e5: 20 } });
    expect(result).toMatchObject({
      required: null,
      included: null,
      qualifying: null,
      needsPlan: null,
      toAdd: null,
      includedSeats: 30,
      eligibleSeats: 20,
    });
  });
});

describe('the seller can correct an estimate', () => {
  const base = { delegating: 100, seats: { e7: 30, e5: 50, bp: 5 } };

  it('uses the seller estimate when it is within what the seats allow', () => {
    const result = run({ ...base, includedEstimate: 5, qualifyingEstimate: 10 });
    expect(result).toMatchObject({
      included: 5,
      includedIsEstimate: true,
      includedReduced: false,
      qualifying: 10,
      qualifyingIsEstimate: true,
      qualifyingReduced: false,
      needsPlan: 85,
    });
  });

  it('lowers an estimate that is more than the seats or the people allow, and says so', () => {
    const result = run({ ...base, includedEstimate: 500, qualifyingEstimate: 500 });
    expect(result).toMatchObject({
      included: 30,
      includedReduced: true,
      qualifying: 55,
      qualifyingReduced: true,
      needsPlan: 15,
    });
  });

  it('starts from the calculated value while the estimate is blank', () => {
    const result = run(base);
    expect(result).toMatchObject({ includedIsEstimate: false, qualifyingIsEstimate: false });
  });
});

describe('invariants', () => {
  const counts = [null, 0, 1, 7, 50, 1000];
  it('the three groups always add up to the people who must be licensed', () => {
    for (const d of counts)
      for (const s of counts)
        for (const o of counts)
          for (const e7 of counts)
            for (const e5 of counts)
              for (const est of counts) {
                const result = run({
                  delegating: d,
                  owners: s,
                  overlap: o,
                  seats: { e7, e5 },
                  includedEstimate: est,
                  qualifyingEstimate: est,
                });
                if (result.required === null) continue;
                expect(result.included! + result.qualifying! + result.needsPlan!).toBe(
                  result.required,
                );
                expect(result.needsPlan!).toBeGreaterThanOrEqual(0);
                expect(result.required).toBeLessThanOrEqual((d ?? 0) + (s ?? 0));
              }
  });
});
