/** The readout's numbered exhibits, in reading order. Exec and Technical share the order; Technical adds more. */
export const EXHIBIT_KEYS = [
  'pillars',
  'anatomy',
  'risks',
  'capabilities',
  'decisions',
  'people',
  'readiness',
  'operatingModel',
  'integration',
  'licensing',
  'openQuestions',
  'roadmap',
  'frontier',
  'whatIfs',
] as const;
export type ExhibitKey = (typeof EXHIBIT_KEYS)[number];

const TECHNICAL_ONLY: ReadonlySet<ExhibitKey> = new Set([
  'capabilities',
  'readiness',
  'operatingModel',
  'integration',
  'whatIfs',
]);

/** The exhibits a reader sees. Numbers are positions in this list, so each view is numbered 1, 2, 3… with no gaps. */
export const exhibitPlan = (technical: boolean): ExhibitKey[] =>
  EXHIBIT_KEYS.filter((key) => technical || !TECHNICAL_ONLY.has(key));

export const exhibitId = (key: ExhibitKey) => `exhibit-${key}`;
