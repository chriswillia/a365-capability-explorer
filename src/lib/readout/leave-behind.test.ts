// @vitest-environment node
import { JSDOM } from 'jsdom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { content, contentMeta } from '../content/index.ts';
import { CONTROL_LIMIT, QUESTION_LIMIT, buildLeaveBehind } from '../engine/leave-behind.ts';
import { pillarLabel } from '../engine/pillars.ts';
import { packageContents } from '../../test-support/ooxml.ts';
import { leaveBehindPowerPoint } from './leave-behind.ts';

const copy = content.leaveBehind;
const six = {
  accessModel: 'own-teammate',
  buildPlatform: 'microsoft-foundry',
  dataSensitivity: 'confidential',
  tools: ['microsoft-mcp'],
  autonomy: 'approval-gated',
  audience: ['employees'],
};
const input = (useCase: Record<string, string | string[]>) =>
  buildLeaveBehind(
    content,
    { org: { cloudEnvironment: 'commercial' }, useCase: { stage: 'pilot', ...useCase } },
    contentMeta.contentVersion,
  );
/** The fullest agent: every multiple-choice question answered with every option. */
const fullest = (stage: string) => {
  const org: Record<string, string | string[]> = { cloudEnvironment: 'commercial' };
  const useCase: Record<string, string | string[]> = { ...six, stage };
  for (const question of content.questions.filter((q) => q.type === 'multi'))
    (question.scope === 'org' ? org : useCase)[question.id] = question.options
      .filter((option) => !['none', 'unknown'].includes(option.value))
      .map((option) => option.value);
  return buildLeaveBehind(content, { org, useCase }, contentMeta.contentVersion);
};
const deck = (plan = input(six)) =>
  leaveBehindPowerPoint({
    data: content,
    plan,
    customer: 'Fictional customer',
    agent: 'Fictional agent',
    prepared: 'Prepared 28 October 2026',
  });

const INCH = 914400;
/** Where each shape on a slide sits, in inches, with its text. */
async function shapes(zip: Awaited<ReturnType<typeof packageContents>>['zip'], slide: number) {
  const window = new JSDOM(await zip.file(`ppt/slides/slide${slide}.xml`)!.async('string'), {
    contentType: 'text/xml',
  }).window;
  const found = [...window.document.getElementsByTagName('p:sp')].map((shape) => ({
    y: Number(shape.getElementsByTagName('a:off')[0]?.getAttribute('y')) / INCH,
    height: Number(shape.getElementsByTagName('a:ext')[0]?.getAttribute('cy')) / INCH,
    text: [...shape.getElementsByTagName('a:t')].map((node) => node.textContent).join(' '),
  }));
  window.close();
  return found;
}
describe('leave-behind PowerPoint', () => {
  const dom = new JSDOM('');
  beforeAll(() => {
    vi.stubGlobal('DOMParser', dom.window.DOMParser);
    vi.stubGlobal('XMLSerializer', dom.window.XMLSerializer);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    dom.window.close();
  });

  it('makes exactly three slides, each with its own speaker notes, and a package a strict reader accepts', async () => {
    const { slides, notes } = await packageContents(await deck(), 3);
    expect(slides).toHaveLength(3);
    const said = [copy.deck.notes.passport, copy.deck.notes.controls, copy.deck.notes.plan];
    said.forEach((words, index) => expect(notes[index]).toContain(words));
    expect(new Set(notes).size).toBe(3);
  });

  it('opens with the agent, how it acts, where it is built and why it matters', async () => {
    const plan = input(six);
    const { slides } = await packageContents(await deck(plan), 3);
    expect(slides[0]).toContain(copy.deck.titles.passport);
    expect(slides[0]).toContain('Fictional agent for Fictional customer');
    expect(slides[0]).toContain('Prepared 28 October 2026');
    expect(slides[0]).toContain(plan.passport.accessLabel!);
    expect(slides[0]).toContain(plan.passport.platform!.label);
    for (const statement of plan.why) expect(slides[0]).toContain(statement.text.slice(0, 40));
  });

  it('shows the Essential controls for each area, and who to license', async () => {
    const plan = input(six);
    const { slides } = await packageContents(await deck(plan), 3);
    expect(slides[1]).toContain(copy.deck.titles.controls);
    for (const area of plan.passport.areas) {
      expect(slides[1]).toContain(pillarLabel(content, area.pillar));
      for (const entry of area.essential.slice(0, CONTROL_LIMIT))
        expect(slides[1]).toContain(entry.capability.shortName.slice(0, 30));
      const more = area.essential.length - CONTROL_LIMIT;
      if (more > 0)
        expect(slides[1]).toContain(
          copy.page.controlsEssentialMore.replace('{count}', String(more)),
        );
    }
    expect(slides[1]).toContain(copy.page.licensingHeading);
    for (const view of plan.license.required)
      expect(slides[1]).toContain(view.population.label.slice(0, 40));
  });

  it('keeps every unknown on the last slide, and the rest in the notes', async () => {
    const plan = input(six);
    expect(plan.questions.length).toBeGreaterThan(QUESTION_LIMIT);
    const { slides, notes } = await packageContents(await deck(plan), 3);
    expect(slides[2]).toContain(copy.page.confirmHeading);
    for (const question of plan.questions.slice(0, QUESTION_LIMIT)) {
      expect(slides[2]).toContain(question.slice(0, 40));
      // The slide has room for about two lines, so a question this short is never cut off.
      if (question.length <= 130) expect(slides[2]).toContain(question);
    }
    for (const question of plan.questions) {
      expect(notes[2]).toContain(question);
      expect(slides[0]).not.toContain(question);
      expect(slides[1]).not.toContain(question);
    }
    expect(slides[2]).toContain(
      copy.page.confirmMore.replace('{count}', String(plan.questions.length - QUESTION_LIMIT)),
    );
  });

  it('lists the go-live steps by gate, with the status in words', async () => {
    const plan = input(six);
    const { slides, notes } = await packageContents(await deck(plan), 3);
    for (const step of plan.steps) {
      expect(slides[2]).toContain(step.gate.title.slice(0, 40));
      for (const view of step.items) expect(notes[2]).toContain(view.item.title);
    }
    expect(slides[2]).toContain(content.guardrails.statusLabels.unknown);
  });

  it('still makes three slides when nothing is answered', async () => {
    const { slides } = await packageContents(await deck(input({})), 3);
    expect(slides[0]).toContain(copy.page.accessUnknown);
    expect(slides[1]).toContain(copy.page.licensingUnknown);
  });

  // The three gates of an agent that is scaling are the longest list the slides ever carry.
  it('keeps every line inside its panel, even for the fullest agent at the scaling stage', async () => {
    const plan = fullest('scaling');
    expect(plan.steps).toHaveLength(3);
    const { zip } = await packageContents(await deck(plan), 3);
    const panels = [
      { slide: 2, top: 1.55, bottom: 4.9 },
      { slide: 2, top: 5.05, bottom: 6.35 },
      { slide: 3, top: 1.55, bottom: 6.3 },
    ];
    for (const { slide, top, bottom } of panels)
      for (const shape of (await shapes(zip, slide)).filter(
        (candidate) => candidate.y >= top - 0.001 && candidate.y < bottom,
      ))
        expect(
          shape.y + shape.height,
          `slide ${slide}: ${shape.text.slice(0, 50)}`,
        ).toBeLessThanOrEqual(bottom + 0.001);
  });
});
