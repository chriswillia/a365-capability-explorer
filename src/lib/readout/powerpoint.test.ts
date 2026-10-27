// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { JSDOM } from 'jsdom';
import { posix } from 'node:path';
import { content } from '../content/index.ts';
import { renderTemplate } from '../content/template.ts';
import { patternAnswers } from '../engine/evaluate.ts';
import { pillarLabel } from '../engine/pillars.ts';
import { buildReadout } from './report.ts';
import { canvasPowerPoint, normalizePresentationPackage, readoutPowerPoint } from './powerpoint.ts';
import type { Assessment, Organization } from '../state/diagnostic-model.ts';

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

async function packageContents(blob: Blob, count: number) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort();
  const notes = Object.keys(zip.files)
    .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))
    .sort();
  expect(slides).toHaveLength(count);
  expect(notes).toHaveLength(count);
  for (const name of Object.keys(zip.files).filter((name) => /\.(xml|rels)$/.test(name))) {
    const xml = await zip.file(name)!.async('string');
    const document = new JSDOM(xml, { contentType: 'text/xml' });
    if (name.endsWith('.rels')) {
      for (const relationship of document.window.document.getElementsByTagName('Relationship')) {
        expect(relationship.getAttribute('TargetMode')).not.toBe('External');
        const target = relationship.getAttribute('Target');
        if (!target) throw new Error('Missing package relationship target');
        const source = name.replace('_rels/', '').replace(/\.rels$/, '');
        const part = posix.normalize(posix.join(posix.dirname(source), target));
        expect(zip.file(part), `${name}: ${target}`).not.toBeNull();
      }
    }
    for (const override of document.window.document.getElementsByTagName('Override')) {
      const part = override.getAttribute('PartName')?.slice(1);
      if (!part) throw new Error('Missing content-type part name');
      expect(zip.file(part), `Missing declared package part: ${part}`).not.toBeNull();
    }
    if (name === 'ppt/presentation.xml') {
      const tags = [...document.window.document.documentElement.children].map(
        (node) => node.localName,
      );
      expect(tags.indexOf('notesMasterIdLst')).toBeLessThan(tags.indexOf('sldIdLst'));
    }
    document.window.close();
  }
  const readText = async (name: string) => {
    const window = new JSDOM(await zip.file(name)!.async('string'), { contentType: 'text/xml' })
      .window;
    const text = [...window.document.getElementsByTagName('a:t')]
      .map((node) => node.textContent)
      .join('\n');
    window.close();
    return text;
  };
  return {
    zip,
    slides: await Promise.all(slides.map(readText)),
    notes: await Promise.all(notes.map(readText)),
  };
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
    'makes exactly seven readout slides with full notes, no remote assets and a logo (dense=%s)',
    async (dense) => {
      const report = readout(dense);
      const before = structuredClone(report);
      const result = await packageContents(await readoutPowerPoint(content, report), 7);
      const titles = [
        content.site.productName,
        content.site.mapping.pillars,
        content.site.readout.summary,
        content.site.readout.anatomy,
        content.site.readout.riskControls,
        content.site.readout.roadmap,
        content.site.readout.exhibits.licensing,
      ];
      for (let i = 0; i < titles.length; i++) {
        expect(result.slides[i]).toContain(titles[i]);
        expect(result.slides[i]).toContain('test-version');
        expect(result.slides[i]).toContain(content.site.disclaimer);
        expect(result.slides[i]).toContain(content.site.readout.notesDetail);
        expect(result.notes[i]).toContain('Fictional preparer');
        expect(result.notes[i]).toContain(report.result.matchedRuleIds[0]);
        expect(result.notes[i]).toContain(content.site.readout.eligibility);
        if (dense) expect(result.notes[i]).toContain(String(report.answers.businessOutcome));
      }
      expect(
        Object.keys(result.zip.files).filter((name) => /^ppt\/media\/.+\.png$/.test(name)).length,
      ).toBeGreaterThan(0);
      expect(report).toEqual(before);
    },
  );

  it('puts one panel per requirement area on the second slide, with the in-scope counts', async () => {
    const report = readout();
    const result = await packageContents(await readoutPowerPoint(content, report), 7);
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
