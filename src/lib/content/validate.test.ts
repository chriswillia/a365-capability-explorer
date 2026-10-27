import { describe, expect, it } from 'vitest';
import { content } from './index.ts';
import type { Content } from './schemas.ts';
import { validateContent } from './validate.ts';

const clone = (): Content => structuredClone(content);
const NOW = new Date('2026-10-25T00:00:00Z');

describe('validateContent', () => {
  it('validates workshop agenda ids and template placeholders', () => {
    const data = clone();
    data.workshop.agenda.push(structuredClone(data.workshop.agenda[0]!));
    data.workshop.duration = '{missingWorkshopMetric} minutes';
    const errors = validateContent(data, { now: NOW }).errors.join('\n');
    expect(errors).toContain('workshop.yaml agenda id: duplicate');
    expect(errors).toContain('unknown placeholder {missingWorkshopMetric}');
  });
  it('validates canvas ids and question references', () => {
    const data = clone();
    data.site.readout.canvasBoxes[0]!.questionIds = ['missing-question'];
    data.site.readout.canvasBoxes.push(structuredClone(data.site.readout.canvasBoxes[0]!));
    const errors = validateContent(data, { now: NOW }).errors.join('\n');
    expect(errors).toContain('readout.canvasBoxes id: duplicate');
    expect(errors).toContain('unknown question "missing-question"');
  });
  it('validates source and capability references for every learning collection', () => {
    for (const collection of ['flow', 'integration', 'positioning', 'frontier'] as const) {
      const data = clone();
      data.learn[collection][0]!.sourceId = 'missing-source';
      data.learn[collection][0]!.capabilityIds = ['missing-capability'];
      const errors = validateContent(data, { now: NOW }).errors.join('\n');
      expect(errors).toContain('unknown source "missing-source"');
      expect(errors).toContain('unknown capability "missing-capability"');
    }
    const data = clone();
    data.buildingBlocks[0]!.capabilityIds = ['missing-capability'];
    data.glossary[0]!.sourceId = 'missing-source';
    data.faq[0]!.sourceId = 'missing-source';
    expect(validateContent(data, { now: NOW }).errors).toHaveLength(3);
  });

  it('checks duplicate learning ids, glossary aliases, persona anchors and technical sources', () => {
    const data = clone();
    data.buildingBlocks.push(structuredClone(data.buildingBlocks[0]!));
    data.glossary[1]!.aliases = [data.glossary[0]!.term.toUpperCase()];
    data.personas[0]!.href = '/learn#missing';
    data.learn.flow[0]!.technicalSourceId = 'missing-source';
    const errors = validateContent(data, { now: NOW }).errors.join('\n');
    expect(errors).toContain('building-blocks.yaml id: duplicate');
    expect(errors).toContain('glossary.yaml term or alias: duplicate');
    expect(errors).toContain('unknown learning anchor "missing"');
    expect(errors).toContain('technicalSourceId: unknown source "missing-source"');
  });

  it('requires an explicit source for technical guidance and checks learning dates', () => {
    const data = clone();
    data.learn.flow[0]!.technicalSourceId = undefined;
    data.glossary[0]!.lastVerified = '2030-01-01';
    const errors = validateContent(data, { now: NOW }).errors.join('\n');
    expect(errors).toContain('technical text needs a technicalSourceId');
    expect(errors).toContain('glossary.yaml');
    expect(errors).toContain('in the future');
    expect(validateContent(data, { now: NOW }).warnings.join('\n')).toContain('faq.yaml');
  });
  it('passes on the real content, with warnings only for sources awaiting later content', () => {
    const { errors, warnings } = validateContent(clone(), { now: NOW });
    expect(errors).toEqual([]);
    expect(warnings.every((w) => /not referenced|not verified|unsigned/.test(w))).toBe(true);
  });

  it('fails on a duplicate capability id', () => {
    const data = clone();
    data.capabilities.push(structuredClone(data.capabilities[0]!));
    expect(validateContent(data, { now: NOW }).errors.join('\n')).toMatch(
      /duplicate value "registry-inventory"/,
    );
  });

  it('fails on a reference to an unknown source', () => {
    const data = clone();
    data.capabilities[0]!.sourceNotes = [{ sourceId: 'no-such-source', note: 'x' }];
    expect(validateContent(data, { now: NOW }).errors.join('\n')).toMatch(
      /unknown source "no-such-source"/,
    );
  });

  it('flags an orphaned source: a warning by default, an error when asked to fail', () => {
    const data = clone();
    data.sources.push({
      id: 'unused-source',
      title: 'Unused',
      url: 'https://example.com/',
      publisher: 'Example',
      lastVerified: '2026-10-23',
    });
    const lenient = validateContent(data, { now: NOW });
    expect(lenient.errors).toEqual([]);
    expect(lenient.warnings.join('\n')).toMatch(/unused-source: not referenced/);

    const strict = validateContent(data, { now: NOW, failOnOrphanedSources: true });
    expect(strict.errors.join('\n')).toMatch(/unused-source: not referenced/);
  });

  it('warns when lastVerified is more than 90 days old', () => {
    const later = new Date('2027-02-01T00:00:00Z');
    expect(validateContent(clone(), { now: later }).warnings.join('\n')).toMatch(
      /days old \(limit 90\)/,
    );
  });

  it('fails when lastVerified is in the future', () => {
    const data = clone();
    data.capabilities[0]!.source.lastVerified = '2030-01-01';
    expect(validateContent(data, { now: NOW }).errors.join('\n')).toMatch(/in the future/);
  });

  it('fails on a template placeholder the app does not compute', () => {
    const data = clone();
    data.site.overview.exhibits.glance.titleTemplate = '{capabilityCount} and {notAMetric}';
    expect(validateContent(data, { now: NOW }).errors.join('\n')).toMatch(
      /unknown placeholder \{notAMetric\}/,
    );
  });

  it('fails on unbalanced braces in site copy', () => {
    const data = clone();
    data.site.overview.heroLede = 'Broken {capabilityCount';
    expect(validateContent(data, { now: NOW }).errors.join('\n')).toMatch(
      /unbalanced or malformed/,
    );
  });

  it('fails when a taxonomy file is missing an id the types require', () => {
    const data = clone();
    data.controlPoints = data.controlPoints.filter((cp) => cp.id !== 'network');
    expect(validateContent(data, { now: NOW }).errors.join('\n')).toMatch(
      /missing entry for "network"/,
    );
  });

  it('fails on duplicate display order within a taxonomy', () => {
    const data = clone();
    data.pillars[1]!.order = data.pillars[0]!.order;
    expect(validateContent(data, { now: NOW }).errors.join('\n')).toMatch(
      /pillars.yaml order: duplicate/,
    );
  });

  it('checks the changelog: unknown capability fails, "all" is allowed', () => {
    const data = clone();
    data.changelog = [
      { date: '2026-10-23', title: 'Edit', affects: ['all', 'no-such-capability'], body: '' },
    ];
    const errors = validateContent(data, { now: NOW }).errors.join('\n');
    expect(errors).toMatch(/unknown capability "no-such-capability"/);
    expect(errors).not.toMatch(/unknown capability "all"/);
  });

  it('reserves the id "all"', () => {
    const data = clone();
    data.capabilities[0]!.id = 'all';
    expect(validateContent(data, { now: NOW }).errors.join('\n')).toMatch(/"all" is reserved/);
  });
});
