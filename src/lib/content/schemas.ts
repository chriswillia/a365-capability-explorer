import { z } from 'zod';

/*
 * Single definition of every content type. The build script (scripts/build-content.ts) validates /content
 * against these schemas, and the app imports the inferred types. Objects are strict, so a typo in a YAML
 * key fails the build instead of being ignored.
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
export const METRIC_TEXT_KEYS = ['largestPillarLabel', 'lastVerified', 'contentVersion'] as const;
// Placeholders filled in by a component rather than by metrics (for example an exhibit number).
export const LOCAL_TEMPLATE_KEYS = ['number', 'label', 'count', 'n'] as const;
export const TEMPLATE_KEYS: readonly string[] = [
  ...METRIC_NUMBER_KEYS,
  ...METRIC_TEXT_KEYS,
  ...LOCAL_TEMPLATE_KEYS,
];

export type MetricNumberKey = (typeof METRIC_NUMBER_KEYS)[number];
export type MetricTextKey = (typeof METRIC_TEXT_KEYS)[number];

// ---------- Building blocks ----------

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const Id = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'must be kebab-case (lowercase letters, digits and hyphens)',
  );
const Text = z.string().trim().min(1, 'must not be empty');
const HttpsUrl = z.url().refine((url) => url.startsWith('https://'), 'must be an https URL');
const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'use the format YYYY-MM-DD')
  .refine(isRealDate, 'is not a real calendar date');

const maxWords = (limit: number) =>
  Text.refine((value) => countWords(value) <= limit, `must be ${limit} words or fewer`);

const uniqueList = <T extends z.ZodType>(item: T) =>
  z
    .array(item)
    .min(1, 'needs at least one entry')
    .refine((items) => new Set(items).size === items.length, 'must not contain duplicates');

// ---------- Conditions (brief section 6.4) ----------

export type Condition =
  | { always: true }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | {
      q: string;
      equals?: string;
      in?: string[];
      includes?: string;
      includesAny?: string[];
      answered?: boolean;
      unknown?: boolean;
    };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ always: z.literal(true) }),
    z.strictObject({ all: z.array(ConditionSchema).min(1) }),
    z.strictObject({ any: z.array(ConditionSchema).min(1) }),
    z.strictObject({ not: ConditionSchema }),
    z.strictObject({
      q: z.string().regex(/^[a-z][A-Za-z0-9]*$/, 'must be a camelCase question id'),
      equals: Text.optional(),
      in: z.array(Text).min(1).optional(),
      includes: Text.optional(),
      includesAny: z.array(Text).min(1).optional(),
      answered: z.boolean().optional(),
      unknown: z.boolean().optional(),
    }),
  ]),
);

// ---------- Sources, taxonomy ----------

export const SourceSchema = z.strictObject({
  id: Id,
  title: Text,
  url: HttpsUrl,
  publisher: Text,
  // Null means "not verified yet"; add a TODO(verify) comment next to it in the YAML.
  lastVerified: IsoDate.nullable(),
  notes: Text.optional(),
});

export const ConsoleSchema = z.strictObject({
  id: z.enum(CONSOLES),
  slug: Id,
  order: z.int().positive(),
  displayName: Text,
  shortName: Text,
  ownerTeam: Text,
});

export const PillarSchema = z.strictObject({
  id: z.enum(PILLARS),
  order: z.int().positive(),
  label: Text,
  definition: maxWords(25),
  sourceId: Id,
  reviewStatus: z.enum(REVIEW_STATUSES),
});

export const ControlPointSchema = z.strictObject({
  id: z.enum(CONTROL_POINTS),
  order: z.int().positive(),
  layer: Text,
  shortName: Text,
  governs: Text,
});

export const StageSchema = z.strictObject({
  id: z.enum(STAGES),
  order: z.int().positive(),
  label: Text,
});

// ---------- Capabilities (brief section 4.5) ----------

export const CapabilitySchema = z.strictObject({
  id: Id,
  shortName: Text,
  source: z.strictObject({
    sourceId: z.literal('sd-a365'),
    featureText: Text, // verbatim from the service description
    console: z.enum(CONSOLES),
    includedWithBasePlans: z.boolean(),
    availableWithE7G7OrA365: z.boolean(),
    gccAvailable: z.boolean(),
    lastVerified: IsoDate,
  }),
  pillar: z.enum(PILLARS),
  defaultWave: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  controlPoints: uniqueList(z.enum(CONTROL_POINTS)), // the first entry is the primary layer
  setup: z.enum(SETUPS),
  lifecycleStages: uniqueList(z.enum(STAGES)),
  ownerTeam: Text.optional(),
  summary: maxWords(40).optional(),
  executiveValue: maxWords(30).optional(),
  withoutIt: maxWords(30).optional(),
  withIt: maxWords(30).optional(),
  questionsItAnswers: z.array(Text).min(1).optional(),
  discoveryQuestions: z.array(Text).min(1).optional(),
  prerequisites: z
    .array(
      z.strictObject({
        when: ConditionSchema,
        gap: Text,
        evidence: z.enum(EVIDENCE),
        sourceId: Id.optional(),
      }),
    )
    .min(1)
    .optional(),
  dependencies: z
    .array(z.strictObject({ note: Text, sourceId: Id }))
    .min(1)
    .optional(),
  sourceNotes: z
    .array(
      z.strictObject({
        sourceId: Id,
        note: Text,
        // Marks a statement that differs from the service description (drives "Sources differ, verify").
        differs: z.boolean().optional(),
      }),
    )
    .min(1)
    .optional(),
  docs: z
    .array(z.strictObject({ title: Text, url: HttpsUrl }))
    .min(1)
    .optional(),
  status: z.enum(STATUSES).optional(),
  reviewStatus: z.enum(REVIEW_STATUSES),
  tags: z.array(Text).min(1).optional(),
});

// ---------- Site copy (brief section 5.7) ----------

export const ROUTE_KEYS = [
  'overview',
  'capabilities',
  'capability',
  'patterns',
  'pattern',
  'learn',
  'diagnostic',
  'assessment',
  'readout',
  'canvas',
  'portfolio',
  'workshop',
  'methodology',
  'whatsNew',
  'contentHealth',
  'privacy',
  'notFound',
] as const;
export type RouteKey = (typeof ROUTE_KEYS)[number];

const Template = Text; // may contain {placeholders}; validate.ts checks them against TEMPLATE_KEYS
const RouteCopy = z.strictObject({ title: Text, description: Text });

export const SiteSchema = z.strictObject({
  productName: Text,
  tagline: Text,
  description: Text,
  indexable: z.boolean(),
  repoUrl: HttpsUrl,
  feedbackEmail: z.email().nullable(),
  disclaimer: Text,
  independenceNotice: Text,
  footerSourceIds: z.array(Id).min(1),
  ui: z.strictObject({
    skipToContent: Text,
    previewBanner: Text,
    mainNavLabel: Text,
    homeLinkLabel: Text,
    depth: z.strictObject({ groupLabel: Text, executive: Text, technical: Text }),
    nav: z.strictObject({
      overview: Text,
      capabilities: Text,
      patterns: Text,
      learn: Text,
      diagnostic: Text,
      portfolio: Text,
      workshop: Text,
      methodology: Text,
    }),
    footer: z.strictObject({
      privacy: Text,
      reportIssue: Text,
      sourceCode: Text,
      officialSources: Text,
      contentVersion: Text,
    }),
    comingSoon: z.strictObject({ status: Text, back: Text }),
    notFound: z.strictObject({ body: Text, back: Text }),
    badges: z.strictObject({
      foundational: Text,
      premium: Text,
      gccAvailable: Text,
      gccUnavailable: Text,
      draft: Text,
      reviewed: Text,
      preview: Text,
      frontierPreview: Text,
      sourcesDiffer: Text,
    }),
    setup: z.strictObject({ platform: Text, agent: Text, both: Text }),
    exhibit: z.strictObject({ eyebrow: Template, sourcePrefix: Text }),
  }),
  routes: z.record(z.enum(ROUTE_KEYS), RouteCopy),
  overview: z.strictObject({
    heroEyebrow: Text,
    heroLede: Text,
    ctaExplore: Text,
    technicalHint: Text,
    kpis: z
      .array(
        z.strictObject({
          id: Id,
          valueKey: z.enum(METRIC_NUMBER_KEYS),
          label: Text,
          noteTemplate: Template.optional(),
        }),
      )
      .min(1),
    exhibits: z.strictObject({
      glance: z.strictObject({ label: Text, titleTemplate: Template, sourceNote: Template }),
      pillars: z.strictObject({
        label: Text,
        titleTemplate: Template,
        countLabel: Template,
        sourceNote: Template,
      }),
      consoles: z.strictObject({
        label: Text,
        titleTemplate: Template,
        sourceNote: Template,
        columns: z.strictObject({
          console: Text,
          ownerTeam: Text,
          capabilities: Text,
          gcc: Text,
        }),
      }),
      layers: z.strictObject({
        label: Text,
        titleTemplate: Template,
        sourceNote: Template,
        columns: z.strictObject({ layer: Text, governs: Text, capabilities: Text }),
      }),
    }),
    insights: z.strictObject({ platformFoundation: Text, platformDetail: Template }),
  }),
  capabilities: z.strictObject({
    intro: Text,
    draftNote: Text,
    tableCaption: Template,
    scrollRegionLabel: Text,
    columns: z.strictObject({
      capability: Text,
      pillar: Text,
      console: Text,
      layer: Text,
      setup: Text,
      licensing: Text,
      gcc: Text,
      wave: Text,
    }),
    waveLabel: Template,
    officialWording: Text,
    dependencyPrefix: Text,
    sourcesDifferNote: Text,
  }),
  privacy: z.strictObject({
    statement: Text,
    storedHeading: Text,
    storedIntro: Text,
    storedColumns: z.strictObject({ what: Text, where: Text, why: Text }),
    stored: z.array(z.strictObject({ what: Text, where: Text, why: Text })).min(1),
    selfHostedHeading: Text,
    selfHosted: Text,
    futureNote: Text,
  }),
});

// ---------- Changelog (content/changelog.md) ----------

export const ChangelogEntrySchema = z.strictObject({
  date: IsoDate,
  title: Text,
  // Capability ids, or the reserved word "all" for a change that touches the whole catalog.
  affects: z.array(Id).min(1),
  body: z.string(),
});

// ---------- File map and aggregate types ----------

export const CONTENT_FILES = {
  sources: { file: 'sources.yaml', schema: z.array(SourceSchema).min(1) },
  pillars: { file: 'pillars.yaml', schema: z.array(PillarSchema).min(1) },
  consoles: { file: 'consoles.yaml', schema: z.array(ConsoleSchema).min(1) },
  controlPoints: { file: 'control-points.yaml', schema: z.array(ControlPointSchema).min(1) },
  lifecycle: { file: 'lifecycle.yaml', schema: z.array(StageSchema).min(1) },
  capabilities: { file: 'capabilities.yaml', schema: z.array(CapabilitySchema).min(1) },
  site: { file: 'site.yaml', schema: SiteSchema },
} as const;

export type Source = z.infer<typeof SourceSchema>;
export type ConsoleDef = z.infer<typeof ConsoleSchema>;
export type PillarDef = z.infer<typeof PillarSchema>;
export type ControlPointDef = z.infer<typeof ControlPointSchema>;
export type StageDef = z.infer<typeof StageSchema>;
export type Capability = z.infer<typeof CapabilitySchema>;
export type Site = z.infer<typeof SiteSchema>;
export type ChangelogEntry = z.infer<typeof ChangelogEntrySchema>;

export interface Content {
  sources: Source[];
  pillars: PillarDef[];
  consoles: ConsoleDef[];
  controlPoints: ControlPointDef[];
  lifecycle: StageDef[];
  capabilities: Capability[];
  site: Site;
  changelog: ChangelogEntry[];
}

export interface ContentMeta {
  contentVersion: string;
  schemaVersion: 1;
}
