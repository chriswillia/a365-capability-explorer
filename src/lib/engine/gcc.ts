/**
 * What to say about GCC for one assessment. A Commercial customer is not affected, so the answer is "not
 * applicable" rather than "unknown"; only a missing cloud answer is unknown.
 */
export interface GccFacts {
  sovereignVerification: boolean;
  /** The cloud answer, or null while it is missing or unknown. */
  cloudEnvironment: string | null;
  gccGaps: { capability: { shortName: string } }[];
}

export interface GccCopy {
  sovereign: string;
  unknownAnswer: string;
  gccCommercial: string;
  gccNoGaps: string;
}

export function describeGcc(facts: GccFacts, copy: GccCopy): string {
  if (facts.sovereignVerification) return copy.sovereign;
  if (facts.cloudEnvironment === null) return copy.unknownAnswer;
  if (facts.cloudEnvironment === 'commercial') return copy.gccCommercial;
  return facts.gccGaps.map((row) => row.capability.shortName).join('; ') || copy.gccNoGaps;
}
