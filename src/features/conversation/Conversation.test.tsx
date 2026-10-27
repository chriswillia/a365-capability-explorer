import { FluentProvider } from '@fluentui/react-components';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, matchRoutes } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '../../app/routes.tsx';
import { requirementGuides } from '../../lib/content/conversation.ts';
import { content, pillarName } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { DepthProvider } from '../../lib/state/DepthProvider.tsx';
import { fluentTheme } from '../../theme/fluentTheme.ts';
import './ConversationPage.tsx';

const { site, conversation: copy } = content;

async function renderPage() {
  const router = createMemoryRouter(routes, { initialEntries: ['/conversation'] });
  render(
    <FluentProvider theme={fluentTheme}>
      <DepthProvider>
        <RouterProvider router={router} />
      </DepthProvider>
    </FluentProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: site.routes.conversation.title });
  return router;
}

describe('customer conversation guide', () => {
  it('opens with the introduction, the draft marker and the steps in order', async () => {
    await renderPage();
    const main = within(screen.getByRole('main'));
    expect(main.getByText(copy.introduction)).toBeInTheDocument();
    expect(main.getAllByText(site.ui.badges.draft).length).toBeGreaterThan(0);
    const steps = within(main.getByRole('region', { name: copy.stepsTitle }));
    const items = steps.getAllByRole('listitem');
    expect(items).toHaveLength(copy.steps.length);
    for (const [i, step] of copy.steps.entries()) {
      const item = within(items[i]!);
      expect(item.getByRole('heading', { level: 3, name: step.title })).toBeInTheDocument();
      expect(item.getByText(step.instruction)).toBeInTheDocument();
      if (step.action)
        expect(item.getByRole('link', { name: step.action.label })).toHaveAttribute(
          'href',
          step.action.to,
        );
    }
  });

  it('covers each requirement area with its capabilities, questions, people and flags', async () => {
    await renderPage();
    const main = within(screen.getByRole('main'));
    for (const guide of requirementGuides(content)) {
      const section = within(main.getByRole('region', { name: pillarName(guide.pillar) }));
      expect(section.getByText(guide.pillar.definition, { exact: false })).toBeInTheDocument();
      for (const capability of guide.capabilities)
        expect(section.getByRole('link', { name: capability.shortName })).toHaveAttribute(
          'href',
          `/capabilities/${capability.id}`,
        );
      expect(
        section.getByRole('heading', {
          level: 4,
          name: renderTemplate(copy.questionsLabel, { count: guide.questions.length }),
        }),
      ).toBeInTheDocument();
      for (const { question } of guide.questions)
        expect(section.getByText(question, { exact: false })).toBeInTheDocument();
      for (const { team, productAreas } of guide.people)
        expect(section.getByText(`${team} — ${productAreas.join(', ')}`)).toBeInTheDocument();
      expect(
        section.getByText(
          renderTemplate(copy.flagsTemplate, {
            premium: guide.premium,
            total: guide.total,
            notInGcc: guide.notInGcc,
          }),
        ),
      ).toBeInTheDocument();
      expect(
        section.getByRole('link', {
          name: renderTemplate(copy.browse, { label: pillarName(guide.pillar) }),
        }),
      ).toHaveAttribute('href', `/capabilities?pillar=${guide.pillar.id}`);
    }
  });

  it('jumps to each requirement area from a labelled list', async () => {
    await renderPage();
    const jump = within(screen.getByRole('navigation', { name: copy.jumpLabel }));
    for (const { pillar } of requirementGuides(content)) {
      const link = jump.getByRole('link', { name: pillarName(pillar) });
      expect(link).toHaveAttribute('href', `#requirement-${pillar.id}`);
      expect(document.getElementById(`requirement-${pillar.id}`)).not.toBeNull();
    }
  });

  it('counts the myth-and-fact answers that still need checking against their source', async () => {
    await renderPage();
    const pending = content.faq.filter((item) => item.fact === null).length;
    expect(
      screen.getByText(
        renderTemplate(copy.assumptionsNote, { count: pending, total: content.faq.length }),
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.assumptionsLink })).toHaveAttribute(
      'href',
      '/learn#myths',
    );
  });

  it('only links to pages that exist', async () => {
    await renderPage();
    const links = within(screen.getByRole('main')).getAllByRole('link');
    expect(links.length).toBeGreaterThan(10);
    for (const link of links) {
      const href = link.getAttribute('href')!;
      if (href.startsWith('#')) {
        expect(document.getElementById(href.slice(1)), href).not.toBeNull();
        continue;
      }
      const matches = matchRoutes(routes, href.split(/[?#]/)[0]!);
      expect(matches, href).not.toBeNull();
      const keys = matches!.flatMap((match) => {
        const key = (match.route.handle as { routeKey?: string } | undefined)?.routeKey;
        return key ? [key] : [];
      });
      expect(keys.length, href).toBeGreaterThan(0);
      expect(keys, href).not.toContain('notFound');
    }
  });

  it('ends with next steps that continue the work in the tool', async () => {
    await renderPage();
    const next = within(screen.getByRole('region', { name: copy.nextTitle }));
    for (const item of copy.next)
      expect(next.getByRole('link', { name: item.label })).toHaveAttribute('href', item.to);
  });
});
