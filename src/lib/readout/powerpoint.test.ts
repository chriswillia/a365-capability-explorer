// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { JSDOM } from 'jsdom';
import { content } from '../content/index.ts';
import { renderTemplate } from '../content/template.ts';
import { patternAnswers } from '../engine/evaluate.ts';
import { byUrgency } from '../engine/guardrails.ts';
import { pillarLabel } from '../engine/pillars.ts';
import { buildReadout, readoutMarkdown } from './report.ts';
import { canvasPowerPoint, normalizePresentationPackage, readoutPowerPoint } from './powerpoint.ts';
import type { Assessment, Organization } from '../state/diagnostic-model.ts';
import { packageContents } from '../../test-support/ooxml.ts';

function readout(dense = false) {
  const input = patternAnswers(content, 'process-agent', 'askhr');
  const entity = {
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    contentVersion: 'old',
  };
  const organization: Organization = {
    ...entity,
    id: crypto.randomUUID(),
    answers: { ...input.org, orgName: 'Fictional organization' },
  };
  const assessment: Assessment = {
    ...entity,
    id: crypto.randomUUID(),
    organizationId: organization.id,
    answers: {
      ...input.useCase,
      useCaseName: 'Fictional readout',
      preparedBy: 'Fictional preparer',
      preparedOn: '2026-10-26',
      successMeasures: 'Reduce handling time from ten minutes to five; review after the pilot.',
      accountableOwner: 'Fictional operations team',
    },
    mode: 'full',
    sectionId: 'review',
    patternId: 'process-agent',
    sampleId: 'askhr',
    logo: {
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP8////fwYGBgYAGfgD/g/eHX8AAAAASUVORK5CYII=',
      width: 2,
      height: 1,
      alt: 'Fictional logo',
    },
  };
  if (dense) {
    assessment.answers.useCaseName = 'Long fictional name '.repeat(6).slice(0, 120);
    assessment.answers.businessOutcome = 'A long fictional outcome with stakeholder detail. '
      .repeat(41)
      .slice(0, 2000);
    for (const question of content.questions.filter((q) => q.type === 'multi')) {
      const answers = question.scope === 'org' ? organization.answers : assessment.answers;
      answers[question.id] = question.options
        .filter((o) => !['none', 'unknown'].includes(o.value))
        .map((o) => o.value);
    }
  }
  return buildReadout(content, organization, assessment, 'test-version');
}

describe('editable local PowerPoint exports', () => {
  const dom = new JSDOM('');
  beforeAll(() => {
    vi.stubGlobal('DOMParser', dom.window.DOMParser);
    vi.stubGlobal('XMLSerializer', dom.window.XMLSerializer);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    dom.window.close();
  });

  it('refuses missing real content and external relationships instead of repairing or dropping them', async () => {
    const original = await readoutPowerPoint(content, readout());
    for (const kind of ['missing-slide', 'external'] as const) {
      const zip = await JSZip.loadAsync(await original.arrayBuffer());
      if (kind === 'missing-slide') zip.remove('ppt/slides/slide2.xml');
      else {
        const name = 'ppt/_rels/presentation.xml.rels';
        const xml = await zip.file(name)!.async('string');
        zip.file(name, xml.replace('<Relationship ', '<Relationship TargetMode="External" '));
      }
      const changed = await zip.generateAsync({ type: 'blob' });
      await expect(normalizePresentationPackage(changed)).rejects.toThrow(
        'PowerPoint generation failed',
      );
    }
  });
  it.each([false, true])(
    'makes exactly eight readout slides with their own notes, no remote assets and a logo (dense=%s)',
    async (dense) => {
      const report = readout(dense);
      const before = structuredClone(report);
      const result = await packageContents(await readoutPowerPoint(content, report), 8);
      const titles = [
        content.site.productName,
        content.site.mapping.pillars,
        content.site.readout.summary,
        content.site.readout.anatomy,
        content.site.readout.riskControls,
        content.site.readout.exhibits.guardrails,
        content.site.readout.roadmap,
        content.site.readout.exhibits.licensing,
      ];
      const talk = content.site.readout.slideNotes;
      const talkTracks = [
        talk.title,
        talk.pillars,
        talk.summary,
        talk.anatomy,
        talk.riskControls,
        talk.guardrails,
        talk.roadmap,
        talk.licensing,
      ];
      for (let i = 0; i < titles.length; i++) {
        expect(result.slides[i]).toContain(titles[i]);
        expect(result.slides[i]).toContain('test-version');
        expect(result.slides[i]).toContain(content.site.disclaimer);
        expect(result.slides[i]).toContain(content.site.readout.notesDetail);
        expect(result.notes[i]).toContain(talkTracks[i]);
        expect(result.notes[i]).toContain(content.site.readout.slideNotesDetail);
      }
      expect(result.notes[0]).toContain('Fictional preparer');
      if (dense) expect(result.notes[0]).toContain(String(report.answers.businessOutcome));
      expect(
        Object.keys(result.zip.files).filter((name) => /^ppt\/media\/.+\.png$/.test(name)).length,
      ).toBeGreaterThan(0);
      expect(report).toEqual(before);
    },
  );

  it('gives each slide its own speaker notes instead of the whole readout', async () => {
    const report = readout();
    const markdown = readoutMarkdown(content, report);
    const result = await packageContents(await readoutPowerPoint(content, report), 8);
    expect(new Set(result.notes).size).toBe(8);
    for (const note of result.notes) expect(note.length).toBeLessThan(markdown.length);
    const [title, pillars, , , , guardrails, , licensing] = result.notes as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    expect(pillars).not.toContain('Fictional preparer');
    expect(title).not.toContain(content.site.readout.verifyNext);
    expect(guardrails).not.toContain(content.site.readout.verifyNext);
    expect(licensing).toContain(content.site.readout.verifyNext);
  });

  it('lists in the notes everything a slide has to shorten', async () => {
    const report = readout();
    const result = await packageContents(await readoutPowerPoint(content, report), 8);
    // Each requirement-area panel shows a few capabilities; the notes name every one in scope.
    for (const row of report.pillars)
      for (const { capability } of row.items)
        expect(result.notes[1]).toContain(capability.shortName);
    // The guardrails slide shows four items per gate; the notes list them all, with the action to take.
    for (const { items } of report.guardrails.gates)
      for (const { item } of items) {
        expect(result.notes[5]).toContain(item.title);
        expect(result.notes[5]).toContain(item.action);
      }
    // The licensing slide holds the basis and the note; the notes add what is still to confirm.
    expect(result.notes[7]).toContain(
      report.result.licensing.basis ?? content.site.mapping.licenseBasisConfirm,
    );
    expect(result.notes[7]).toContain(content.site.readout.eligibility);
    for (const { item, status } of report.license.requirements)
      if (status === 'unknown') expect(result.notes[7]).toContain(item.askPrompt!);
    for (const question of report.result.openQuestions)
      expect(result.notes[7]).toContain(question.label);
  });

  it('puts one panel per requirement area on the second slide, with the in-scope counts', async () => {
    const report = readout();
    const result = await packageContents(await readoutPowerPoint(content, report), 8);
    expect(report.pillars.length).toBe(content.pillars.length);
    for (const row of report.pillars) {
      expect(result.slides[1]).toContain(pillarLabel(content, row.pillar));
      expect(result.slides[1]).toContain(
        renderTemplate(content.site.mapping.pillarCount, {
          count: row.items.length,
          total: row.catalogTotal,
        }),
      );
    }
    expect(report.pillars.reduce((sum, row) => sum + row.items.length, 0)).toBe(
      report.result.inScope.length,
    );
  });

  it('puts one panel per gate on the guardrails slide, with the status in words and the counts', async () => {
    const report = readout();
    const result = await packageContents(await readoutPowerPoint(content, report), 8);
    const slide = result.slides[5]!;
    for (const { gate, items } of report.guardrails.gates) {
      expect(slide).toContain(gate.title);
      for (const { item, status } of byUrgency(items).slice(0, 4)) {
        expect(slide).toContain(content.guardrails.statusLabels[status]);
        expect(slide).toContain(item.title.slice(0, 20));
      }
    }
    expect(slide).toContain(renderTemplate(content.guardrails.summary, report.guardrails.counts));
  });

  it.each([false, true])(
    'makes exactly one eleven-box canvas slide (populated=%s)',
    async (populated) => {
      const report = populated ? readout(true) : undefined;
      const result = await packageContents(
        await canvasPowerPoint(content, 'test-version', report),
        1,
      );
      for (const box of content.site.readout.canvasBoxes)
        expect(result.slides[0]).toContain(box.title);
      expect(result.slides[0]).toContain(content.site.mapping.inScope);
      expect(result.slides[0]).toContain(content.site.disclaimer);
      if (report) {
        expect(result.slides[0]).toContain(
          report.pillars.map((row) => `${row.pillar.requirement}: ${row.items.length}`).join(' · '),
        );
        expect(result.notes[0]).toContain('Fictional operations team');
        expect(result.notes[0]).toContain(String(report.answers.businessOutcome));
        expect(result.notes[0]).toContain(String(report.answers.successMeasures));
      } else {
        for (const pillar of content.pillars)
          expect(result.slides[0]).not.toContain(`${pillar.requirement}: `);
      }
    },
  );
});
