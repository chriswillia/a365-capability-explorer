import type { SeatInputs, SeatResult } from '../engine/seats.ts';
import type { Content } from './schemas.ts';
import { renderTemplate } from './template.ts';

type Calculator = Content['licensing']['calculator'];

interface Line {
  section: string;
  item: string;
  value: string;
}

const show = (value: number | null, notEntered: string) =>
  value === null ? notEntered : String(value);

/** The numbers a seller entered and what they produce, in one list, so the Markdown and the CSV cannot disagree. */
function lines(copy: Calculator, inputs: SeatInputs, result: SeatResult): Line[] {
  const none = copy.notEntered;
  const estimate = (value: number | null, isEstimate: boolean) =>
    isEstimate && value !== null
      ? `${value} (${copy.estimateLabel.toLowerCase()})`
      : show(value, none);
  const { people, results, export: labels } = copy;
  return [
    { section: labels.people, item: people.delegating.label, value: show(inputs.delegating, none) },
    { section: labels.people, item: people.owners.label, value: show(inputs.owners, none) },
    {
      section: labels.people,
      item: people.overlap.label,
      value: result.overlapReduced ? String(result.overlapUsed) : show(inputs.overlap, none),
    },
    { section: labels.people, item: people.everyone.label, value: show(inputs.everyone, none) },
    ...copy.planFamilies.map((family) => ({
      section: labels.plans,
      item: `${family.label} (${copy.standings[family.standing]})`,
      value: show(inputs.seats[family.id] ?? null, none),
    })),
    { section: labels.results, item: results.required.label, value: show(result.required, none) },
    {
      section: labels.results,
      item: results.recommended.label,
      value: show(result.recommended, none),
    },
    {
      section: labels.results,
      item: results.included.label,
      value: estimate(result.included, result.includedIsEstimate),
    },
    {
      section: labels.results,
      item: results.qualifying.label,
      value: estimate(result.qualifying, result.qualifyingIsEstimate),
    },
    { section: labels.results, item: results.needsPlan.label, value: show(result.needsPlan, none) },
    { section: labels.results, item: results.toAdd.label, value: show(result.toAdd, none) },
  ];
}

/** The sizing as Markdown, with the sources it rests on. */
export function seatsMarkdown(data: Content, inputs: SeatInputs, result: SeatResult): string {
  const copy = data.licensing.calculator;
  const out: string[] = [`# ${copy.export.title}`, '', copy.export.notice];
  let section = '';
  for (const line of lines(copy, inputs, result)) {
    if (line.section !== section) {
      section = line.section;
      out.push('', `## ${section}`, '');
    }
    out.push(`- ${line.item}: ${line.value}`);
  }
  const titles = new Map(data.sources.map((source) => [source.id, source.title]));
  const cited = [
    ...new Set([
      ...copy.results.required.sourceIds,
      ...copy.results.recommended.sourceIds,
      ...copy.planFamilies.flatMap((family) => family.sourceIds),
    ]),
  ].flatMap((id) => {
    const title = titles.get(id);
    return title === undefined ? [] : [title];
  });
  if (cited.length > 0) out.push('', `${data.site.ui.exhibit.sourcePrefix} ${cited.join('; ')}`);
  return out.join('\n');
}

// A spreadsheet reads a cell that starts with one of these as a formula, so such a cell is made plain text.
const FORMULA_START = /^[=+\-@\t\r]/;
export function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** The sizing as CSV (section, item, value), ready for a spreadsheet. */
export function seatsCsv(data: Content, inputs: SeatInputs, result: SeatResult): string {
  const copy = data.licensing.calculator;
  const { columns } = copy.export;
  const rows = lines(copy, inputs, result).map((line) =>
    [line.section, line.item, line.value].map(csvCell).join(','),
  );
  return [[columns.section, columns.item, columns.value].map(csvCell).join(','), ...rows].join(
    '\r\n',
  );
}

export const warningTexts = (copy: Calculator, result: SeatResult): string[] => [
  ...(result.overlapReduced
    ? [renderTemplate(copy.warnings.overlapReduced, { n: result.overlapUsed })]
    : []),
  ...(result.includedReduced && result.included !== null
    ? [renderTemplate(copy.warnings.includedReduced, { n: result.included })]
    : []),
  ...(result.qualifyingReduced && result.qualifying !== null
    ? [renderTemplate(copy.warnings.qualifyingReduced, { n: result.qualifying })]
    : []),
];
