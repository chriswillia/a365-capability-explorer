/*
 * The fixed lists the app and the content schemas share. This file has no imports, on purpose: the browser
 * bundle imports these lists directly, and importing them from schemas.ts would bring zod and every schema
 * into the first page load. schemas.ts re-exports everything here, so build scripts and tests can keep
 * importing from either place.
 */

// ---------- Enumerations ----------

export const PILLARS = ['observe', 'govern', 'secure'] as const;
export const LEVELS = ['essential', 'recommended', 'consider'] as const;
export const EVIDENCE = ['stated', 'inferred', 'judgment'] as const;
export const CONTROL_POINTS = [
  'registry',
  'identity',
  'tools',
  'data',
  'network',
  'endpoint',
  'oversight',
] as const;
export const STAGES = ['plan', 'build', 'deploy', 'operate', 'respond', 'retire'] as const;
export const CONSOLES = [
  'Microsoft 365 admin center',
  'Entra',
  'Purview',
  'Defender',
  'Intune',
  'N/A',
] as const;
export const SETUPS = ['platform', 'agent', 'both'] as const;
export const STATUSES = ['ga', 'preview', 'frontier-preview'] as const;
export const REVIEW_STATUSES = ['draft', 'reviewed'] as const;

export type PillarId = (typeof PILLARS)[number];
export type Level = (typeof LEVELS)[number];
export type Evidence = (typeof EVIDENCE)[number];
export type ControlPointId = (typeof CONTROL_POINTS)[number];
export type StageId = (typeof STAGES)[number];
export type ConsoleId = (typeof CONSOLES)[number];
export type Setup = (typeof SETUPS)[number];
export type Status = (typeof STATUSES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// Keys that content templates may use as {placeholders}. Every value is computed in metrics.ts.
export const METRIC_NUMBER_KEYS = [
  'capabilityCount',
  'foundationalCount',
  'premiumCount',
  'gccCount',
  'notInGccCount',
  'platformCount',
  'bothCount',
  'agentOnlyCount',
  'agentDecisionCount',
  'consoleCount',
  'controlPointCount',
  'coveredControlPointCount',
  'pillarCount',
  'observeCount',
  'governCount',
  'secureCount',
  'largestPillarCount',
] as const;
export const METRIC_TEXT_KEYS = [
  'largestPillarLabel',
  'lastVerified',
  'sourcesChecked',
  'contentVersion',
] as const;
// Placeholders filled in by a component rather than by metrics (for example an exhibit number).
export const LOCAL_TEMPLATE_KEYS = [
  'number',
  'label',
  'count',
  'n',
  'requirement',
  'organization',
  'total',
  'draft',
  'premium',
  'notInGcc',
  'answered',
  'assumed',
  'customer',
  'ready',
  'gap',
  'unknown',
  'date',
  'patterns',
] as const;
export const TEMPLATE_KEYS: readonly string[] = [
  ...METRIC_NUMBER_KEYS,
  ...METRIC_TEXT_KEYS,
  ...LOCAL_TEMPLATE_KEYS,
];

export type MetricNumberKey = (typeof METRIC_NUMBER_KEYS)[number];
export type MetricTextKey = (typeof METRIC_TEXT_KEYS)[number];

// ---------- Explorer and playbook lists ----------

export const EXPLORER_LENSES = ['layer', 'lifecycle', 'risk', 'pattern'] as const;

export const AUDIENCES = ['ai', 'security', 'joint'] as const;
export const ACCESS_PATTERNS = ['delegated', 'own', 'agent-account'] as const;
export const GATES = ['pilot', 'production', 'scale'] as const;

export type AudienceId = (typeof AUDIENCES)[number];
export type AccessPatternId = (typeof ACCESS_PATTERNS)[number];
export type GateId = (typeof GATES)[number];
