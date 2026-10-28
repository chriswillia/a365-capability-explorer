import { describe, expect, it } from 'vitest';
import { describeGcc, type GccCopy, type GccFacts } from './gcc.ts';

const copy: GccCopy = {
  sovereign: 'Verify sovereign cloud availability',
  unknownAnswer: 'To confirm',
  gccCommercial: 'Not applicable (Commercial)',
  gccNoGaps: 'None in scope is unavailable in GCC',
};
const facts = (overrides: Partial<GccFacts>): GccFacts => ({
  sovereignVerification: false,
  cloudEnvironment: 'commercial',
  gccGaps: [],
  ...overrides,
});

describe('describeGcc', () => {
  it('says not applicable for a Commercial customer, never unknown', () => {
    expect(describeGcc(facts({}), copy)).toBe('Not applicable (Commercial)');
  });

  it('says to confirm only while the cloud answer is missing', () => {
    expect(describeGcc(facts({ cloudEnvironment: null }), copy)).toBe('To confirm');
  });

  it('names the in-scope capabilities that are unavailable in GCC', () => {
    expect(
      describeGcc(
        facts({
          cloudEnvironment: 'gcc',
          gccGaps: [{ capability: { shortName: 'One' } }, { capability: { shortName: 'Two' } }],
        }),
        copy,
      ),
    ).toBe('One; Two');
  });

  it('says so when a GCC customer has no unavailable capability in scope', () => {
    expect(describeGcc(facts({ cloudEnvironment: 'gcc' }), copy)).toBe(
      'None in scope is unavailable in GCC',
    );
  });

  it('asks for verification in other sovereign clouds, whatever else is known', () => {
    expect(
      describeGcc(facts({ sovereignVerification: true, cloudEnvironment: 'gcc-high-dod' }), copy),
    ).toBe('Verify sovereign cloud availability');
  });
});
