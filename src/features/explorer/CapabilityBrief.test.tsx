import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { accessFit } from '../../lib/content/access-fit.ts';
import { licensingTier } from '../../lib/content/derive.ts';
import { content } from '../../lib/content/index.ts';
import { capabilityRequirements } from '../../lib/content/requirements.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { renderRoute } from '../../test-support/playbook.tsx';
import './CapabilitiesPage.tsx';
import './CapabilityPage.tsx';

const { site, accessPatterns } = content;
const brief = site.capabilities.brief;
const panel = content.licensing.requirementsPanel;
const byId = (id: string) => content.capabilities.find((c) => c.id === id)!;
const section = (name: string) => within(screen.getByRole('region', { name }));

describe('capability brief: what it needs', () => {
  it('lists each requirement with where it applies and what to ask, without choosing an assessment', async () => {
    const capability = byId('defender-shadow-ai');
    await renderRoute(`/capabilities/${capability.id}`, capability.shortName);
    const needs = section(brief.needs);
    const view = capabilityRequirements(content, null).find(
      (entry) => entry.capability.id === capability.id,
    )!;
    expect(view.items.length).toBeGreaterThan(3);
    for (const { item } of view.items) {
      const line = needs.getByText(item.text, { exact: false }).closest('li')!;
      if (item.appliesTo !== undefined)
        expect(
          within(line).getByText(`${panel.levelLabel}: ${panel.levels[item.appliesTo]}`),
        ).toBeInTheDocument();
      expect(within(line).getByText(item.askPrompt!, { exact: false })).toBeInTheDocument();
    }
    for (const entry of view.without)
      expect(needs.getByText(entry.text, { exact: false })).toBeInTheDocument();
    expect(needs.getByRole('link', { name: brief.needsLink })).toHaveAttribute(
      'href',
      '/licensing#requirements',
    );
  });

  it('says a premium capability also needs the Agent 365 license and the plan prerequisites', async () => {
    const premium = content.capabilities.find((c) => licensingTier(c) === 'premium')!;
    await renderRoute(`/capabilities/${premium.id}`, premium.shortName);
    expect(section(brief.needs).getByText(brief.needsPremium)).toBeInTheDocument();
  });

  it('does not say that for an included capability', async () => {
    const foundational = content.capabilities.find((c) => licensingTier(c) === 'foundational')!;
    await renderRoute(`/capabilities/${foundational.id}`, foundational.shortName);
    expect(section(brief.needs).queryByText(brief.needsPremium)).not.toBeInTheDocument();
  });

  it('says so, instead of inventing a requirement, when the sources state none', async () => {
    const view = capabilityRequirements(content, null).find(
      (entry) => entry.items.length === 0 && entry.without.length === 0,
    )!;
    await renderRoute(`/capabilities/${view.capability.id}`, view.capability.shortName);
    expect(section(brief.needs).getByText(panel.noneStated)).toBeInTheDocument();
  });
});

describe('capability brief: how the agent acts', () => {
  it('shows what Microsoft states for each way of acting, with its source', async () => {
    const capability = byId('entra-conditional-access');
    await renderRoute(`/capabilities/${capability.id}`, capability.shortName);
    const access = section(brief.access);
    const fit = accessFit(content, capability.id);
    if (fit.kind !== 'differs') throw new Error('expected a stated difference');
    expect(access.getByText(site.ui.badges.accessDiffers)).toBeInTheDocument();
    expect(access.getByText(fit.row.note)).toBeInTheDocument();
    expect(access.getByText(accessPatterns.applicability.differs, { exact: false })).toBeVisible();
    expect(access.getByRole('link', { name: brief.accessLink })).toHaveAttribute('href', '/access');
  });

  it('says Microsoft does not split a capability, rather than saying it is the same', async () => {
    const capability = byId('observability');
    await renderRoute(`/capabilities/${capability.id}`, capability.shortName);
    const access = section(brief.access);
    expect(access.getByText(site.ui.badges.accessUnsplit)).toBeInTheDocument();
    expect(access.getByText(brief.accessUnsplit)).toBeInTheDocument();
  });
});

describe('capability brief: starting a map', () => {
  it('links to map an agent instead of only naming it', async () => {
    const capability = content.capabilities[0]!;
    await renderRoute(`/capabilities/${capability.id}`, capability.shortName);
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: brief.mapCta }),
    ).toHaveAttribute('href', '/diagnostic');
  });
});

describe('capability cards: access fit', () => {
  it('marks every capability by what Microsoft states about how the agent acts', async () => {
    await renderRoute('/capabilities', site.routes.capabilities.title);
    const kinds = content.capabilities.map((c) => accessFit(content, c.id));
    expect(screen.getAllByText(site.ui.badges.accessDiffers)).toHaveLength(
      kinds.filter((fit) => fit.kind === 'differs').length,
    );
    expect(screen.getAllByText(site.ui.badges.accessUnsplit)).toHaveLength(
      kinds.filter((fit) => fit.kind === 'unsplit').length,
    );
    const own = renderTemplate(site.ui.badges.accessStated, {
      patterns: accessPatterns.columns.own.toLowerCase(),
    });
    expect(screen.getAllByText(own).length).toBeGreaterThan(0);
  });
});
