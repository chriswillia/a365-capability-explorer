import type { Content } from '../content/schemas.ts';
import { answerErrors } from '../engine/answers.ts';
import { evaluateAssessment, type AssessmentResult, type InScope } from '../engine/evaluate.ts';
import {
  displayName,
  type Assessment,
  type DiagnosticWorkspace,
} from '../state/diagnostic-model.ts';

export type Quadrant = keyof Content['site']['portfolio']['quadrants'];
export interface PortfolioCase {
  assessment: Assessment;
  name: string;
  number: number;
  result: AssessmentResult;
  value: number | null;
  userBand: number | null;
  quadrant: Quadrant | null;
}

export function planningQuadrant(
  value: number | null,
  intensity: number,
  cutoffs: Pick<Content['site']['portfolio'], 'valueCutoff' | 'intensityCutoff'>,
): Quadrant | null {
  if (value === null) return null;
  const higherValue = value >= cutoffs.valueCutoff;
  const higherIntensity = intensity >= cutoffs.intensityCutoff;
  return higherValue
    ? higherIntensity
      ? 'govern'
      : 'accelerate'
    : higherIntensity
      ? 'reconsider'
      : 'experiment';
}

/** Recompute one organization's selected assessments without mutating saved answers or versions. */
export function buildPortfolio(
  content: Content,
  workspace: DiagnosticWorkspace,
  contentVersion: string,
  organizationId: string,
  selectedIds: readonly string[],
) {
  const organization = workspace.organizations.find((item) => item.id === organizationId);
  if (!organization) throw new Error('Portfolio organization does not exist');
  const selected = new Set(selectedIds);
  const assessments = workspace.assessments.filter(
    (item) => item.organizationId === organizationId && selected.has(item.id),
  );
  if (selected.size !== selectedIds.length || assessments.length !== selected.size)
    throw new Error('Portfolio selection must contain distinct assessments from one organization');
  const orgErrors = answerErrors(content.questions, organization.answers, 'org');
  const cases: PortfolioCase[] = [];
  const blocked: { assessment: Assessment; name: string; errors: string[] }[] = [];
  const userOptions = content.questions.find((item) => item.id === 'expectedUsers')!.options;
  for (const assessment of assessments) {
    const name = displayName(
      assessment.answers,
      'useCaseName',
      content.site.diagnostic.untitledAssessment,
    );
    const errors = [
      ...orgErrors,
      ...answerErrors(content.questions, assessment.answers, 'useCase'),
    ];
    if (errors.length > 0) {
      blocked.push({ assessment, name, errors });
      continue;
    }
    const result = evaluateAssessment(
      content,
      { org: organization.answers, useCase: assessment.answers },
      contentVersion,
    );
    const rawValue = assessment.answers.businessValue;
    const value =
      typeof rawValue === 'string' && /^[1-5]$/.test(rawValue) ? Number(rawValue) : null;
    const band = userOptions.findIndex(
      (option) => option.value === assessment.answers.expectedUsers && option.range !== undefined,
    );
    cases.push({
      assessment,
      name,
      number: cases.length + 1,
      result,
      value,
      userBand: band === -1 ? null : band,
      quadrant: planningQuadrant(value, result.intensity.overall, content.site.portfolio),
    });
  }
  const capabilities = content.capabilities.flatMap((capability) => {
    const uses = cases.flatMap((item) => {
      const row = item.result.inScope.find((match) => match.capability.id === capability.id);
      return row ? [{ useCase: item, row }] : [];
    });
    return uses.length === 0 ? [] : [{ capability, uses }];
  });
  const foundations = capabilities.filter(
    ({ capability, uses }) => capability.setup !== 'agent' && uses.length >= 2,
  );
  const checks = new Map<
    string,
    {
      id: string;
      gap: string;
      ready: PortfolioCase[];
      gapCases: PortfolioCase[];
      unknown: PortfolioCase[];
    }
  >();
  for (const item of cases)
    for (const check of item.result.readiness.checks) {
      let group = checks.get(check.id);
      if (!group) {
        group = { id: check.id, gap: check.gap, ready: [], gapCases: [], unknown: [] };
        checks.set(check.id, group);
      }
      const status = check.status === 'gap' ? 'gapCases' : check.status;
      group[status].push(item);
    }
  return {
    organization,
    assessments,
    cases,
    blocked,
    capabilities,
    foundations,
    checks: [...checks.values()],
  };
}
export type Portfolio = ReturnType<typeof buildPortfolio>;
export type PortfolioCapability = Portfolio['capabilities'][number];
export const portfolioLevel = (row: PortfolioCapability, id: string): InScope['level'] | null =>
  row.uses.find((use) => use.useCase.assessment.id === id)?.row.level ?? null;
