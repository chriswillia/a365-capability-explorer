import { describe, expect, it } from 'vitest';
import { licensingTier, sourcesDiffer } from './derive.ts';
import { content } from './index.ts';
import { AUDIENCES } from './schemas.ts';
import {
  agendaText,
  briefText,
  buildBrief,
  defaultConcerns,
  discoveryAreas,
  parseConcerns,
  themeViews,
} from './value.ts';

const views = themeViews(content);

describe('themeViews', () => {
  it('lists the themes by requirement area, then as written', () => {
    const order = new Map(content.pillars.map((pillar) => [pillar.id, pillar.order]));
    const orders = views.map((view) => order.get(view.theme.pillar) ?? 0);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(views.map((view) => view.theme.id).sort()).toEqual(
      content.value.themes.items.map((theme) => theme.id).sort(),
    );
  });

  it('places every capability in exactly one theme', () => {
    expect(views.flatMap((view) => view.capabilities.map((c) => c.id)).sort()).toEqual(
      content.capabilities.map((c) => c.id).sort(),
    );
  });

  it('counts premium capabilities from the catalog and names where they are configured', () => {
    for (const view of views) {
      expect(view.premium).toBe(
        view.capabilities.filter((c) => licensingTier(c) === 'premium').length,
      );
      expect(view.productAreas.length).toBeGreaterThan(0);
      for (const area of view.productAreas)
        expect(content.consoles.map((c) => c.displayName)).toContain(area);
    }
  });
});

describe('defaultConcerns', () => {
  const themeIds = content.value.themes.items.map((theme) => theme.id);

  it.each(AUDIENCES)('pre-selects real themes for the %s seller', (audience) => {
    const ids = defaultConcerns(content, audience);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(themeIds).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives the joint view everything either seller starts with', () => {
    const joint = new Set(defaultConcerns(content, 'joint'));
    for (const id of [...defaultConcerns(content, 'ai'), ...defaultConcerns(content, 'security')])
      expect(joint).toContain(id);
  });

  it('starts each seller type with different outcomes', () => {
    expect(defaultConcerns(content, 'ai')).not.toEqual(defaultConcerns(content, 'security'));
  });
});

describe('parseConcerns', () => {
  it('returns null when nothing usable is named', () => {
    expect(parseConcerns(null, content)).toBeNull();
    expect(parseConcerns('', content)).toBeNull();
    expect(parseConcerns('not-a-theme', content)).toBeNull();
  });

  it('reads "none" as a deliberately empty choice', () => {
    expect(parseConcerns('none', content)).toEqual([]);
  });

  it('keeps known themes once and drops the rest', () => {
    expect(parseConcerns('see-every-agent,bogus,see-every-agent,control-reach', content)).toEqual([
      'see-every-agent',
      'control-reach',
    ]);
  });
});

describe('buildBrief', () => {
  const themeIds = ['control-reach', 'see-every-agent'];

  it('titles the brief with the customer when one is given', () => {
    const named = buildBrief(content, {
      audience: 'ai',
      themeIds,
      customer: '  Fictional Contoso ',
    });
    expect(named.title).toContain('Fictional Contoso');
    expect(buildBrief(content, { audience: 'ai', themeIds, customer: '' }).title).toBe(
      content.value.brief.untitledTitle,
    );
  });

  it('includes only the chosen outcomes, in display order', () => {
    const brief = buildBrief(content, { audience: 'joint', themeIds, customer: '' });
    expect(brief.outcomes.map((outcome) => outcome.id)).toEqual(
      views.map((view) => view.theme.id).filter((id) => themeIds.includes(id)),
    );
  });

  it('adds the angle for the chosen seller type, or both together', () => {
    const labels = (audience: 'ai' | 'security' | 'joint') =>
      buildBrief(content, { audience, themeIds, customer: '' }).outcomes[0]?.angles.map(
        (angle) => angle.label,
      );
    expect(labels('ai')).toEqual([content.value.pitch.audiences.ai.label]);
    expect(labels('security')).toEqual([content.value.pitch.audiences.security.label]);
    expect(labels('joint')).toEqual([
      content.value.pitch.audiences.ai.label,
      content.value.pitch.audiences.security.label,
    ]);
  });

  it('lists each capability once with its product area and licensing tier', () => {
    const brief = buildBrief(content, { audience: 'ai', themeIds, customer: '' });
    const ids = brief.capabilities.map((capability) => capability.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const capability of brief.capabilities) {
      const source = content.capabilities.find((c) => c.id === capability.id);
      expect(source).toBeDefined();
      expect(capability.tier).toBe(licensingTier(source!));
    }
    const expected = views
      .filter((view) => themeIds.includes(view.theme.id))
      .flatMap((view) => view.capabilities.map((c) => c.id));
    expect(ids.sort()).toEqual([...new Set(expected)].sort());
  });

  it('is empty when no outcome is chosen', () => {
    const brief = buildBrief(content, { audience: 'ai', themeIds: [], customer: '' });
    expect(brief.outcomes).toEqual([]);
    expect(brief.capabilities).toEqual([]);
  });
});

describe('briefText', () => {
  it('writes the title, outcomes, capabilities, licensing line and next steps as Markdown', () => {
    const brief = buildBrief(content, {
      audience: 'security',
      themeIds: ['protect-data'],
      customer: 'Fictional Contoso',
    });
    const text = briefText(content, brief);
    expect(text.startsWith(`# ${brief.title}`)).toBe(true);
    for (const outcome of brief.outcomes) expect(text).toContain(outcome.title);
    for (const capability of brief.capabilities) expect(text).toContain(capability.shortName);
    expect(text).toContain(brief.licensingLine);
    brief.nextItems.forEach((item, index) => expect(text).toContain(`${index + 1}. ${item}`));
    expect(text).toContain(brief.footnote);
  });

  it('states no price', () => {
    const text = briefText(
      content,
      buildBrief(content, { audience: 'joint', themeIds: ['see-every-agent'], customer: '' }),
    );
    expect(text).not.toMatch(/[$€£]\s?\d/);
  });

  it('says so when the sources classify a capability differently, as every other page does', () => {
    const everyTheme = content.value.themes.items.map((theme) => theme.id);
    const brief = buildBrief(content, { audience: 'joint', themeIds: everyTheme, customer: '' });
    const differing = brief.capabilities.filter((capability) => capability.sourcesDiffer);
    expect(differing.map((capability) => capability.id).sort()).toEqual(
      content.capabilities
        .filter(sourcesDiffer)
        .map((capability) => capability.id)
        .sort(),
    );
    expect(differing.length).toBeGreaterThan(0);
    const { badges } = content.site.ui;
    const text = briefText(content, brief);
    for (const capability of brief.capabilities) {
      const tier = capability.tier === 'foundational' ? badges.foundational : badges.premium;
      const line = text
        .split('\n')
        .find((entry) => entry.startsWith(`- ${capability.shortName} (`));
      expect(line, capability.id).toBeDefined();
      expect(line!.includes(badges.sourcesDiffer), capability.id).toBe(capability.sourcesDiffer);
      expect(line, capability.id).toContain(tier);
    }
  });
});

describe('discoveryAreas', () => {
  const areas = discoveryAreas(content);

  it('groups the questions by requirement area, in area order', () => {
    const order = content.pillars.map((pillar) => pillar.order);
    expect(areas.map((area) => area.pillar.order)).toEqual(
      [...order].sort((a, b) => a - b).filter((o) => areas.some((a) => a.pillar.order === o)),
    );
  });

  it('keeps every question every capability suggests, once, under the capability’s own area', () => {
    const expected = content.capabilities.flatMap((capability) =>
      (capability.discoveryQuestions ?? []).map((question, index) => ({
        key: `${capability.id}:${index}`,
        question,
        pillar: capability.pillar,
      })),
    );
    expect(expected.length).toBeGreaterThan(0);
    const found = areas.flatMap((area) =>
      area.questions.map((item) => ({
        key: item.key,
        question: item.question,
        pillar: area.pillar.id,
      })),
    );
    expect(found.sort((a, b) => a.key.localeCompare(b.key))).toEqual(
      expected.sort((a, b) => a.key.localeCompare(b.key)),
    );
    expect(new Set(found.map((item) => item.key)).size).toBe(found.length);
  });

  it('names the capability each question comes from, and leaves out an area with no questions', () => {
    for (const area of areas) {
      expect(area.questions.length).toBeGreaterThan(0);
      for (const item of area.questions) {
        const capability = content.capabilities.find((c) => c.id === item.key.split(':')[0])!;
        expect(item.capability).toBe(capability.shortName);
      }
    }
  });
});

describe('agendaText', () => {
  const { agendaTitle, agendaIntro } = content.value.discovery;

  it('puts the title and the introduction first, then the questions in the order picked', () => {
    const text = agendaText(content, [{ question: 'Second asked first?' }, { question: 'First?' }]);
    expect(text.split('\n')).toEqual([
      `# ${agendaTitle}`,
      '',
      agendaIntro,
      '',
      '1. Second asked first?',
      '2. First?',
    ]);
  });

  it('is only the heading and the introduction when nothing is picked', () => {
    expect(agendaText(content, []).split('\n')).toEqual([`# ${agendaTitle}`, '', agendaIntro, '']);
  });
});
