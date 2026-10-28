import type PptxGenJS from 'pptxgenjs';
import type { Content } from '../content/schemas.ts';
import { colors, typography } from '../../theme/tokens.ts';
import { renderTemplate } from '../content/template.ts';
import { pillarLabel } from '../engine/pillars.ts';
import { describeReadiness } from '../engine/readiness.ts';
import { byUrgency } from '../engine/guardrails.ts';
import {
  answerLabel,
  canvasFields,
  readoutMarkdown,
  summarizeText,
  type Readout,
} from './report.ts';
import { readoutSlideNotes, type SlideNotes } from './notes.ts';
import type { Logo } from '../state/logo.ts';

export class PresentationError extends Error {
  constructor(options?: ErrorOptions) {
    super('PowerPoint generation failed', options);
    this.name = 'PresentationError';
  }
}

const ink = colors.ink.slice(1);
const paper = colors.paper.slice(1);
const white = colors.white.slice(1);
const slate = colors.slate.slice(1);
const border = colors.hairline.slice(1);
const displayFont = typography.fontDisplay.split(',')[2]!.trim();
const bodyFont = typography.fontBody.split(',')[2]!.trim().replaceAll('"', '');
const officeText = (value: string) =>
  // OOXML cannot represent these control characters.
  // eslint-disable-next-line no-control-regex
  value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '\uFFFD');
export const compact = (value: string, limit: number) => officeText(summarizeText(value, limit));
export const palette = { ink, paper, white, slate, border, displayFont, bodyFont } as const;

export async function presentation(data: Content, title: string) {
  const { default: Constructor } = await import('pptxgenjs');
  const pptx = new Constructor();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = data.site.productName;
  pptx.subject = data.site.readout.draft;
  pptx.title = officeText(title);
  pptx.company = data.site.productName;
  pptx.theme = { headFontFace: displayFont, bodyFontFace: bodyFont };
  return pptx;
}

export function text(
  slide: PptxGenJS.Slide,
  value: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize = 16,
  color = ink,
  bold = false,
) {
  slide.addText(officeText(value), {
    x,
    y,
    w,
    h,
    fontSize,
    color,
    bold,
    margin: 0,
    fontFace: bodyFont,
    breakLine: false,
    valign: 'top',
    fit: 'none',
  });
}

export function panel(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w,
    h,
    fill: { color: white },
    line: { color: border, width: 1 },
  });
}

function addLogo(pptx: PptxGenJS, slide: PptxGenJS.Slide, logo: Logo) {
  const ratio = Math.min(1.2 / logo.width, 0.65 / logo.height);
  panel(pptx, slide, 11.3, 0.45, 1.5, 0.85);
  slide.addImage({
    data: logo.data,
    x: 11.45 + (1.2 - logo.width * ratio) / 2,
    y: 0.55 + (0.65 - logo.height * ratio) / 2,
    w: logo.width * ratio,
    h: logo.height * ratio,
    altText: logo.alt,
  });
}

export function slideFrame(
  pptx: PptxGenJS,
  data: Content,
  title: string,
  version: string,
  notes: string,
  logo?: Logo,
  dark = false,
) {
  const slide = pptx.addSlide();
  slide.background = { color: dark ? ink : paper };
  slide.addText(officeText(title), {
    x: 0.5,
    y: 0.4,
    w: logo ? 10.4 : 12.3,
    h: 0.9,
    margin: 0,
    fontFace: displayFont,
    fontSize: 34,
    bold: true,
    color: dark ? white : ink,
    valign: 'middle',
    fit: 'none',
  });
  if (logo) addLogo(pptx, slide, logo);
  text(
    slide,
    `${data.site.readout.draft} · ${version}`,
    0.5,
    6.5,
    12.3,
    0.2,
    10,
    dark ? white : slate,
  );
  text(slide, data.site.readout.notesDetail, 0.5, 6.72, 12.3, 0.2, 10, dark ? white : slate);
  text(slide, data.site.disclaimer, 0.5, 6.98, 12.3, 0.34, 9.5, dark ? white : slate);
  slide.addNotes(officeText(notes));
  return slide;
}

export async function blob(pptx: PptxGenJS): Promise<Blob> {
  const output = await pptx.write({ outputType: 'blob', compression: true });
  if (!(output instanceof Blob)) throw new PresentationError();
  return normalizePresentationPackage(output);
}

export async function normalizePresentationPackage(input: Blob): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await input.arrayBuffer());
  const parse = (xml: string) => {
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (document.getElementsByTagName('parsererror').length) throw new PresentationError();
    return document;
  };
  const typesFile = zip.file('[Content_Types].xml');
  if (!typesFile) throw new PresentationError();
  const types = parse(await typesFile.async('string'));
  if (
    types.documentElement.localName !== 'Types' ||
    types.documentElement.namespaceURI !==
      'http://schemas.openxmlformats.org/package/2006/content-types'
  )
    throw new PresentationError();
  const orphanMasters = new Set<string>();
  for (const override of [...types.getElementsByTagName('Override')]) {
    const part = override.getAttribute('PartName')?.slice(1);
    if (!part) throw new PresentationError();
    if (zip.file(part)) continue;
    if (
      !/^ppt\/slideMasters\/slideMaster(?:[2-9]|[1-9]\d+)\.xml$/.test(part) ||
      override.getAttribute('ContentType') !==
        'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml'
    )
      throw new PresentationError();
    // PptxGenJS declares a master per slide but writes only the shared master.
    orphanMasters.add(part);
    override.remove();
  }
  for (const name of Object.keys(zip.files).filter((part) => part.endsWith('.rels'))) {
    const document = parse(await zip.file(name)!.async('string'));
    if (
      document.documentElement.localName !== 'Relationships' ||
      document.documentElement.namespaceURI !==
        'http://schemas.openxmlformats.org/package/2006/relationships'
    )
      throw new PresentationError();
    for (const relationship of [...document.getElementsByTagName('Relationship')]) {
      const target = relationship.getAttribute('Target');
      if (
        !target ||
        relationship.getAttribute('TargetMode') === 'External' ||
        /^[a-z][\w+.-]*:/i.test(target)
      )
        throw new PresentationError();
      const source = name.replace('_rels/', '').replace(/\.rels$/, '');
      const parts = target.startsWith('/') ? [] : source.split('/').slice(0, -1);
      for (const segment of target.split('/')) {
        if (!segment || segment === '.') continue;
        if (segment === '..') {
          if (!parts.length) throw new PresentationError();
          parts.pop();
        } else parts.push(decodeURIComponent(segment));
      }
      const part = parts.join('/');
      if (orphanMasters.has(part) || !zip.file(part)) throw new PresentationError();
    }
  }
  const serializer = new XMLSerializer();
  let changed = orphanMasters.size > 0;
  if (changed) zip.file('[Content_Types].xml', serializer.serializeToString(types));
  const presentationFile = zip.file('ppt/presentation.xml');
  if (!presentationFile) throw new PresentationError();
  const presentation = parse(await presentationFile.async('string'));
  const root = presentation.documentElement;
  if (
    root.localName !== 'presentation' ||
    root.namespaceURI !== 'http://schemas.openxmlformats.org/presentationml/2006/main'
  )
    throw new PresentationError();
  const notes = root.getElementsByTagName('p:notesMasterIdLst')[0];
  const slides = root.getElementsByTagName('p:sldIdLst')[0];
  if (notes && slides && [...root.children].indexOf(notes) > [...root.children].indexOf(slides)) {
    // The Office schema puts notes-master ids before slide ids, unlike the writer.
    root.insertBefore(notes, slides);
    zip.file('ppt/presentation.xml', serializer.serializeToString(presentation));
    changed = true;
  }
  if (!changed) return input;
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

export async function readoutPowerPoint(data: Content, report: Readout): Promise<Blob> {
  try {
    const pptx = await presentation(data, report.title);
    const copy = data.site.readout;
    const mapping = data.site.mapping;
    const { result, metrics } = report;
    const notes = readoutSlideNotes(data, report);
    const frame = (key: keyof SlideNotes, title: string, dark = false) =>
      slideFrame(pptx, data, title, result.contentVersion, notes[key], report.logo, dark);
    let slide = frame('title', data.site.productName, true);
    slide.addText(compact(report.title, 96), {
      x: 0.5,
      y: 1.7,
      w: 12.1,
      h: 1.7,
      margin: 0,
      fontFace: displayFont,
      fontSize: 38,
      color: white,
      fit: 'none',
      valign: 'top',
    });
    text(
      slide,
      compact(answerLabel(data, report.answers, 'engagementName'), 100),
      0.5,
      3.7,
      12.1,
      0.6,
      20,
      white,
    );
    const fields = [
      [copy.preparedFor, report.organizationName],
      [
        data.questions.find((q) => q.id === 'preparedBy')!.label,
        answerLabel(data, report.answers, 'preparedBy'),
      ],
      [
        data.questions.find((q) => q.id === 'preparedOn')!.label,
        answerLabel(data, report.answers, 'preparedOn'),
      ],
    ];
    fields.forEach(([label, value], i) => {
      panel(pptx, slide, 0.5 + i * 4.15, 4.75, 3.98, 1.35);
      text(slide, label!, 0.7 + i * 4.15, 4.95, 3.58, 0.3, 14, slate, true);
      text(slide, compact(value!, 62), 0.7 + i * 4.15, 5.35, 3.58, 0.6, 18);
    });

    slide = frame('pillars', mapping.pillars);
    report.pillars.forEach((row, i) => {
      const x = 0.5 + i * 4.15;
      panel(pptx, slide, x, 1.55, 3.98, 4.75);
      text(
        slide,
        compact(pillarLabel(data, row.pillar), 40),
        x + 0.2,
        1.72,
        3.58,
        0.7,
        20,
        ink,
        true,
      );
      text(
        slide,
        renderTemplate(mapping.pillarCount, { count: row.items.length, total: row.catalogTotal }),
        x + 0.2,
        2.45,
        3.58,
        0.3,
        14,
        slate,
        true,
      );
      if (row.items.length === 0) {
        text(slide, mapping.pillarNone, x + 0.2, 2.9, 3.58, 0.9, 14);
        return;
      }
      text(
        slide,
        (['essential', 'recommended', 'consider'] as const)
          .map((level) => `${mapping.levels[level]} ${row.levels[level]}`)
          .join(' · '),
        x + 0.2,
        2.8,
        3.58,
        0.3,
        12,
      );
      row.items.slice(0, 7).forEach(({ capability }, index) => {
        text(slide, compact(capability.shortName, 38), x + 0.2, 3.2 + index * 0.31, 3.58, 0.26, 13);
      });
      if (row.items.length > 7)
        text(slide, `+${row.items.length - 7}`, x + 0.2, 3.2 + 7 * 0.31, 3.58, 0.26, 12, slate);
      text(
        slide,
        compact(
          renderTemplate(mapping.pillarFlags, { premium: row.premium, notInGcc: row.notInGcc }),
          90,
        ),
        x + 0.2,
        5.65,
        3.58,
        0.55,
        11,
        slate,
      );
    });

    slide = frame('summary', copy.summary);
    (['essential', 'recommended', 'consider'] as const).forEach((level, i) => {
      const x = 0.5 + i * 4.15;
      panel(pptx, slide, x, 1.55, 3.98, 4.35);
      text(slide, String(metrics.levels[level]), x + 0.2, 1.75, 3.58, 0.95, 60, ink, true);
      text(slide, mapping.levels[level], x + 0.2, 2.85, 3.58, 0.4, 22, ink, true);
      text(slide, report.summary[i]!, x + 0.2, 3.5, 3.58, 2.1, 16);
    });
    text(
      slide,
      `${copy.foundational}: ${metrics.foundational} · ${copy.premium}: ${metrics.premium} · ${mapping.readinessLabel}: ${describeReadiness(metrics.readiness, mapping)}`,
      0.5,
      6.02,
      12.3,
      0.32,
      12,
    );
    text(
      slide,
      `${copy.platform}: ${metrics.platform} · ${copy.both}: ${metrics.both} · ${copy.agent}: ${metrics.agent}`,
      0.5,
      6.24,
      12.3,
      0.2,
      12,
    );

    slide = frame('anatomy', copy.anatomy);
    result.anatomy.forEach(({ point, capabilities }, i) => {
      const x = 0.5 + (i % 4) * 3.1;
      const y = 1.55 + Math.floor(i / 4) * 2.32;
      panel(pptx, slide, x, y, 2.95, 2.1);
      text(slide, point.layer, x + 0.15, y + 0.15, 2.65, 0.7, 18, ink, true);
      text(
        slide,
        compact(
          capabilities.map((r) => r.capability.shortName).join('; ') || mapping.unknownAnswer,
          95,
        ),
        x + 0.15,
        y + 0.98,
        2.65,
        0.94,
        14,
      );
    });

    slide = frame('riskControls', copy.riskControls);
    const riskRows = result.risks.slice(0, 3);
    if (riskRows.length === 0) text(slide, mapping.noRisks, 0.5, 2.0, 12.3, 0.8, 24);
    riskRows.forEach(({ risk, inScope }, i) => {
      const y = 1.55 + i * 1.5;
      panel(pptx, slide, 0.5, y, 12.3, 1.3);
      text(slide, compact(risk.title, 65), 0.7, y + 0.15, 4.0, 0.55, 18, ink, true);
      text(slide, '→', 4.9, y + 0.42, 0.6, 0.5, 28);
      text(
        slide,
        compact(
          inScope.map((id) => data.capabilities.find((c) => c.id === id)!.shortName).join('; ') ||
            copy.empty,
          200,
        ),
        5.7,
        y + 0.15,
        6.85,
        0.94,
        15,
      );
    });

    slide = frame('guardrails', copy.exhibits.guardrails);
    report.guardrails.gates.forEach(({ gate, items }, i) => {
      const x = 0.5 + i * 4.15;
      panel(pptx, slide, x, 1.55, 3.98, 4.5);
      text(slide, compact(gate.title, 30), x + 0.2, 1.75, 3.58, 0.45, 22, ink, true);
      if (items.length === 0) text(slide, copy.empty, x + 0.2, 2.5, 3.58, 0.7, 16);
      // The slide is a summary: gaps first, then what to confirm. The readout and the notes list every guardrail.
      const shown = byUrgency(items).slice(0, 4);
      shown.forEach(({ item, status }, index) => {
        const y = 2.4 + index * 0.82;
        text(slide, data.guardrails.statusLabels[status], x + 0.2, y, 3.58, 0.22, 12, slate, true);
        text(slide, compact(item.title, 56), x + 0.2, y + 0.26, 3.58, 0.5, 13, ink, true);
      });
      if (items.length > shown.length)
        text(
          slide,
          `+${items.length - shown.length}`,
          x + 0.2,
          2.4 + 4 * 0.82,
          3.58,
          0.25,
          12,
          slate,
        );
    });
    text(
      slide,
      compact(renderTemplate(data.guardrails.summary, report.guardrails.counts), 120),
      0.5,
      6.2,
      12.3,
      0.35,
      15,
      slate,
    );

    slide = frame('roadmap', copy.roadmap);
    ([1, 2, 3] as const).forEach((wave, i) => {
      const x = 0.5 + i * 4.15;
      panel(pptx, slide, x, 1.55, 3.98, 4.55);
      text(slide, copy.waves[wave], x + 0.2, 1.8, 3.58, 0.5, 26, ink, true);
      const rows = result.inScope.filter((r) => r.wave === wave);
      if (rows.length === 0) text(slide, copy.empty, x + 0.2, 2.65, 3.58, 0.7, 16);
      rows.slice(0, 5).forEach((row, index) => {
        const y = 2.65 + index * 0.65;
        text(slide, compact(row.capability.shortName, 30), x + 0.2, y, 3.58, 0.25, 14, ink, true);
        text(slide, compact(row.ownerTeam, 36), x + 0.2, y + 0.3, 3.58, 0.25, 13, slate);
      });
    });

    slide = frame('licensing', copy.exhibits.licensing, true);
    panel(pptx, slide, 0.5, 1.65, 5.6, 4.5);
    text(slide, copy.eligibility, 0.75, 1.9, 5.1, 0.9, 24, ink, true);
    text(
      slide,
      compact(result.licensing.basis ?? mapping.licenseBasisConfirm, 250),
      0.75,
      3.0,
      5.1,
      1.5,
      18,
    );
    text(
      slide,
      `${mapping.expectedUsers}: ${result.licensing.expectedUsersLabel ?? mapping.unknownAnswer}`,
      0.75,
      4.95,
      5.1,
      0.85,
      16,
    );
    text(slide, compact(copy.verifyNext, 280), 6.6, 1.9, 6.1, 1.6, 24, white, true);
    text(slide, compact(result.licensing.note, 370), 6.6, 3.9, 6.1, 1.95, 17, white);
    return await blob(pptx);
  } catch (error) {
    if (error instanceof PresentationError) throw error;
    // The third-party writer has no stable error type; preserve its cause at the export boundary.
    throw new PresentationError({ cause: error });
  }
}

export async function canvasPowerPoint(
  data: Content,
  version: string,
  report?: Readout,
): Promise<Blob> {
  try {
    const copy = data.site.readout;
    const fields = canvasFields(data, report);
    const controls = report
      ? report.result.anatomy
          .map(
            ({ point, capabilities }) =>
              `${point.layer}: ${capabilities.map((r) => r.capability.shortName).join(', ') || data.site.mapping.unknownAnswer}`,
          )
          .join('\n')
      : data.controlPoints.map((point) => point.layer).join('\n');
    const notes = [
      copy.canvas,
      report ? `${report.name} — ${report.organizationName}` : copy.blankCanvas,
      copy.draft,
      version,
      copy.canvasNote,
      ...fields.map((field) => `${field.title}\n${field.body}`),
      `${data.site.mapping.inScope}\n${controls}`,
      ...(report
        ? [readoutMarkdown(data, report)]
        : data.sources.map((source) => `${source.title}: ${source.url}`)),
      data.site.disclaimer,
    ].join('\n\n');
    const pptx = await presentation(data, copy.canvas);
    const slide = slideFrame(pptx, data, copy.canvas, version, notes, report?.logo);
    text(
      slide,
      compact(report ? `${report.name} — ${report.organizationName}` : copy.blankCanvas, 130),
      0.5,
      1.3,
      12.3,
      0.3,
      14,
    );
    if (report)
      text(
        slide,
        compact(
          report.pillars.map((row) => `${row.pillar.requirement}: ${row.items.length}`).join(' · '),
          120,
        ),
        0.5,
        1.58,
        12.3,
        0.2,
        11,
        slate,
      );
    fields.forEach((field, i) => {
      const x = 0.5 + (i % 5) * 2.49;
      const y = 1.8 + Math.floor(i / 5) * 1.57;
      panel(pptx, slide, x, y, 2.34, 1.43);
      text(slide, field.title, x + 0.12, y + 0.12, 2.1, 0.48, 14, ink, true);
      text(slide, compact(field.body, 65), x + 0.12, y + 0.68, 2.1, 0.63, 12);
    });
    panel(pptx, slide, 0.5, 4.94, 12.3, 1.46);
    text(slide, data.site.mapping.inScope, 0.65, 5.04, 12.0, 0.25, 14, ink, true);
    [...data.controlPoints]
      .sort((a, b) => a.order - b.order)
      .forEach((point, index) => {
        const x = 0.65 + index * (12 / 7);
        text(slide, point.layer, x, 5.35, 1.6, 0.5, 12, ink, true);
        if (report) {
          const rows = report.result.anatomy.find((row) => row.point.id === point.id)!.capabilities;
          text(
            slide,
            compact(
              rows.map((row) => row.capability.shortName).join('; ') ||
                data.site.mapping.unknownAnswer,
              24,
            ),
            x,
            5.94,
            1.6,
            0.4,
            12,
          );
        }
      });
    return await blob(pptx);
  } catch (error) {
    if (error instanceof PresentationError) throw error;
    throw new PresentationError({ cause: error });
  }
}
