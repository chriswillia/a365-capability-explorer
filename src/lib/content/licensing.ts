import { knownAnswer } from '../engine/answers.ts';
import type { Content, Licensing } from './schemas.ts';
import { renderTemplate } from './template.ts';

type Population = Licensing['who']['populations'][number];

/** True or false when the answers decide it, null while an answer is missing. */
export type Relevance = boolean | null;

export interface PopulationView {
  population: Population;
  relevant: Relevance;
}

const NEED_ORDER: Population['need'][] = ['required', 'recommended', 'not-stated', 'not-licensed'];

/**
 * The people Microsoft says to license, for how the agent acts and who uses it. Unknown answers never hide a
 * population: relevance is null, so the page shows it and says it depends on an answer still to be given.
 * That holds for an answer recorded as "unknown" as much as for one that is missing.
 */
export function populationViews(
  data: Content,
  input: { access: string | null; audience: string[] | null },
): PopulationView[] {
  const access = input.access !== null && knownAnswer(input.access) ? input.access : null;
  const audience = input.audience !== null && knownAnswer(input.audience) ? input.audience : null;
  const views = data.licensing.who.populations.map((population): PopulationView => {
    const checks: Relevance[] = [];
    if (population.appliesTo !== undefined)
      checks.push(
        access === null ? null : population.appliesTo.some((answer) => answer === access),
      );
    if (population.whenAudience !== undefined)
      checks.push(
        audience === null
          ? null
          : population.whenAudience.some((value) => audience.includes(value)),
      );
    const relevant = checks.includes(false) ? false : checks.includes(null) ? null : true;
    return { population, relevant };
  });
  // Array.sort is stable, so the order written in licensing.yaml holds within each need.
  return views.sort(
    (a, b) => NEED_ORDER.indexOf(a.population.need) - NEED_ORDER.indexOf(b.population.need),
  );
}

/** The prerequisite segment that covers the customer's Microsoft 365 plan, or null when it is unknown or other. */
export function segmentFor(data: Content, basePlan: string | null) {
  if (basePlan === null) return null;
  return data.licensing.prerequisites.segments.find((s) => s.basePlans.includes(basePlan)) ?? null;
}

/** The licensing questions for a specialist, as Markdown: what Microsoft states, and what it leaves open. */
export function handoffText(
  data: Content,
  input: {
    customer: string;
    access: string | null;
    accessLabel: string | null;
    audience: string[] | null;
  },
): string {
  const { handoff, needs } = data.licensing;
  const customer = input.customer.trim();
  const shown = populationViews(data, { access: input.access, audience: input.audience }).filter(
    (view) => view.relevant !== false,
  );
  const lines: string[] = [
    `# ${customer === '' ? handoff.heading : renderTemplate(handoff.titleTemplate, { customer })}`,
    '',
  ];
  if (input.accessLabel !== null)
    lines.push(renderTemplate(handoff.accessLine, { label: input.accessLabel }), '');
  const stated = shown.filter((view) => view.population.need !== 'not-stated');
  lines.push(`## ${data.licensing.who.heading}`, '');
  for (const { population } of stated)
    lines.push(`- ${population.label} (${needs[population.need]}): ${population.statement}`);
  const open = shown.filter((view) => view.population.need === 'not-stated');
  if (open.length > 0) {
    lines.push('', `## ${data.licensing.who.confirmLabel}`, '');
    for (const { population } of open)
      lines.push(`- ${population.label}: ${population.confirm ?? population.statement}`);
  }
  lines.push('', `## ${handoff.heading}`, '');
  handoff.questions.forEach((question, index) => lines.push(`${index + 1}. ${question}`));
  const titles = new Map(data.sources.map((source) => [source.id, source.title]));
  const cited = [...new Set(shown.flatMap((view) => view.population.sourceIds))].flatMap((id) => {
    const title = titles.get(id);
    return title === undefined ? [] : [title];
  });
  if (cited.length > 0) lines.push('', `${data.site.ui.exhibit.sourcePrefix} ${cited.join('; ')}`);
  lines.push('', data.licensing.notice);
  return lines.join('\n');
}
