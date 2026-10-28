import { z } from 'zod';
import {
  ACCESS_PATTERNS,
  AUDIENCES,
  CONSOLES,
  CONTROL_POINTS,
  EVIDENCE,
  EXPLORER_LENSES,
  GATES,
  LEVELS,
  LOCAL_TEMPLATE_KEYS,
  METRIC_NUMBER_KEYS,
  METRIC_TEXT_KEYS,
  PILLARS,
  REVIEW_STATUSES,
  SETUPS,
  STAGES,
  STATUSES,
  TEMPLATE_KEYS,
} from './constants.ts';

/*
 * Single definition of every content type. The build script (scripts/build-content.ts) validates /content
 * against these schemas, and the app imports the inferred types. Objects are strict, so a typo in a YAML
 * key fails the build instead of being ignored.
 *
 * The fixed lists (pillars, consoles, audiences and so on) live in constants.ts, which has no imports. They
 * are re-exported here. App code that runs in the browser imports them from constants.ts, so a page does
 * not load zod and every schema just to read a list.
 */

export {
  ACCESS_PATTERNS,
  AUDIENCES,
  CONSOLES,
  CONTROL_POINTS,
  EVIDENCE,
  EXPLORER_LENSES,
  GATES,
  LEVELS,
  LOCAL_TEMPLATE_KEYS,
  METRIC_NUMBER_KEYS,
  METRIC_TEXT_KEYS,
  PILLARS,
  REVIEW_STATUSES,
  SETUPS,
  STAGES,
  STATUSES,
  TEMPLATE_KEYS,
};
export type {
  AccessPatternId,
  AudienceId,
  ConsoleId,
  ControlPointId,
  Evidence,
  GateId,
  Level,
  MetricNumberKey,
  MetricTextKey,
  PillarId,
  ReviewStatus,
  Setup,
  StageId,
  Status,
} from './constants.ts';

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
  // Conversational wording for each question, so a seller can ask it aloud. Editorial; it changes no rule.
  askPrompts: z.record(QuestionId, Text),
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
  // The customer-facing requirement area this pillar answers (for example "Security"). Editorial.
  requirement: Text,
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
  'pitch',
  'licensing',
  'fit',
  'access',
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
  'conversation',
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
      /^\/(?:learn(?:#[a-z0-9-]+)?|conversation|pitch|licensing|fit|capabilities(?:\?[a-z]+=[A-Za-z0-9._%+-]+(?:&[a-z]+=[A-Za-z0-9._%+-]+)*)?)$/.test(
        value,
      ),
    'must target an available learning, conversation, playbook or explorer route',
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

// A filter the Capabilities explorer can apply. Group ids are checked against the content in validate.ts.
export const ExplorerFilterSchema = z
  .strictObject({
    pillar: z.enum(PILLARS).optional(),
    console: z.enum(CONSOLES).optional(),
    licensing: z.enum(['base', 'premium']).optional(),
    gcc: z.enum(['available', 'unavailable']).optional(),
    setup: z.enum(['platform', 'agent']).optional(),
    lens: z.enum(EXPLORER_LENSES).optional(),
    group: Id.optional(),
  })
  .refine(
    (filter) =>
      Object.values(filter).filter((value) => value !== undefined).length ===
        (filter.lens === undefined ? 1 : 2) &&
      (filter.lens === undefined) === (filter.group === undefined),
    'use exactly one filter, or a lens together with its group',
  );
export type ExplorerFilter = z.infer<typeof ExplorerFilterSchema>;

export const PortfolioCopySchema = z.strictObject({
  organization: Text,
  select: Text,
  selectAll: Text,
  clear: Text,
  empty: Text,
  selectionEmpty: Text,
  note: Text,
  current: Text,
  incompatible: Text,
  excluded: Text,
  selected: Text,
  evaluated: Text,
  foundationsCount: Text,
  gapsCount: Text,
  chart: Text,
  chartDescription: Text,
  chartNote: Text,
  bubbleNote: Text,
  unplotted: Text,
  quadrant: Text,
  quadrants: z.strictObject({
    accelerate: Text,
    govern: Text,
    experiment: Text,
    reconsider: Text,
  }),
  valueCutoff: z.int().min(2).max(5),
  intensityCutoff: z.int().min(1).max(99),
  table: Text,
  matrix: Text,
  matrixNote: Text,
  foundations: Text,
  foundationsNote: Text,
  benefits: Template,
  agentFollowup: Text,
  readiness: Text,
  readinessNote: Text,
  affected: Text,
  licensing: Text,
  licensingNote: Text,
  uniqueCapabilities: Text,
  export: Text,
  index: Text,
});

export const WorkshopSchema = z.strictObject({
  reviewStatus: z.enum(REVIEW_STATUSES),
  title: Text,
  introduction: Text,
  preparationTitle: Text,
  preparation: uniqueList(Text),
  agendaTitle: Text,
  duration: Template,
  minutes: Template,
  agenda: z
    .array(
      z.strictObject({
        id: Id,
        title: Text,
        minutes: z.int().positive(),
        instructions: uniqueList(Text),
        output: Text,
      }),
    )
    .min(1),
  outputLabel: Text,
  followupTitle: Text,
  followup: uniqueList(Text),
  patternsTitle: Text,
  capabilitiesTitle: Text,
  cardNote: Text,
  front: Text,
  back: Text,
  scope: Text,
  noRules: Text,
  printGuide: Text,
  printPatterns: Text,
  printCapabilities: Text,
  printChecklist: Text,
  printError: Text,
  guide: Text,
  checklistTitle: Text,
  checklistNote: Text,
  checklistPillar: Template,
  checklistColumns: z.strictObject({
    discuss: Text,
    capability: Text,
    productArea: Text,
    availability: Text,
    requirement: Text,
    owner: Text,
    priority: Text,
  }),
});

const ConversationLink = Text.regex(
  /^\/(?:diagnostic|workshop|learn|capabilities|patterns|portfolio|pitch|access|licensing|fit)(?:#[a-z0-9-]+)?$/,
  'must target a page of this site',
);
export const ConversationSchema = z.strictObject({
  reviewStatus: z.enum(REVIEW_STATUSES),
  title: Text,
  introduction: Text,
  stepsTitle: Text,
  steps: z
    .array(
      z.strictObject({
        id: Id,
        title: Text,
        instruction: Text,
        action: z.strictObject({ label: Text, to: ConversationLink }).optional(),
      }),
    )
    .min(1),
  requirementsTitle: Text,
  requirementsIntro: Text,
  jumpLabel: Text,
  coversLabel: Text,
  capabilitiesLabel: Text,
  questionsLabel: Template,
  peopleLabel: Text,
  flagsLabel: Text,
  flagsTemplate: Template,
  browse: Template,
  assumptionsTitle: Text,
  assumptionsNote: Template,
  assumptionsClear: Template,
  assumptionsLink: Text,
  nextTitle: Text,
  next: z.array(z.strictObject({ label: Text, to: ConversationLink })).min(1),
});

// ---------- Seller playbook: value story, licensing, requirements, access patterns, guardrails, stack fit ----------

export const REQUIREMENT_KINDS = [
  'license',
  'role',
  'service',
  'enrollment',
  'onboarding',
  'telemetry',
  'scope',
] as const;
// Where a requirement applies: for each user, the tenant as a whole, a device, an agent, or the data an agent uses.
export const REQUIREMENT_LEVELS = ['each-user', 'tenant', 'device', 'agent', 'data'] as const;
export const LICENSE_NEEDS = ['required', 'recommended', 'not-licensed', 'not-stated'] as const;
export const APPLICABILITY = ['applies', 'differs', 'not-stated'] as const;
export const FIT_ROUTES = ['native', 'sdk', 'registry-sync', 'endpoint', 'verify'] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];
export type LicenseNeed = (typeof LICENSE_NEEDS)[number];
export type Applicability = (typeof APPLICABILITY)[number];
export type FitRoute = (typeof FIT_ROUTES)[number];

// A statement a source makes, in our words. Each one names its sources and the date they were last read.
const Sourced = { ...EditorialEvidence, lastVerified: IsoDate };
const ByAudience = <T extends z.ZodType>(item: T) =>
  z.strictObject({ ai: item, security: item, joint: item });
// The values of the accessModel question (questions.yaml); validate.ts checks they still exist.
const AccessAnswer = z.enum(['delegated', 'own-teammate', 'own-background', 'mixed']);

export const ValueSchema = z.strictObject({
  reviewStatus: z.enum(REVIEW_STATUSES),
  intro: Text,
  notice: Text,
  jumpLabel: Text,
  audienceNote: Template,
  pitch: z.strictObject({
    heading: Text,
    intro: Text,
    beatsLabel: Text,
    askLabel: Text,
    othersLabel: Text,
    audiences: ByAudience(
      z.strictObject({
        label: Text,
        opening: maxWords(45),
        beats: z.array(maxWords(35)).min(3).max(5),
        ask: maxWords(35),
      }),
    ),
    ...EditorialEvidence,
  }),
  problem: z.strictObject({
    heading: Text,
    intro: Text,
    statements: z
      .array(z.strictObject({ id: Id, text: maxWords(40), caveat: Text.optional(), ...Sourced }))
      .min(3),
  }),
  gaps: z.strictObject({
    heading: Text,
    intro: Text,
    items: z.array(z.strictObject({ id: Id, text: maxWords(30), themeId: Id, ...Sourced })).min(1),
  }),
  themes: z.strictObject({
    heading: Text,
    intro: Text,
    angleLabel: Text,
    aiAngleLabel: Text,
    securityAngleLabel: Text,
    capabilitiesLabel: Text,
    ownersLabel: Text,
    items: z
      .array(
        z.strictObject({
          id: Id,
          title: Text,
          pillar: z.enum(PILLARS),
          outcome: maxWords(30),
          angle: z.strictObject({ ai: maxWords(30), security: maxWords(30) }),
          capabilityIds: uniqueList(Id),
          reviewStatus: z.enum(REVIEW_STATUSES),
        }),
      )
      .min(1),
  }),
  buyers: z.strictObject({
    heading: Text,
    intro: Text,
    asksLabel: Text,
    leadLabel: Text,
    themesLabel: Text,
    items: z
      .array(
        z.strictObject({
          id: Id,
          label: Text,
          asks: z.array(Text).min(2),
          lead: maxWords(40),
          themeIds: uniqueList(Id),
          // The Selling as choices for which this buyer's outcomes are pre-selected in the brief builder.
          defaultFor: z.array(z.enum(AUDIENCES)),
          ...EditorialEvidence,
        }),
      )
      .min(1),
  }),
  objections: z.strictObject({
    heading: Text,
    intro: Text,
    items: z
      .array(
        z.strictObject({ id: Id, objection: Text, answer: maxWords(70), ...EditorialEvidence }),
      )
      .min(1),
  }),
  proof: z.strictObject({
    heading: Text,
    intro: Text,
    kinds: z.strictObject({ customer: Text, partner: Text, research: Text }),
    items: z
      .array(
        z.strictObject({
          id: Id,
          kind: z.enum(['customer', 'partner', 'research']),
          who: Text,
          summary: maxWords(40),
          caveat: Text.optional(),
          ...Sourced,
        }),
      )
      .min(1),
  }),
  jointPlan: z.strictObject({
    heading: Text,
    intro: Text,
    columns: z.strictObject({ topic: Text, ai: Text, security: Text, together: Text }),
    rows: z
      .array(z.strictObject({ id: Id, topic: Text, ai: Text, security: Text, together: Text }))
      .min(3),
    reviewStatus: z.enum(REVIEW_STATUSES),
  }),
  proofOfValue: z.strictObject({
    heading: Text,
    intro: Text,
    steps: z.array(z.strictObject({ id: Id, title: Text, detail: Text })).min(3),
    measuresHeading: Text,
    measures: z.array(Text).min(3),
    note: Text,
    reviewStatus: z.enum(REVIEW_STATUSES),
  }),
  boundaries: z.strictObject({ heading: Text, items: z.array(Text).min(2) }),
  brief: z.strictObject({
    heading: Text,
    intro: Text,
    customerLabel: Text,
    customerHint: Text,
    concernsLegend: Text,
    emptyNote: Text,
    titleTemplate: Template,
    untitledTitle: Text,
    audienceLine: Template,
    capabilitiesHeading: Text,
    licensingLine: Text,
    nextHeading: Text,
    nextItems: z.array(Text).min(2),
    print: Text,
    copy: Text,
    copied: Text,
    footnote: Text,
  }),
});

export const LicensingSchema = z.strictObject({
  reviewStatus: z.enum(REVIEW_STATUSES),
  intro: Text,
  notice: Text,
  jumpLabel: Text,
  needs: z.strictObject({
    required: Text,
    recommended: Text,
    'not-licensed': Text,
    'not-stated': Text,
  }),
  who: z.strictObject({
    heading: Text,
    intro: Text,
    accessLabel: Text,
    anyAccess: Text,
    appliesToYou: Text,
    notApplicable: Text,
    populationHeading: Text,
    needHeading: Text,
    confirmLabel: Text,
    populations: z
      .array(
        z.strictObject({
          id: Id,
          label: Text,
          need: z.enum(LICENSE_NEEDS),
          // The accessModel answers this population depends on. Omitted when it applies to every agent.
          appliesTo: z.array(AccessAnswer).min(1).optional(),
          // The audience answers that bring this population into play, for example partners or customers.
          whenAudience: z.array(Text).min(1).optional(),
          statement: Text,
          confirm: Text.optional(),
          ...Sourced,
        }),
      )
      .min(1),
    principlesHeading: Text,
    principles: z.array(z.strictObject({ id: Id, text: maxWords(45), ...Sourced })).min(1),
  }),
  options: z.strictObject({
    heading: Text,
    intro: Text,
    items: uniqueList(Text),
    note: Text,
    ...Sourced,
  }),
  prerequisites: z.strictObject({
    heading: Text,
    intro: Text,
    segments: z
      .array(
        z.strictObject({
          id: Id,
          label: Text,
          requires: Text,
          // The values of the basePlan question that belong to this segment.
          basePlans: uniqueList(Text),
          ...Sourced,
        }),
      )
      .min(1),
    mixedHeading: Text,
    mixed: z.strictObject({ text: Text, ...Sourced }),
    // What the Microsoft Product Terms, the contractual source, require for an Agent 365 user license.
    productTerms: z.strictObject({
      heading: Text,
      intro: Text,
      plans: uniqueList(Text),
      availability: Text,
      ...Sourced,
    }),
    // Where public sources describe the same prerequisite differently. The Product Terms govern; both are shown.
    differs: z.strictObject({
      heading: Text,
      intro: Text,
      items: z
        .array(
          z.strictObject({
            id: Id,
            topic: Text,
            statements: z.array(z.strictObject({ sourceId: Id, text: Text })).min(2),
            advice: Text,
            ...Sourced,
          }),
        )
        .min(1),
    }),
    withoutHeading: Text,
    withoutIntro: Text,
    without: z
      .array(
        z.strictObject({
          id: Id,
          area: z.enum(CONSOLES),
          text: maxWords(45),
          capabilityIds: uniqueList(Id),
          ...Sourced,
        }),
      )
      .min(1),
    contracts: z.strictObject({ text: Text, ...Sourced }),
  }),
  tiers: z.strictObject({
    heading: Text,
    intro: Text,
    foundationalLabel: Text,
    premiumLabel: Text,
    foundational: uniqueList(Text),
    premium: z.array(z.strictObject({ group: Text, items: uniqueList(Text) })).min(1),
    differsHeading: Text,
    differsIntro: Text,
    note: Text,
    ...Sourced,
  }),
  sizing: z.strictObject({
    heading: Text,
    intro: Text,
    reports: z
      .array(z.strictObject({ id: Id, name: Text, where: Text, shows: Text, ...Sourced }))
      .min(1),
    note: Text,
  }),
  regulated: z.strictObject({
    heading: Text,
    intro: Text,
    items: z.array(z.strictObject({ id: Id, text: maxWords(55), ...Sourced })).min(1),
  }),
  other: z.strictObject({
    heading: Text,
    items: z.array(z.strictObject({ id: Id, text: maxWords(55), ...Sourced })).min(1),
  }),
  // Public resources for getting an Agent 365 deployment done.
  help: z.strictObject({
    heading: Text,
    intro: Text,
    items: z.array(z.strictObject({ id: Id, text: maxWords(80), ...Sourced })).min(1),
  }),
  handoff: z.strictObject({
    heading: Text,
    intro: Text,
    questions: uniqueList(Text),
    copy: Text,
    copied: Text,
    titleTemplate: Template,
    accessLine: Template,
  }),
  requirementsPanel: z.strictObject({
    heading: Text,
    intro: Text,
    kinds: z.strictObject({
      license: Text,
      role: Text,
      service: Text,
      enrollment: Text,
      onboarding: Text,
      telemetry: Text,
      scope: Text,
    }),
    levels: z.strictObject({
      'each-user': Text,
      tenant: Text,
      device: Text,
      agent: Text,
      data: Text,
    }),
    levelLabel: Text,
    askLabel: Text,
    status: z.strictObject({ ready: Text, gap: Text, unknown: Text }),
    noneStated: Text,
    assessmentLabel: Text,
    noAssessment: Text,
  }),
});

export const RequirementSetSchema = z.strictObject({
  // Capability ids, or the reserved word "all" on its own for what every premium capability needs.
  capabilityIds: uniqueList(Id),
  items: z
    .array(
      z.strictObject({
        id: Id,
        kind: z.enum(REQUIREMENT_KINDS),
        text: maxWords(45),
        // True, false or unknown from the customer's answers. Without it the item is shown as "Confirm".
        readyWhen: ConditionSchema.optional(),
        // Set only when the source states a preview or enrollment status.
        status: z.enum(STATUSES).optional(),
        // Where it applies. Shown beside the requirement so a seller can say whether it is per user, per device or tenant-wide.
        appliesTo: z.enum(REQUIREMENT_LEVELS).optional(),
        // The question to put to the customer while the answer is unknown. Keeps a gap from being stated as a fact.
        askPrompt: maxWords(30).optional(),
        ...Sourced,
      }),
    )
    .min(1),
});

export const AccessPatternsSchema = z.strictObject({
  reviewStatus: z.enum(REVIEW_STATUSES),
  intro: Text,
  notice: Text,
  termsNote: Text,
  patternsHeading: Text,
  termsLabel: Text,
  licenseLabel: Text,
  questionLabel: Text,
  jumpLabel: Text,
  assessmentLabel: Text,
  noAssessment: Text,
  thisAgent: Template,
  thisAgentUnknown: Text,
  viewNoAssessment: Text,
  openLicensing: Text,
  // Short names for the accessModel answers, for chips and card labels.
  answerLabels: z.strictObject({
    delegated: Text,
    'own-teammate': Text,
    'own-background': Text,
    mixed: Text,
  }),
  patterns: z
    .array(
      z.strictObject({
        id: z.enum(ACCESS_PATTERNS),
        label: Text,
        terms: uniqueList(Text),
        plain: maxWords(35),
        // The accessModel answers that fall under this pattern.
        answers: uniqueList(AccessAnswer),
        // Licensing population ids (licensing.yaml) that apply when an agent uses this pattern.
        licensingIds: z.array(Id),
        ...Sourced,
      }),
    )
    .length(3),
  viewHeading: Text,
  viewIntro: Text,
  columns: z.strictObject({
    capability: Text,
    delegated: Text,
    own: Text,
    agentAccount: Text,
    note: Text,
  }),
  applicability: z.strictObject({ applies: Text, differs: Text, 'not-stated': Text }),
  statedHeading: Text,
  unsplitHeading: Text,
  unsplit: Text,
  tensionHeading: Text,
  tension: z.strictObject({ text: Text, ...Sourced }),
  changeHeading: Text,
  changeIntro: Template,
  changeOnly: Template,
  changeBoth: Text,
  changeNone: Text,
  changeAlso: Template,
  currentBadge: Text,
  statusHeading: Text,
  statusNames: z.strictObject({ ga: Text, preview: Text, 'frontier-preview': Text }),
  statuses: z
    .array(
      z.strictObject({
        id: Id,
        label: Text,
        patternId: z.enum(ACCESS_PATTERNS),
        status: z.enum(STATUSES),
        ...Sourced,
      }),
    )
    .min(1),
  capabilities: z
    .array(
      z.strictObject({
        capabilityId: Id,
        delegated: z.enum(APPLICABILITY),
        own: z.enum(APPLICABILITY),
        agentAccount: z.enum(APPLICABILITY),
        note: maxWords(50),
        ...Sourced,
      }),
    )
    .min(1),
});

export const GuardrailsSchema = z.strictObject({
  reviewStatus: z.enum(REVIEW_STATUSES),
  heading: Text,
  intro: Text,
  notice: Text,
  statusLabels: z.strictObject({ ready: Text, gap: Text, unknown: Text, maybe: Text }),
  summary: Template,
  actionLabel: Text,
  capabilitiesLabel: Text,
  empty: Text,
  gates: z
    .array(z.strictObject({ id: z.enum(GATES), title: Text, summary: maxWords(35) }))
    .length(3),
  items: z
    .array(
      z.strictObject({
        id: Id,
        gate: z.enum(GATES),
        title: Text,
        why: maxWords(35),
        action: maxWords(35),
        capabilityIds: z.array(Id),
        // Whether the guardrail matters for this agent. Unknown shows it as "Check whether this applies".
        appliesWhen: ConditionSchema,
        // Whether the answers show it is already in place. Without it the status is "Confirm".
        doneWhen: ConditionSchema.optional(),
        ...EditorialEvidence,
      }),
    )
    .min(6),
});

export const FitSchema = z.strictObject({
  reviewStatus: z.enum(REVIEW_STATUSES),
  intro: Text,
  notice: Text,
  jumpLabel: Text,
  statements: z.strictObject({
    heading: Text,
    intro: Text,
    items: z.array(z.strictObject({ id: Id, text: maxWords(50), ...Sourced })).min(2),
  }),
  platforms: z.strictObject({
    heading: Text,
    intro: Text,
    legend: Text,
    emptyNote: Text,
    routeLabels: z.strictObject({
      native: Text,
      sdk: Text,
      'registry-sync': Text,
      endpoint: Text,
      verify: Text,
    }),
    columns: z.strictObject({ platform: Text, route: Text, needs: Text, status: Text }),
    items: z
      .array(
        z.strictObject({
          id: Id,
          label: Text,
          route: z.enum(FIT_ROUTES),
          // The values of the buildPlatform question (questions.yaml) this entry covers.
          buildPlatforms: uniqueList(Text),
          summary: maxWords(45),
          needs: uniqueList(Text),
          status: z.enum(STATUSES).optional(),
          statusNote: Text.optional(),
          ...Sourced,
        }),
      )
      .min(1),
  }),
  stack: z.strictObject({
    heading: Text,
    intro: Text,
    legend: Text,
    emptyNote: Text,
    columns: z.strictObject({ product: Text, adds: Text, stays: Text, capabilities: Text }),
    items: z
      .array(
        z.strictObject({
          id: Id,
          console: z.enum(CONSOLES),
          label: Text,
          adds: maxWords(45),
          stays: maxWords(45),
          ...Sourced,
        }),
      )
      .min(1),
  }),
  netNew: z.strictObject({
    heading: Text,
    intro: Text,
    capabilityIds: uniqueList(Id),
    ...EditorialEvidence,
  }),
  boundaries: z.strictObject({ heading: Text, items: z.array(Text).min(1) }),
});

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
  both: Text,
  setupNote: Text,
  roadmap: Text,
  waves: z.strictObject({ 1: Text, 2: Text, 3: Text }),
  roadmapNote: Text,
  empty: Text,
  anatomy: Text,
  details: Text,
  edit: Text,
  moreShare: Text,
  addLogo: Text,
  editDetails: Text,
  contents: Text,
  assumedMark: Text,
  assumedTakeaway: Template,
  peopleNote: Text,
  peopleColumns: z.strictObject({ team: Text, areas: Text, capabilities: Text }),
  openQuestionsNote: Text,
  print: Text,
  powerpoint: Text,
  exporting: Text,
  presentationNote: Text,
  notesDetail: Text,
  // What to say on each readout slide. The detail behind the slide is added from the readout itself.
  slideNotesDetail: Text,
  slideNotes: z.strictObject({
    title: Text,
    pillars: Text,
    summary: Text,
    anatomy: Text,
    riskControls: Text,
    guardrails: Text,
    roadmap: Text,
    licensing: Text,
  }),
  appendix: Text,
  discovery: Text,
  eligibility: Text,
  verifyNext: Text,
  riskControls: Text,
  foundations: Text,
  anatomyNote: Text,
  methodologyNote: Text,
  accessNote: Text,
  guardrailsNote: Text,
  licenseWho: Text,
  licenseNeeds: Text,
  licenseOpen: Text,
  accessOpen: Text,
  exhibits: z.strictObject({
    pillars: Text,
    access: Text,
    frontier: Text,
    anatomy: Text,
    risks: Text,
    guardrails: Text,
    capabilities: Text,
    decisions: Text,
    people: Text,
    readiness: Text,
    operatingModel: Text,
    integration: Text,
    licensing: Text,
    openQuestions: Text,
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
  exportTooLarge: Text,
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
    mainNavLabel: Text,
    scrollHint: Text,
    homeLinkLabel: Text,
    depth: z.strictObject({
      groupLabel: Text,
      label: Text,
      hint: Text,
      executive: Text,
      technical: Text,
    }),
    nav: z.strictObject({
      overview: Text,
      pitch: Text,
      map: Text,
      licensing: Text,
      library: Text,
      fit: Text,
      access: Text,
      capabilities: Text,
      patterns: Text,
      learn: Text,
      portfolio: Text,
      workshop: Text,
      methodology: Text,
    }),
    library: z.strictObject({ exploreHeading: Text, packHeading: Text }),
    audience: z.strictObject({
      groupLabel: Text,
      label: Text,
      hint: Text,
      ai: Text,
      security: Text,
      joint: Text,
    }),
    footer: z.strictObject({
      privacy: Text,
      reportIssue: Text,
      emailFeedback: Text,
      sourceCode: Text,
      officialSources: Text,
      contentVersion: Text,
      // "Content checked against Microsoft sources on {sourcesChecked}." Replaces a site-wide banner.
      stamp: Template,
    }),
    loading: Text,
    customer: z.strictObject({
      label: Text,
      useCases: Text,
      empty: Text,
      edit: Text,
      readout: Text,
      canvas: Text,
      licensing: Text,
      compare: Text,
      switch: Text,
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
      verified: Template,
      preview: Text,
      frontierPreview: Text,
      sourcesDiffer: Text,
      accessDiffers: Text,
      accessStated: Template,
      accessUnsplit: Text,
    }),
    setup: z.strictObject({ platform: Text, agent: Text, both: Text }),
    exhibit: z.strictObject({ eyebrow: Template, sourcePrefix: Text }),
  }),
  routes: z.record(z.enum(ROUTE_KEYS), RouteCopy),
  overview: z.strictObject({
    heroEyebrow: Text,
    heroLede: Text,
    ctaPrimary: Text,
    ctaSecondary: Text,
    // The jobs a seller does before and after a customer call, one tile each.
    jobs: z.strictObject({
      heading: Text,
      intro: Text,
      tiles: z
        .array(
          z.strictObject({
            id: Id,
            question: Text,
            title: Text,
            body: Text,
            cta: Text,
            to: Text.regex(/^\/(?:pitch|diagnostic|licensing|deploy)$/, 'must target a job page'),
          }),
        )
        .min(3),
      libraryNote: Text,
    }),
    recent: z.strictObject({
      heading: Text,
      useCases: Template,
      readout: Text,
      licensing: Text,
      edit: Text,
      start: Text,
    }),
  }),
  capabilities: z.strictObject({
    intro: Text,
    draftNote: Text,
    // The catalog at a glance: the numbers and exhibits that used to open the home page.
    glance: z.strictObject({
      heading: Text,
      technicalHint: Text,
      kpis: z
        .array(
          z.strictObject({
            id: Id,
            valueKey: z.enum(METRIC_NUMBER_KEYS),
            label: Text,
            // Where the tile leads: an explorer URL that shows exactly what the number counts.
            href: Text.regex(/^\/capabilities(?:\?.+)?$/),
            noteTemplate: Template.optional(),
            noteHref: Text.regex(/^\/capabilities(?:\?.+)?$/).optional(),
          }),
        )
        .min(1),
      exhibits: z.strictObject({
        glance: z.strictObject({ label: Text, titleTemplate: Template, sourceNote: Template }),
        pillars: z.strictObject({
          label: Text,
          titleTemplate: Template,
          countLabel: Template,
          requirementLabel: Template,
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
    tableCaption: Template,
    scrollRegionLabel: Text,
    columns: z.strictObject({
      capability: Text,
      pillar: Text,
      console: Text,
      layer: Text,
      setup: Text,
      licensing: Text,
      availability: Text,
      gcc: Text,
      wave: Text,
    }),
    waveLabel: Template,
    pillarName: Template,
    officialWording: Text,
    dependencyPrefix: Text,
    sourcesDifferNote: Text,
    shortcuts: z
      .array(
        z.strictObject({
          id: Id,
          terms: uniqueList(Text),
          filter: ExplorerFilterSchema,
        }),
      )
      .min(1),
    explorer: z.strictObject({
      search: Text,
      pillarFilter: Text,
      allPillars: Text,
      pillarChip: Template,
      productArea: Text,
      licensing: Text,
      gcc: Text,
      setup: Text,
      anyOption: Text,
      licensingOptions: z.strictObject({ base: Text, premium: Text }),
      gccOptions: z.strictObject({ available: Text, unavailable: Text }),
      setupOptions: z.strictObject({ platform: Text, agent: Text }),
      groupBy: Text,
      groupByOptions: z.strictObject({ pillar: Text, console: Text, none: Text }),
      more: Text,
      moreActive: Template,
      lens: Text,
      noLens: Text,
      group: Text,
      all: Text,
      view: Text,
      lenses: z.strictObject({
        layer: Text,
        lifecycle: Text,
        risk: Text,
        pattern: Text,
      }),
      views: z.strictObject({ table: Text, cards: Text, matrix: Text }),
      results: Template,
      groupCount: Template,
      draftSummary: Template,
      empty: Text,
      emptyGuidance: Text,
      shortcutIntro: Text,
      shortcutLabel: Template,
      reset: Text,
      compare: Text,
      comparison: Text,
      comparisonHint: Template,
      compareBar: Template,
      showComparison: Text,
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
      needs: Text,
      needsIntro: Text,
      needsPremium: Text,
      needsLink: Text,
      access: Text,
      accessIntro: Text,
      accessUnsplit: Text,
      accessLink: Text,
      mapCta: Text,
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
      roles: Text,
      frontier: Text,
    }),
    rolesNote: Text,
    frontierNote: Text,
    // Where to go after reading: the two jobs that follow learning.
    nextHeading: Text,
    next: z
      .array(z.strictObject({ label: Text, to: Text.regex(/^\/(?:diagnostic|licensing)$/) }))
      .min(2),
    flowNote: Text,
    flowTable: Text,
    flowColumns: z.strictObject({ step: Text, concept: Text, capabilities: Text }),
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
    newCustomerOption: Text,
    manageCustomers: Text,
    organizationSaved: Text,
    sharedOrganization: Text,
    selectOrganization: Text,
    deleteOrganization: Text,
    organizationInUse: Text,
    noOrganization: Text,
    start: Text,
    startHeading: Text,
    startPrivacy: Text,
    startBlank: Text,
    starter: Text,
    blank: Text,
    mode: Text,
    modes: z.strictObject({ quick: Text, full: Text }),
    modeOptions: z.strictObject({ quick: Template, full: Template }),
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
    more: Text,
    backup: Text,
    answeredStatus: Template,
    assumedStatus: Template,
    assumedBadge: Text,
    confirmAnswer: Text,
    askLabel: Text,
    reviewNote: Text,
    reviewLinksHeading: Text,
    licensingLink: Text,
    accessLink: Text,
    accessHelp: Text,
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
    notFound: Text,
    updated: Text,
    startFromPattern: Text,
    savedLocally: Text,
    renameTitle: Text,
  }),
  readout: ReadoutCopySchema,
  portfolio: PortfolioCopySchema,
  presentation: z.strictObject({ enter: Text, exit: Text, note: Text }),
  mapping: z.strictObject({
    intro: Text,
    neutralNote: Text,
    matrix: Text,
    patternCount: Text,
    draftSummary: Template,
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
    licenseBasisConfirm: Text,
    gccCommercial: Text,
    gccNoGaps: Text,
    readiness: Text,
    readinessNote: Text,
    readinessStatuses: z.strictObject({ ready: Text, gap: Text, unknown: Text }),
    readinessLabel: Text,
    readinessSummary: Template,
    readinessNotAssessed: Text,
    noChecks: Text,
    anatomy: Text,
    pillars: Text,
    pillarsNote: Text,
    pillarCount: Template,
    pillarFlags: Template,
    pillarOwners: Text,
    pillarNone: Text,
    anatomyBy: Text,
    anatomyByOptions: z.strictObject({ pillar: Text, layer: Text }),
    coverage: Text,
    coverageRow: Template,
    coverageAssumed: Template,
    informs: Template,
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
    quickTitle: Text,
    quick: z.array(z.strictObject({ question: Text, answer: Text })).min(1),
    levelsTitle: Text,
    engineTitle: Text,
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
  workshop: { file: 'workshop.yaml', schema: WorkshopSchema },
  conversation: { file: 'conversation.yaml', schema: ConversationSchema },
  value: { file: 'value.yaml', schema: ValueSchema },
  licensing: { file: 'licensing.yaml', schema: LicensingSchema },
  requirements: { file: 'requirements.yaml', schema: z.array(RequirementSetSchema).min(1) },
  accessPatterns: { file: 'access-patterns.yaml', schema: AccessPatternsSchema },
  guardrails: { file: 'guardrails.yaml', schema: GuardrailsSchema },
  fit: { file: 'fit.yaml', schema: FitSchema },
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
export type Workshop = z.infer<typeof WorkshopSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type Value = z.infer<typeof ValueSchema>;
export type Licensing = z.infer<typeof LicensingSchema>;
export type RequirementSet = z.infer<typeof RequirementSetSchema>;
export type AccessPatterns = z.infer<typeof AccessPatternsSchema>;
export type Guardrails = z.infer<typeof GuardrailsSchema>;
export type Fit = z.infer<typeof FitSchema>;

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
  workshop: Workshop;
  conversation: Conversation;
  value: Value;
  licensing: Licensing;
  requirements: RequirementSet[];
  accessPatterns: AccessPatterns;
  guardrails: Guardrails;
  fit: Fit;
  site: Site;
  changelog: ChangelogEntry[];
}

export interface ContentMeta {
  contentVersion: string;
  schemaVersion: 1;
}
