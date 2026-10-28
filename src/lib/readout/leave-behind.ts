import type { Content } from '../content/schemas.ts';
import { renderTemplate } from '../content/template.ts';
import {
  CONTROL_LIMIT,
  QUESTION_LIMIT,
  stepLimit,
  type LeaveBehind,
} from '../engine/leave-behind.ts';
import { pillarLabel } from '../engine/pillars.ts';
import {
  blob,
  compact,
  palette,
  panel,
  presentation,
  PresentationError,
  slideFrame,
  text,
} from './powerpoint.ts';

const { ink, slate } = palette;
const COLUMN_X = [0.5, 4.65, 8.8] as const;

export interface LeaveBehindDeckInput {
  data: Content;
  plan: LeaveBehind;
  customer: string;
  agent: string;
  /** The date shown as "Prepared", already formatted. */
  prepared: string;
}

const joinLines = (lines: string[]) => lines.filter((line) => line !== '').join('\n');

/**
 * The three slides to send with the one-pager: the passport and why it matters, the controls and who to license,
 * and the go-live plan with the questions to confirm. Each slide has its own speaker notes: what to say, then the
 * detail the slide had to shorten. Unknowns appear only on the last slide.
 */
export async function leaveBehindPowerPoint(input: LeaveBehindDeckInput): Promise<Blob> {
  const { data, plan, customer, agent, prepared } = input;
  const copy = data.leaveBehind;
  const page = copy.page;
  const { passport } = plan;
  try {
    const pptx = await presentation(data, renderTemplate(page.title, { agent, customer }));
    const version = passport.result.contentVersion;
    const stageLabel =
      plan.stage === null
        ? page.accessUnknown
        : (data.questions.find((q) => q.id === 'stage')?.options.find((o) => o.value === plan.stage)
            ?.label ?? plan.stage);
    const accessLabel = passport.accessLabel ?? page.accessUnknown;
    const platformLabel = passport.platform?.label ?? page.accessUnknown;
    const statusLabel = (status: keyof typeof data.guardrails.statusLabels) =>
      data.guardrails.statusLabels[status];
    const sourceTitles = (ids: string[]) =>
      ids.flatMap((id) => data.sources.find((source) => source.id === id)?.title ?? []).join('; ');

    // ---------- 1. Passport and why ----------
    let slide = slideFrame(
      pptx,
      data,
      copy.deck.titles.passport,
      version,
      joinLines([
        copy.deck.notes.passport,
        '',
        renderTemplate(page.title, { agent, customer }),
        `${page.accessLabel}: ${accessLabel}`,
        `${page.platformLabel}: ${platformLabel}`,
        `${page.stageLabel}: ${stageLabel}`,
        '',
        page.whyHeading,
        ...plan.why.map((statement) => `${statement.text} (${sourceTitles(statement.sourceIds)})`),
      ]),
    );
    text(
      slide,
      compact(renderTemplate(page.title, { agent, customer }), 90),
      0.5,
      1.45,
      12.3,
      0.5,
      24,
      ink,
      true,
    );
    text(slide, prepared, 0.5, 1.98, 12.3, 0.3, 12, slate);
    [
      [page.accessLabel, accessLabel],
      [page.platformLabel, platformLabel],
      [page.stageLabel, stageLabel],
    ].forEach(([label, value], i) => {
      panel(pptx, slide, COLUMN_X[i]!, 2.5, 3.98, 1.1);
      text(slide, label!, COLUMN_X[i]! + 0.2, 2.62, 3.58, 0.3, 13, slate, true);
      text(slide, compact(value!, 50), COLUMN_X[i]! + 0.2, 3.0, 3.58, 0.5, 17);
    });
    panel(pptx, slide, 0.5, 3.85, 12.3, 2.45);
    text(slide, page.whyHeading, 0.7, 4.0, 11.9, 0.35, 16, ink, true);
    plan.why.forEach((statement, i) => {
      const y = 4.45 + i * 0.9;
      text(slide, compact(statement.text, 230), 0.7, y, 11.9, 0.6, 14);
      text(
        slide,
        compact(sourceTitles(statement.sourceIds), 120),
        0.7,
        y + 0.62,
        11.9,
        0.22,
        10,
        slate,
      );
    });

    // ---------- 2. Controls and who to license ----------
    const detail = passport.areas.flatMap((area) => [
      pillarLabel(data, area.pillar),
      ...[...area.essential, ...area.recommended].map(
        (entry) => `- ${entry.capability.shortName} (${data.site.mapping.levels[entry.level]})`,
      ),
    ]);
    const populations = [...plan.license.required, ...plan.license.recommended].map(
      (view) => `- ${view.population.label} (${data.licensing.needs[view.population.need]})`,
    );
    slide = slideFrame(
      pptx,
      data,
      copy.deck.titles.controls,
      version,
      joinLines([
        copy.deck.notes.controls,
        '',
        page.controlsHeading,
        ...detail,
        '',
        page.licensingHeading,
        ...populations,
      ]),
    );
    if (passport.areas.length === 0) text(slide, page.controlsNone, 0.5, 1.7, 12.3, 0.6, 20);
    passport.areas.slice(0, 3).forEach((area, i) => {
      const x = COLUMN_X[i]!;
      panel(pptx, slide, x, 1.55, 3.98, 3.35);
      text(
        slide,
        compact(pillarLabel(data, area.pillar), 40),
        x + 0.2,
        1.7,
        3.58,
        0.45,
        17,
        ink,
        true,
      );
      text(
        slide,
        `${area.essential.length} ${data.site.mapping.levels.essential} · ${area.recommended.length} ${data.site.mapping.levels.recommended}`,
        x + 0.2,
        2.2,
        3.58,
        0.3,
        12,
        slate,
        true,
      );
      area.essential.slice(0, CONTROL_LIMIT).forEach((entry, index) => {
        text(
          slide,
          compact(entry.capability.shortName, 38),
          x + 0.2,
          2.62 + index * 0.3,
          3.58,
          0.26,
          13,
        );
      });
      const more = area.essential.length - CONTROL_LIMIT;
      if (more > 0)
        text(
          slide,
          compact(renderTemplate(page.controlsEssentialMore, { count: more }), 40),
          x + 0.2,
          2.62 + CONTROL_LIMIT * 0.3,
          3.58,
          0.26,
          12,
          slate,
        );
      if (area.recommended.length > 0)
        text(
          slide,
          compact(renderTemplate(page.controlsMore, { count: area.recommended.length }), 40),
          x + 0.2,
          4.5,
          3.58,
          0.26,
          12,
          slate,
        );
    });
    panel(pptx, slide, 0.5, 5.05, 12.3, 1.3);
    text(slide, page.licensingHeading, 0.7, 5.15, 11.9, 0.3, 14, slate, true);
    text(
      slide,
      passport.access === null
        ? page.licensingUnknown
        : compact(
            plan.license.required.map((view) => view.population.label).join('; ') ||
              page.licensingUnknown,
            230,
          ),
      0.7,
      5.5,
      11.9,
      0.5,
      14,
    );
    text(slide, page.licensingNote, 0.7, 6.02, 11.9, 0.25, 11, slate);

    // ---------- 3. Go-live plan and questions to confirm ----------
    const allSteps = plan.steps.flatMap((step) => [
      step.gate.title,
      ...step.items.map((view) => `- ${statusLabel(view.status)}: ${view.item.title}`),
    ]);
    slide = slideFrame(
      pptx,
      data,
      copy.deck.titles.plan,
      version,
      joinLines([
        copy.deck.notes.plan,
        '',
        page.stepsHeading,
        ...allSteps,
        '',
        page.confirmHeading,
        ...plan.questions.map((q) => `- ${q}`),
      ]),
    );
    panel(pptx, slide, 0.5, 1.55, 6.05, 4.75);
    text(slide, page.stepsHeading, 0.7, 1.7, 5.65, 0.4, 18, ink, true);
    let y = 2.2;
    const perGate = stepLimit(plan.steps.length);
    for (const step of plan.steps) {
      text(slide, compact(step.gate.title, 60), 0.7, y, 5.65, 0.28, 13, slate, true);
      y += 0.32;
      for (const view of step.items.slice(0, perGate)) {
        text(
          slide,
          compact(`${statusLabel(view.status)}: ${view.item.title}`, 70),
          0.7,
          y,
          5.65,
          0.26,
          12,
        );
        y += 0.28;
      }
      const hidden = step.items.length - perGate;
      if (hidden > 0) {
        text(
          slide,
          renderTemplate(page.stepsMore, { count: hidden }),
          0.7,
          y,
          5.65,
          0.24,
          11,
          slate,
        );
        y += 0.26;
      }
      y += 0.12;
    }
    if (plan.steps.length === 0) text(slide, page.stepsNone, 0.7, 2.2, 5.65, 0.3, 14);

    panel(pptx, slide, 6.75, 1.55, 6.05, 4.75);
    text(slide, page.confirmHeading, 6.95, 1.7, 5.65, 0.4, 18, ink, true);
    if (plan.questions.length === 0) text(slide, page.confirmNone, 6.95, 2.2, 5.65, 0.3, 14);
    plan.questions.slice(0, QUESTION_LIMIT).forEach((question, index) => {
      text(slide, compact(question, 170), 6.95, 2.2 + index * 0.62, 5.65, 0.6, 12);
    });
    const hiddenQuestions = plan.questions.length - QUESTION_LIMIT;
    if (hiddenQuestions > 0)
      text(
        slide,
        renderTemplate(page.confirmMore, { count: hiddenQuestions }),
        6.95,
        6.0,
        5.65,
        0.24,
        11,
        slate,
      );

    return await blob(pptx);
  } catch (error) {
    if (error instanceof PresentationError) throw error;
    throw new PresentationError({ cause: error });
  }
}
