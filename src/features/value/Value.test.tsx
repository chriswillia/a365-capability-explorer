import { FluentProvider } from '@fluentui/react-components';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes.tsx';
import { content } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { buildBrief, briefText, defaultConcerns, themeViews } from '../../lib/content/value.ts';
import { AUDIENCE_STORAGE_KEY } from '../../lib/state/audience.ts';
import { STORAGE_PREFIX } from '../../lib/state/storage.ts';
import { StateProviders } from '../../lib/state/StateProviders.tsx';
import { fluentTheme } from '../../theme/fluentTheme.ts';
import './ValuePage.tsx';

const { site, value: copy } = content;
const views = themeViews(content);

async function renderPage(path = '/pitch') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <FluentProvider theme={fluentTheme}>
      <StateProviders>
        <RouterProvider router={router} />
      </StateProviders>
    </FluentProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: site.routes.pitch.title });
  return router;
}
const concerns = () =>
  within(screen.getByRole('group', { name: copy.brief.concernsLegend })).getAllByRole(
    'checkbox',
  ) as HTMLInputElement[];

afterEach(() => vi.restoreAllMocks());

describe('Pitch', () => {
  it('opens with the pitch for both sellers and follows the Selling as switch', async () => {
    const user = userEvent.setup();
    await renderPage();
    expect(
      screen.getByText(
        renderTemplate(copy.audienceNote, { label: copy.pitch.audiences.joint.label }),
      ),
    ).toBeInTheDocument();
    const group = screen.getByRole('group', { name: site.ui.audience.groupLabel });
    expect(within(group).getByRole('button', { name: site.ui.audience.joint })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(within(group).getByRole('button', { name: site.ui.audience.ai }));
    expect(
      screen.getByText(renderTemplate(copy.audienceNote, { label: copy.pitch.audiences.ai.label })),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}${AUDIENCE_STORAGE_KEY}`)).toBe('ai');
    const pitch = within(document.getElementById('pitch')!);
    for (const beat of copy.pitch.audiences.ai.beats)
      expect(pitch.getAllByText(beat).length).toBeGreaterThan(0);
  });

  it('changes the emphasis for each seller and never the facts', async () => {
    const user = userEvent.setup();
    await renderPage();
    const group = screen.getByRole('group', { name: site.ui.audience.groupLabel });
    const outcomes = () => document.getElementById('outcomes')!.textContent;
    const capabilityLists = () =>
      [...document.querySelectorAll('#outcomes details ul')].map((list) => list.textContent);
    await user.click(within(group).getByRole('button', { name: site.ui.audience.ai }));
    const ai = { text: outcomes(), capabilities: capabilityLists() };
    await user.click(within(group).getByRole('button', { name: site.ui.audience.security }));
    const security = { text: outcomes(), capabilities: capabilityLists() };
    expect(ai.text).not.toBe(security.text);
    expect(ai.capabilities).toEqual(security.capabilities);
    for (const view of views) {
      expect(security.text).toContain(view.theme.angle.security);
      expect(security.text).not.toContain(view.theme.angle.ai);
    }
  });

  it('shows every outcome once, with the capabilities it covers linked to their briefs', async () => {
    await renderPage();
    const section = within(document.getElementById('outcomes')!);
    const linked = new Set<string>();
    for (const view of views) {
      expect(section.getAllByRole('heading', { level: 4, name: view.theme.title })).toHaveLength(1);
      const card = document.getElementById(`theme-${view.theme.id}`)!;
      for (const capability of view.capabilities) {
        expect(
          within(card).getByRole('link', { name: capability.shortName, hidden: true }),
        ).toHaveAttribute('href', `/capabilities/${capability.id}`);
        linked.add(capability.id);
      }
    }
    expect(linked.size).toBe(content.capabilities.length);
  });

  it('answers pushback and shows proof with its kind and caveat', async () => {
    await renderPage();
    for (const item of copy.objections.items) {
      expect(screen.getByText(item.objection)).toBeInTheDocument();
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }
    const proof = within(document.getElementById('proof')!);
    for (const item of copy.proof.items) {
      expect(proof.getByText(item.summary, { exact: false })).toBeInTheDocument();
      if (item.caveat !== undefined) expect(proof.getByText(item.caveat)).toBeInTheDocument();
    }
  });

  it('gives AI and Security sellers a joint plan and a proof-of-value plan', async () => {
    await renderPage();
    const team = within(document.getElementById('team')!);
    const table = team.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(copy.jointPlan.rows.length + 1);
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual([
      copy.jointPlan.columns.topic,
      copy.jointPlan.columns.ai,
      copy.jointPlan.columns.security,
      copy.jointPlan.columns.together,
    ]);
    const proofOfValue = within(document.getElementById('proof-of-value')!);
    for (const step of copy.proofOfValue.steps)
      expect(proofOfValue.getByText(step.title, { exact: false })).toBeInTheDocument();
  });

  it('says who published each statistic, and which are not Microsoft’s own', async () => {
    await renderPage();
    const proof = within(document.getElementById('proof')!);
    const figures = ['29%', '21%', '73%', '1.3 billion'];
    for (const figure of figures)
      expect(proof.getByText(figure, { exact: false })).toBeInTheDocument();
    for (const id of ['governance-maturity', 'top-ai-risk']) {
      const item = copy.proof.items.find((candidate) => candidate.id === id)!;
      expect(item.who).toBe('Deloitte');
      expect(item.caveat).toContain('not a Microsoft figure');
      expect(item.sourceIds).toEqual(['deloitte-state-ai']);
    }
    const survey = copy.proof.items.find((candidate) => candidate.id === 'unsanctioned-agents')!;
    expect(survey.caveat).toContain('commissioned');
  });
});

describe('Pitch: where to start', () => {
  const entry = () => within(document.getElementById('entry')!);

  it('offers a way in for each customer situation, with the licensing path and where it leads', async () => {
    await renderPage();
    for (const item of copy.entryPoints.items) {
      const card = within(
        entry().getByRole('heading', { level: 3, name: item.situation }).closest('li')!,
      );
      expect(card.getByText(item.conversation)).toBeInTheDocument();
      expect(card.getByText(item.licensing)).toBeInTheDocument();
      for (const link of item.links)
        expect(card.getByRole('link', { name: link.label })).toHaveAttribute('href', link.to);
      expect(
        card.getByText(content.sources.find((s) => s.id === item.sourceIds[0])!.title),
      ).toBeInTheDocument();
    }
  });

  it('covers the situations the sellers meet, and every address it links to is a real page', async () => {
    const ids = copy.entryPoints.items.map((item) => item.id);
    for (const id of [
      'has-e5',
      'e3-only',
      'copilot-heavy',
      'foundry-builders',
      'third-party-agents',
      'frontline',
      'gcc',
    ])
      expect(ids).toContain(id);
    const pages = new Set(['/map', '/fit', '/licensing', '/capabilities', '/pitch', '/diagnostic']);
    for (const link of copy.entryPoints.items.flatMap((item) => item.links))
      expect(pages.has(link.to.split('#')[0]!)).toBe(true);
  });
});

describe('Pitch: questions to ask', () => {
  const picker = () => within(document.getElementById('questions')!);
  const openAll = async (user: ReturnType<typeof userEvent.setup>) => {
    for (const summary of picker().getAllByText(/ · \d+$/)) await user.click(summary);
  };

  it('groups every capability question by area, and picks nothing at first', async () => {
    const user = userEvent.setup();
    await renderPage();
    await openAll(user);
    const total = content.capabilities.reduce(
      (sum, c) => sum + (c.discoveryQuestions?.length ?? 0),
      0,
    );
    expect(picker().getAllByRole('checkbox')).toHaveLength(total);
    for (const box of picker().getAllByRole('checkbox')) expect(box).not.toBeChecked();
    expect(picker().getByRole('button', { name: copy.discovery.copy })).toBeDisabled();
    expect(
      picker().getByText(
        renderTemplate(copy.discovery.counter, { count: 0, limit: copy.discovery.limit }),
      ),
    ).toBeInTheDocument();
  });

  it('lets the seller pick only as many as the limit, and frees one up when it is cleared', async () => {
    const user = userEvent.setup();
    await renderPage();
    await openAll(user);
    const boxes = picker().getAllByRole('checkbox');
    for (const box of boxes.slice(0, copy.discovery.limit)) await user.click(box);
    expect(
      picker().getByText(
        renderTemplate(copy.discovery.limitReached, { limit: copy.discovery.limit }),
      ),
    ).toBeInTheDocument();
    expect(boxes[copy.discovery.limit]).toBeDisabled();
    await user.click(boxes[0]!);
    expect(boxes[copy.discovery.limit]).toBeEnabled();
  });

  it('copies the picks as an agenda, in the order picked, and clears them', async () => {
    const user = userEvent.setup();
    await renderPage();
    await openAll(user);
    const boxes = picker().getAllByRole('checkbox');
    await user.click(boxes[3]!);
    await user.click(boxes[1]!);
    await user.click(picker().getByRole('button', { name: copy.discovery.copy }));
    const text = await navigator.clipboard.readText();
    const lines = text.split('\n');
    expect(lines[0]).toBe(`# ${copy.discovery.agendaTitle}`);
    expect(lines).toContain(copy.discovery.agendaIntro);
    expect(lines.filter((line) => /^\d+\. /.test(line))).toHaveLength(2);
    expect(lines.findIndex((l) => l.startsWith('1. '))).toBeLessThan(
      lines.findIndex((l) => l.startsWith('2. ')),
    );
    expect(picker().getByText(copy.discovery.copied)).toBeInTheDocument();
    await user.click(picker().getByRole('button', { name: copy.discovery.clear }));
    for (const box of boxes) expect(box).not.toBeChecked();
    expect(window.localStorage.length).toBe(0);
  });
});

describe('value brief', () => {
  it('starts from the outcomes that suit the chosen seller and shows the brief beside the choices', async () => {
    await renderPage();
    const expected = defaultConcerns(content, 'joint');
    const boxes = concerns();
    expect(boxes).toHaveLength(views.length);
    for (const [index, view] of views.entries())
      expect(boxes[index]!.checked).toBe(expected.includes(view.theme.id));
    const brief = buildBrief(content, { audience: 'joint', themeIds: expected, customer: '' });
    const article = within(screen.getByRole('article', { name: brief.title }));
    for (const outcome of brief.outcomes)
      expect(article.getByText(outcome.title, { exact: false })).toBeInTheDocument();
    expect(article.getByText(brief.licensingLine)).toBeInTheDocument();
  });

  it('keeps the choice in the address and an empty choice says so', async () => {
    const user = userEvent.setup();
    const router = await renderPage();
    for (const box of concerns().filter((candidate) => candidate.checked)) await user.click(box);
    expect(router.state.location.search).toBe('?concerns=none');
    expect(screen.getByText(copy.brief.emptyNote)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.brief.print })).toBeDisabled();
    expect(screen.getByRole('button', { name: copy.brief.copy })).toBeDisabled();

    await user.click(concerns()[1]!);
    expect(router.state.location.search).toBe(`?concerns=${views[1]!.theme.id}`);
    expect(screen.getByRole('button', { name: copy.brief.copy })).toBeEnabled();
  });

  it('restores the choice from the address', async () => {
    await renderPage(`/pitch?concerns=${views[2]!.theme.id}`);
    const checked = concerns().filter((box) => box.checked);
    expect(checked).toHaveLength(1);
    expect(checked[0]).toBe(concerns()[2]);
  });

  it('keeps the customer name out of the address and out of storage', async () => {
    const user = userEvent.setup();
    const router = await renderPage();
    await user.type(screen.getByLabelText(copy.brief.customerLabel), 'Fictional Customer');
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: renderTemplate(copy.brief.titleTemplate, { customer: 'Fictional Customer' }),
      }),
    ).toBeInTheDocument();
    expect(router.state.location.search).not.toContain('Fictional');
    for (let i = 0; i < window.localStorage.length; i++)
      expect(window.localStorage.getItem(window.localStorage.key(i)!)).not.toContain('Fictional');
  });

  it('copies the brief as text and prints only the brief', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    await renderPage();
    await user.click(screen.getByRole('button', { name: copy.brief.copy }));
    const expected = briefText(
      content,
      buildBrief(content, {
        audience: 'joint',
        themeIds: defaultConcerns(content, 'joint'),
        customer: '',
      }),
    );
    expect(await navigator.clipboard.readText()).toBe(expected);
    expect(within(document.getElementById('brief')!).getByRole('status')).toHaveTextContent(
      copy.brief.copied,
    );

    await user.click(screen.getByRole('button', { name: copy.brief.print }));
    expect(print).toHaveBeenCalledTimes(1);
    const printed = document.querySelectorAll('[data-print-document]');
    expect(printed).toHaveLength(1);
    for (const section of document.querySelectorAll('main section'))
      if (!section.contains(printed[0]!)) expect(section).toHaveAttribute('data-no-print');
  });
});
