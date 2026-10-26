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
    z
      .strictObject({
        q: z.string().regex(/^[a-z][A-Za-z0-9]*$/, 'must be a camelCase question id'),
        equals: Text.optional(),
        in: z.array(Text).min(1).optional(),
        includes: Text.optional(),
        includesAny: z.array(Text).min(1).optional(),
        answered: z.boolean().optional(),
        unknown: z.boolean().optional(),
      })
      .refine(
        (condition) =>
          Object.entries(condition).filter(([key, value]) => key !== 'q' && value !== undefined)
            .length === 1,
        'use exactly one condition operator',
      ),
  ]),
);

// ---------- Sources, taxonomy ----------

export const AnswersSchema = z.record(z.string(), z.union([z.string(), z.array(Text), z.null()]));
export type Answers = z.infer<typeof AnswersSchema>;
const QuestionId = z.string().regex(/^[a-z][A-Za-z0-9]*$/);
export const QuestionSchema = z
  .strictObject({
    id: QuestionId,
    scope: z.enum(['org', 'useCase']),
    label: Text,
    type: z.enum(['single', 'multi', 'text', 'longtext', 'scale', 'date']),
    maxLength: z.int().positive().optional(),
    options: z
      .array(
        z.strictObject({
          value: Text,
          label: Text,
          range: z
            .strictObject({ min: z.int().nonnegative(), max: z.int().nonnegative().nullable() })
            .optional(),
        }),
      )
      .default([]),
    ifUnknown: Text,
  })
  .superRefine((question, ctx) => {
    const freeText = ['text', 'longtext', 'date'].includes(question.type);
    if (freeText ? question.options.length > 0 : question.options.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'choice questions need options; text and date questions cannot have options',
        path: ['options'],
      });
    }
    if (freeText && question.maxLength === undefined)
      ctx.addIssue({
        code: 'custom',
        message: 'text and date questions need maxLength',
        path: ['maxLength'],
      });
  });
export const DiagnosticSchema = z.strictObject({
  sections: z
    .array(
      z.strictObject({
        id: Id,
        title: Text,
        description: Text,
        scope: z.enum(['org', 'useCase']),
        questionIds: uniqueList(QuestionId),
      }),
    )
    .min(1),
  quickQuestionIds: uniqueList(QuestionId),
  consultantNotes: z.record(QuestionId, Text),
  visibility: z.array(z.strictObject({ questionId: QuestionId, when: ConditionSchema })),
});
const EditorialEvidence = {
  sourceIds: uniqueList(Id),
  evidence: z.enum(EVIDENCE),
  reviewStatus: z.enum(REVIEW_STATUSES),
};
export const RecommendationSchema = z.strictObject({
  capability: Id,
  level: z.enum(LEVELS),
  because: Text,
  detail: Text.optional(),
  evidence: z.enum(EVIDENCE),
  sourceIds: uniqueList(Id),
  wave: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});
export const RuleSchema = z
  .strictObject({
    id: Id,
    scope: z.enum(['org', 'useCase']),
    description: Text,
    when: ConditionSchema,
    recommend: z.array(RecommendationSchema),
    advisories: z.array(Id),
    reviewStatus: z.enum(REVIEW_STATUSES),
  })
  .refine((rule) => rule.recommend.length + rule.advisories.length > 0, 'rule needs an output');
export const AdvisorySchema = z.strictObject({
  id: Id,
  title: Text,
  body: Text,
  ...EditorialEvidence,
});
export const PatternSchema = z.strictObject({
  id: Id,
  title: Text,
  summary: maxWords(40),
  narrative: Text,
  answers: AnswersSchema,
  ...EditorialEvidence,
});
export const RiskSchema = z.strictObject({
  id: Id,
  title: Text,
  summary: maxWords(40),
  triggeredWhen: ConditionSchema,
  mitigatedBy: uniqueList(Id),
  ...EditorialEvidence,
});
export const SampleSchema = z.strictObject({
  id: Id,
  title: Text,
  patternId: Id,
  summary: maxWords(40),
  answers: AnswersSchema,
  ...EditorialEvidence,
});
export const GoldenScenarioSchema = z
  .strictObject({
    id: Id,
    patternId: Id,
    sampleId: Id.optional(),
    org: AnswersSchema,
    answers: AnswersSchema,
    mustInclude: uniqueList(Id),
    mustNotInclude: z.array(Id),
    reviewedBy: Text.nullable(),
    reviewedOn: IsoDate.nullable(),
  })
  .refine(
    (item) => (item.reviewedBy === null) === (item.reviewedOn === null),
    'reviewer and review date must be supplied together',
  );
export const IntegrationPathSchema = z.strictObject({
  id: Id,
  title: Text,
  when: ConditionSchema,
  checklist: uniqueList(Text),
  status: z.enum(['documented', 'verify']),
  ...EditorialEvidence,
});
export const FrontierMappingSchema = z.strictObject({
  id: Id,
  phaseId: Id,
  accessModels: uniqueList(Text),
  rationale: Text,
  ...EditorialEvidence,
});
export const WhatIfSchema = z.strictObject({
  id: Id,
  title: Text,
  org: AnswersSchema,
  answers: AnswersSchema,
  reviewStatus: z.enum(REVIEW_STATUSES),
});
export const MappingConfigSchema = z.strictObject({
  neutralOrg: AnswersSchema,
  readinessChecks: z.array(
    z.strictObject({
      id: Id,
      appliesWhen: ConditionSchema,
      when: ConditionSchema,
      gap: Text,
      evidence: z.enum(EVIDENCE),
      sourceId: Id,
    }),
  ),
  licensingNote: Text,
  licensingSourceIds: uniqueList(Id),
  // Kept empty until the full licensing source can be verified.
  licenseBasis: z.strictObject({
    delegated: Text.nullable(),
    own: Text.nullable(),
    mixed: Text.nullable(),
  }),
});

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

// Null text is deliberately unpublished until the source can be checked.
const LearningEvidence = {
  sourceId: Id,
  evidence: z.enum(EVIDENCE),
  reviewStatus: z.enum(REVIEW_STATUSES),
  lastVerified: IsoDate.nullable(),
};
export const LearningItemSchema = z
  .strictObject({
    id: Id,
    title: Text,
    summary: maxWords(40).nullable(),
    technical: Text.optional(),
    technicalSourceId: Id.optional(),
    capabilityIds: z.array(Id),
    ...LearningEvidence,
  })
  .refine((item) => item.summary === null || item.lastVerified !== null, {
    message: 'published learning text needs a verification date',
  });
export const GlossaryEntrySchema = z.strictObject({
  id: Id,
  term: Text,
  aliases: z.array(Text),
  definition: maxWords(40),
  ...LearningEvidence,
  lastVerified: IsoDate,
});
export const FaqSchema = z
  .strictObject({
    id: Id,
    myth: Text,
    fact: Text.nullable(),
    ...LearningEvidence,
  })
  .refine((item) => item.fact === null || item.lastVerified !== null, {
    message: 'published facts need a verification date',
  });
export const PersonaSchema = z.strictObject({
  id: Id,
  label: Text,
  need: maxWords(40),
  startLabel: Text,
  href: Text.refine(
    (value) =>
      /^\/(?:learn(?:#[a-z0-9-]+)?|capabilities(?:\?lens=(?:pillar|console|layer|lifecycle))?)$/.test(
        value,
      ),
    'must target an available learning or explorer route',
  ),
  reviewStatus: z.enum(REVIEW_STATUSES),
});
export const LearnSchema = z.strictObject({
  flow: z.array(LearningItemSchema).min(1),
  integration: z.array(LearningItemSchema).min(1),
  positioning: z.array(LearningItemSchema).min(1),
  frontier: z.array(LearningItemSchema).min(1),
});

const Template = Text; // may contain {placeholders}; validate.ts checks them against TEMPLATE_KEYS
const RouteCopy = z.strictObject({ title: Text, description: Text });

export const ReadoutCopySchema = z.strictObject({
  tableLabel: Template,
  open: Text,
  title: Template,
  draft: Text,
  current: Text,
  preparedFor: Text,
  summary: Text,
  takeaways: z.array(Template).length(3),
  foundational: Text,
  premium: Text,
  platform: Text,
  agent: Text,
  setupNote: Text,
  roadmap: Text,
  waves: z.strictObject({ 1: Text, 2: Text, 3: Text }),
  roadmapNote: Text,
  empty: Text,
  anatomy: Text,
  details: Text,
  edit: Text,
  print: Text,
  powerpoint: Text,
  exporting: Text,
  presentationNote: Text,
  notesDetail: Text,
  appendix: Text,
  discovery: Text,
  eligibility: Text,
  verifyNext: Text,
  riskControls: Text,
  foundations: Text,
  anatomyNote: Text,
  methodologyNote: Text,
  exhibits: z.strictObject({
    frontier: Text,
    anatomy: Text,
    risks: Text,
    capabilities: Text,
    decisions: Text,
    readiness: Text,
    operatingModel: Text,
    integration: Text,
    licensing: Text,
    roadmap: Text,
    whatIfs: Text,
  }),
  branding: z.strictObject({
    title: Text,
    choose: Text,
    alt: Text,
    remove: Text,
    note: Text,
    errors: z.strictObject({ size: Text, format: Text, dimensions: Text, read: Text }),
  }),
  markdown: Text,
  json: Text,
  copySummary: Text,
  copied: Text,
  exportError: Text,
  sharingNote: Text,
  backup: Text,
  import: Text,
  importNote: Text,
  importConfirm: Template,
  importSuccess: Text,
  importErrors: z.strictObject({ size: Text, json: Text, format: Text, read: Text }),
  cancelImport: Text,
  applyImport: Text,
  whatIfNote: Text,
  baseline: Text,
  canvas: Text,
  blankCanvas: Text,
  canvasNote: Text,
  canvasPrintNote: Text,
  answers: Text,
  sources: Text,
  canvasBoxes: z
    .array(
      z.strictObject({
        id: Id,
        title: Text,
        questionIds: z
          .array(QuestionId)
          .refine((ids) => new Set(ids).size === ids.length, 'must not contain duplicates'),
        prompt: Text,
      }),
    )
    .length(10),
});

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
    personasHeading: Text,
    personasNote: Text,
    questionsHeading: Text,
    questions: uniqueList(Text),
    frontierHeading: Text,
    frontierNote: Text,
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
    explorer: z.strictObject({
      search: Text,
      lens: Text,
      group: Text,
      all: Text,
      view: Text,
      lenses: z.strictObject({
        pillar: Text,
        console: Text,
        layer: Text,
        lifecycle: Text,
        risk: Text,
        pattern: Text,
      }),
      views: z.strictObject({ table: Text, cards: Text, matrix: Text }),
      results: Template,
      empty: Text,
      reset: Text,
      compare: Text,
      comparison: Text,
      comparisonHint: Template,
      clearComparison: Text,
      invalidLink: Text,
      applies: Text,
      notApplicable: Text,
    }),
    brief: z.strictObject({
      back: Text,
      summary: Text,
      withoutIt: Text,
      withIt: Text,
      where: Text,
      when: Text,
      owner: Text,
      setup: Text,
      availability: Text,
      questions: Text,
      discovery: Text,
      dependencies: Text,
      prerequisites: Text,
      conditionalNote: Text,
      sourceNotes: Text,
      docs: Text,
      verified: Text,
      correction: Text,
      assessmentPending: Text,
      evidence: z.strictObject({ stated: Text, inferred: Text, judgment: Text }),
    }),
  }),
  learn: z.strictObject({
    intro: Text,
    contents: Text,
    draftNote: Text,
    pending: Text,
    verified: Text,
    related: Text,
    sections: z.strictObject({
      concepts: Text,
      integration: Text,
      buildingBlocks: Text,
      glossary: Text,
      myths: Text,
      positioning: Text,
    }),
    flowNote: Text,
    flowTable: Text,
    flowColumns: z.strictObject({ step: Text, concept: Text, capabilities: Text }),
    previous: Text,
    next: Text,
    progress: Template,
    buildingBlocksNote: Text,
    mythLabel: Text,
    factLabel: Text,
    evidence: z.strictObject({ stated: Text, inferred: Text, judgment: Text }),
  }),
  diagnostic: z.strictObject({
    intro: Text,
    privacy: Text,
    organization: Text,
    newOrganization: Text,
    organizationName: Text,
    createOrganization: Text,
    organizationSaved: Text,
    sharedOrganization: Text,
    selectOrganization: Text,
    deleteOrganization: Text,
    organizationInUse: Text,
    noOrganization: Text,
    start: Text,
    startBlank: Text,
    starter: Text,
    blank: Text,
    mode: Text,
    modes: z.strictObject({ quick: Text, full: Text }),
    quickNote: Text,
    fullNote: Text,
    unknown: Text,
    why: Text,
    next: Text,
    previous: Text,
    sectionRail: Text,
    progress: Text,
    assessments: Text,
    empty: Text,
    resume: Text,
    duplicate: Text,
    rename: Text,
    delete: Text,
    assessmentName: Text,
    untitledAssessment: Text,
    untitledOrganization: Text,
    duplicateName: Text,
    cancel: Text,
    confirm: Text,
    deleteTitle: Text,
    deleteBody: Text,
    resetTitle: Text,
    resetBody: Text,
    save: Text,
    saved: Text,
    unsaved: Text,
    retry: Text,
    reload: Text,
    storageUnavailable: Text,
    storageQuota: Text,
    storageConflict: Text,
    storageInvalid: Text,
    recovery: Text,
    reset: Text,
    leaveTitle: Text,
    leaveBody: Text,
    leave: Text,
    stay: Text,
    incompatible: Text,
    clearIncompatible: Text,
    oldContent: Text,
    currentContent: Text,
    invalidStarter: Text,
    allAssessments: Text,
    back: Text,
    emerging: Text,
    emergingNote: Text,
    preview: Text,
    previewNote: Text,
    review: Text,
    noPreview: Text,
    knownAnswers: Text,
    notFound: Text,
    updated: Text,
    startFromPattern: Text,
    savedLocally: Text,
    renameTitle: Text,
  }),
  readout: ReadoutCopySchema,
  mapping: z.strictObject({
    intro: Text,
    neutralNote: Text,
    matrix: Text,
    patternCount: Text,
    levels: z.strictObject({ essential: Text, recommended: Text, consider: Text }),
    levelDescriptions: z.strictObject({ essential: Text, recommended: Text, consider: Text }),
    condition: z.strictObject({
      always: Text,
      all: Text,
      any: Text,
      not: Text,
      equals: Text,
      in: Text,
      includes: Text,
      includesAny: Text,
      answered: Text,
      unanswered: Text,
      unknown: Text,
      known: Text,
    }),
    inScope: Text,
    notInScope: Text,
    becomesRelevant: Text,
    noRule: Text,
    reasons: Text,
    origin: z.strictObject({ org: Text, useCase: Text }),
    answers: Text,
    unknownAnswer: Text,
    readiness: Text,
    readinessNote: Text,
    readinessStatuses: z.strictObject({ ready: Text, gap: Text, unknown: Text }),
    readinessPercent: Text,
    noChecks: Text,
    anatomy: Text,
    operatingModel: Text,
    agentDecisions: Text,
    risks: Text,
    riskNote: Text,
    mitigationsInScope: Text,
    mitigationsOutOfScope: Text,
    potentialRisks: Text,
    noRisks: Text,
    riskAssociations: Text,
    integration: Text,
    verify: Text,
    frontier: Text,
    frontierNote: Text,
    licensing: Text,
    licensingCounts: Text,
    expectedUsers: Text,
    intensity: Text,
    intensityNote: Text,
    gcc: Text,
    sovereign: Text,
    advisories: Text,
    openQuestions: Text,
    methodology: Text,
    rules: Text,
    assumptions: Text,
    pendingDiagnostic: Text,
    startAssessment: Text,
    methodologyNotes: uniqueList(Text),
    back: Text,
    typicalPatterns: Text,
    whenInScope: Text,
    why: Text,
    samples: Text,
    sampleNote: Text,
    golden: Text,
    pendingReview: Text,
    whatIfs: Text,
    added: Text,
    removed: Text,
    changed: Text,
    noChanges: Text,
    scenarioSource: Text,
    hostingSources: Text,
    hostingSourceIds: uniqueList(Id),
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
  personas: { file: 'personas.yaml', schema: z.array(PersonaSchema).min(1) },
  learn: { file: 'learn.yaml', schema: LearnSchema },
  buildingBlocks: { file: 'building-blocks.yaml', schema: z.array(LearningItemSchema).min(1) },
  glossary: { file: 'glossary.yaml', schema: z.array(GlossaryEntrySchema).min(1) },
  faq: { file: 'faq.yaml', schema: z.array(FaqSchema).min(1) },
  questions: { file: 'questions.yaml', schema: z.array(QuestionSchema).min(1) },
  diagnostic: { file: 'diagnostic.yaml', schema: DiagnosticSchema },
  rules: { file: 'rules.yaml', schema: z.array(RuleSchema).min(1) },
  advisories: { file: 'advisories.yaml', schema: z.array(AdvisorySchema).min(1) },
  patterns: { file: 'patterns.yaml', schema: z.array(PatternSchema).min(1) },
  risks: { file: 'risks.yaml', schema: z.array(RiskSchema).min(1) },
  samples: { file: 'samples.yaml', schema: z.array(SampleSchema).min(1) },
  goldenScenarios: { file: 'golden-scenarios.yaml', schema: z.array(GoldenScenarioSchema).min(1) },
  integrationPaths: {
    file: 'integration-paths.yaml',
    schema: z.array(IntegrationPathSchema).min(1),
  },
  frontierMappings: { file: 'frontier-phases.yaml', schema: z.array(FrontierMappingSchema).min(1) },
  whatIfs: { file: 'what-ifs.yaml', schema: z.array(WhatIfSchema).min(1) },
  mappingConfig: { file: 'mapping.yaml', schema: MappingConfigSchema },
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
export type LearningItem = z.infer<typeof LearningItemSchema>;
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;
export type Faq = z.infer<typeof FaqSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type Learn = z.infer<typeof LearnSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Diagnostic = z.infer<typeof DiagnosticSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type Advisory = z.infer<typeof AdvisorySchema>;
export type Pattern = z.infer<typeof PatternSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type Sample = z.infer<typeof SampleSchema>;
export type GoldenScenario = z.infer<typeof GoldenScenarioSchema>;
export type IntegrationPath = z.infer<typeof IntegrationPathSchema>;
export type FrontierMapping = z.infer<typeof FrontierMappingSchema>;
export type WhatIf = z.infer<typeof WhatIfSchema>;
export type MappingConfig = z.infer<typeof MappingConfigSchema>;

export interface Content {
  sources: Source[];
  pillars: PillarDef[];
  consoles: ConsoleDef[];
  controlPoints: ControlPointDef[];
  lifecycle: StageDef[];
  capabilities: Capability[];
  personas: Persona[];
  learn: Learn;
  buildingBlocks: LearningItem[];
  glossary: GlossaryEntry[];
  faq: Faq[];
  questions: Question[];
  diagnostic: Diagnostic;
  rules: Rule[];
  advisories: Advisory[];
  patterns: Pattern[];
  risks: Risk[];
  samples: Sample[];
  goldenScenarios: GoldenScenario[];
  integrationPaths: IntegrationPath[];
  frontierMappings: FrontierMapping[];
  whatIfs: WhatIf[];
  mappingConfig: MappingConfig;
  site: Site;
  changelog: ChangelogEntry[];
}

export interface ContentMeta {
  contentVersion: string;
  schemaVersion: 1;
}
