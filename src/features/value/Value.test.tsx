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
    expect(screen.getByRole('status')).toHaveTextContent(copy.brief.copied);

    await user.click(screen.getByRole('button', { name: copy.brief.print }));
    expect(print).toHaveBeenCalledTimes(1);
    const printed = document.querySelectorAll('[data-print-document]');
    expect(printed).toHaveLength(1);
    for (const section of document.querySelectorAll('main section'))
      if (!section.contains(printed[0]!)) expect(section).toHaveAttribute('data-no-print');
  });
});
