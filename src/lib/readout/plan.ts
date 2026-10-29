/** The readout's numbered exhibits, in reading order. Exec and Technical share the order; Technical adds more. */
export const EXHIBIT_KEYS = [
  'pillars',
  'access',
  'anatomy',
  'risks',
  'guardrails',
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

export type ReadoutPartId = 'summary' | 'controls' | 'golive' | 'detail' | 'next' | 'appendix';

export interface ReadoutPart {
  id: ReadoutPartId;
  /** Only the Technical view has this part. */
  technical: boolean;
  /** The exhibits it holds. */
  exhibits: readonly ExhibitKey[];
  /** Other sections a link can point at inside it, and prefixes for the panels made from data. */
  anchors: readonly string[];
  prefixes: readonly string[];
}

/**
 * The parts the readout is read in, one on screen at a time. Each holds a run of exhibits, and together they run in
 * plan order, so the exhibit numbers still read 1, 2, 3… as a reader steps through. Every part prints.
 */
export const READOUT_PARTS: readonly ReadoutPart[] = [
  {
    id: 'summary',
    technical: false,
    exhibits: ['pillars', 'access'],
    anchors: ['readout-summary'],
    prefixes: [],
  },
  { id: 'controls', technical: false, exhibits: ['anatomy', 'risks'], anchors: [], prefixes: [] },
  {
    id: 'golive',
    technical: false,
    exhibits: ['guardrails', 'capabilities', 'decisions', 'people'],
    anchors: ['exhibit-capabilities-table'],
    prefixes: [],
  },
  {
    id: 'detail',
    technical: true,
    exhibits: ['readiness', 'operatingModel', 'integration'],
    anchors: [],
    prefixes: [],
  },
  {
    id: 'next',
    technical: false,
    exhibits: ['licensing', 'openQuestions', 'roadmap', 'frontier', 'whatIfs'],
    anchors: [],
    prefixes: [],
  },
  {
    id: 'appendix',
    technical: true,
    exhibits: [],
    anchors: ['readout-appendix'],
    prefixes: ['appendix-'],
  },
];

/** The parts a reader sees. */
export const readoutParts = (technical: boolean): ReadoutPart[] =>
  READOUT_PARTS.filter((part) => technical || !part.technical);
