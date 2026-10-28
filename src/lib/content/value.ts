import { licensingTier, sourcesDiffer, type LicensingTier } from './derive.ts';
import type { AudienceId, Capability, Content, PillarDef } from './schemas.ts';
import { renderTemplate } from './template.ts';

type Theme = Content['value']['themes']['items'][number];

export interface ThemeView {
  theme: Theme;
  pillar: PillarDef;
  capabilities: Capability[];
  /** Capabilities that need Microsoft 365 E7/G7 or Agent 365. */
  premium: number;
  /** Where the capabilities are configured, in console order. */
  productAreas: string[];
}

/** The value themes in display order: by requirement area, then as written in value.yaml. */
export function themeViews(data: Content): ThemeView[] {
  const pillars = new Map(data.pillars.map((pillar) => [pillar.id, pillar]));
  const capabilities = new Map(data.capabilities.map((capability) => [capability.id, capability]));
  const consoles = new Map(data.consoles.map((console_) => [console_.id, console_]));
  const entries: { index: number; view: ThemeView }[] = [];
  for (const [index, theme] of data.value.themes.items.entries()) {
    const pillar = pillars.get(theme.pillar);
    if (pillar === undefined) continue;
    const members = theme.capabilityIds.flatMap((id) => {
      const capability = capabilities.get(id);
      return capability === undefined ? [] : [capability];
    });
    const areas = [...new Set(members.map((capability) => capability.source.console))]
      .flatMap((id) => {
        const console_ = consoles.get(id);
        return console_ === undefined ? [] : [console_];
      })
      .sort((a, b) => a.order - b.order)
      .map((console_) => console_.displayName);
    entries.push({
      index,
      view: {
        theme,
        pillar,
        capabilities: members,
        premium: members.filter((capability) => licensingTier(capability) === 'premium').length,
        productAreas: areas,
      },
    });
  }
  return entries
    .sort((a, b) => a.view.pillar.order - b.view.pillar.order || a.index - b.index)
    .map((entry) => entry.view);
}

/** The outcomes pre-selected for a seller type: those of the buyers marked defaultFor that audience. */
export function defaultConcerns(data: Content, audience: AudienceId): string[] {
  const wanted = new Set(
    data.value.buyers.items
      .filter((buyer) => buyer.defaultFor.includes(audience))
      .flatMap((buyer) => buyer.themeIds),
  );
  return themeViews(data)
    .map((view) => view.theme.id)
    .filter((id) => wanted.has(id));
}

/** Reads the `concerns` address parameter, keeping only themes that exist. "none" means the seller cleared them all. */
export function parseConcerns(raw: string | null, data: Content): string[] | null {
  if (raw === null) return null;
  if (raw === 'none') return [];
  const known = new Set(data.value.themes.items.map((theme) => theme.id));
  const ids = raw.split(',').filter((id) => known.has(id));
  return ids.length === 0 ? null : [...new Set(ids)];
}

export interface BriefOutcome {
  id: string;
  title: string;
  outcome: string;
  angles: { label: string; text: string }[];
}
export interface BriefCapability {
  id: string;
  shortName: string;
  productArea: string;
  tier: LicensingTier;
  /** The service description and the licensing FAQ classify this capability differently. */
  sourcesDiffer: boolean;
}
export interface Brief {
  title: string;
  audienceLine: string;
  outcomesHeading: string;
  outcomes: BriefOutcome[];
  capabilitiesHeading: string;
  capabilities: BriefCapability[];
  licensingLine: string;
  nextHeading: string;
  nextItems: string[];
  footnote: string;
}

export function buildBrief(
  data: Content,
  input: { audience: AudienceId; themeIds: string[]; customer: string },
): Brief {
  const { brief, pitch, themes } = data.value;
  const chosen = new Set(input.themeIds);
  const views = themeViews(data).filter((view) => chosen.has(view.theme.id));
  const customer = input.customer.trim();
  const consoles = new Map(data.consoles.map((console_) => [console_.id, console_.displayName]));
  const seen = new Set<string>();
  const capabilities: BriefCapability[] = [];
  for (const view of views)
    for (const capability of view.capabilities) {
      if (seen.has(capability.id)) continue;
      seen.add(capability.id);
      capabilities.push({
        id: capability.id,
        shortName: capability.shortName,
        productArea: consoles.get(capability.source.console) ?? capability.source.console,
        tier: licensingTier(capability),
        sourcesDiffer: sourcesDiffer(capability),
      });
    }
  const angleFor = (theme: Theme): BriefOutcome['angles'] => {
    const ai = { label: pitch.audiences.ai.label, text: theme.angle.ai };
    const security = { label: pitch.audiences.security.label, text: theme.angle.security };
    return input.audience === 'ai'
      ? [ai]
      : input.audience === 'security'
        ? [security]
        : [ai, security];
  };
  return {
    title:
      customer === '' ? brief.untitledTitle : renderTemplate(brief.titleTemplate, { customer }),
    audienceLine: renderTemplate(brief.audienceLine, {
      label: pitch.audiences[input.audience].label,
    }),
    outcomesHeading: themes.heading,
    outcomes: views.map((view) => ({
      id: view.theme.id,
      title: view.theme.title,
      outcome: view.theme.outcome,
      angles: angleFor(view.theme),
    })),
    capabilitiesHeading: brief.capabilitiesHeading,
    capabilities,
    licensingLine: brief.licensingLine,
    nextHeading: brief.nextHeading,
    nextItems: brief.nextItems,
    footnote: brief.footnote,
  };
}

/** The brief as plain Markdown, for copying into an email or a document. */
export function briefText(data: Content, brief: Brief): string {
  const { badges } = data.site.ui;
  const lines: string[] = [`# ${brief.title}`, '', brief.audienceLine, ''];
  lines.push(`## ${brief.outcomesHeading}`, '');
  for (const outcome of brief.outcomes) {
    lines.push(`- **${outcome.title}.** ${outcome.outcome}`);
    for (const angle of outcome.angles) lines.push(`  - ${angle.label}: ${angle.text}`);
  }
  lines.push('', `## ${brief.capabilitiesHeading}`, '');
  for (const capability of brief.capabilities) {
    const tier = capability.tier === 'foundational' ? badges.foundational : badges.premium;
    const details = [capability.productArea, tier];
    if (capability.sourcesDiffer) details.push(badges.sourcesDiffer);
    lines.push(`- ${capability.shortName} (${details.join('; ')})`);
  }
  lines.push('', brief.licensingLine, '', `## ${brief.nextHeading}`, '');
  brief.nextItems.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  lines.push('', brief.footnote);
  return lines.join('\n');
}
