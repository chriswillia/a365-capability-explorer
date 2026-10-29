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
import { DEPTH_STORAGE_KEY } from '../../lib/state/depth.ts';
import { STORAGE_PREFIX } from '../../lib/state/storage.ts';
import { StateProviders } from '../../lib/state/StateProviders.tsx';
import { fluentTheme } from '../../theme/fluentTheme.ts';

const { site, value: copy } = content;
const views = themeViews(content);

async function renderPage(path = '/brief') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <FluentProvider theme={fluentTheme}>
      <StateProviders>
        <RouterProvider router={router} />
      </StateProviders>
    </FluentProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: site.routes.brief.title });
  return router;
}
const concerns = () =>
  within(screen.getByRole('group', { name: copy.brief.concernsLegend })).getAllByRole(
    'checkbox',
  ) as HTMLInputElement[];
const param = (router: Awaited<ReturnType<typeof renderPage>>, key: string) =>
  new URLSearchParams(router.state.location.search).get(key);

afterEach(() => vi.restoreAllMocks());

describe('Value brief page', () => {
  it('says what it is for, and keeps the editorial notice behind the page', async () => {
    await renderPage();
    expect(screen.getByText(site.routes.brief.description)).toBeInTheDocument();
    expect(screen.getByText(copy.notice)).toBeInTheDocument();
    expect(screen.queryByText(site.ui.badges.draft)).not.toBeInTheDocument();
  });

  it('marks the notice as needing review in the Technical view', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}${DEPTH_STORAGE_KEY}`, 'technical');
    await renderPage();
    expect(screen.getByText(site.ui.badges.draft)).toBeInTheDocument();
  });

  it('puts the Selling as switch beside the brief it changes, and remembers the choice', async () => {
    const user = userEvent.setup();
    await renderPage();
    const group = screen.getByRole('group', { name: site.ui.audience.groupLabel });
    expect(screen.getByRole('main')).toContainElement(group);
    expect(group).toHaveAccessibleDescription(site.ui.audience.hint);
    expect(within(group).getByRole('button', { name: site.ui.audience.joint })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(within(group).getByRole('button', { name: site.ui.audience.ai }));
    expect(within(group).getByRole('button', { name: site.ui.audience.ai })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}${AUDIENCE_STORAGE_KEY}`)).toBe('ai');
    expect(
      within(screen.getByRole('article')).getByText(
        renderTemplate(copy.brief.audienceLine, { label: copy.brief.audiences.ai }),
      ),
    ).toBeInTheDocument();
  });

  it('changes the emphasis for each seller and never the facts', async () => {
    const user = userEvent.setup();
    const chosen = views.slice(0, 3);
    await renderPage(`/brief?concerns=${chosen.map((view) => view.theme.id).join(',')}`);
    const group = screen.getByRole('group', { name: site.ui.audience.groupLabel });
    const article = () => within(screen.getByRole('article'));
    const capabilities = () =>
      article().getByRole('heading', { level: 4, name: copy.brief.capabilitiesHeading })
        .nextElementSibling!.textContent;
    await user.click(within(group).getByRole('button', { name: site.ui.audience.ai }));
    const ai = { text: screen.getByRole('article').textContent, capabilities: capabilities() };
    await user.click(within(group).getByRole('button', { name: site.ui.audience.security }));
    const security = {
      text: screen.getByRole('article').textContent,
      capabilities: capabilities(),
    };
    expect(ai.text).not.toBe(security.text);
    expect(ai.capabilities).toBe(security.capabilities);
    for (const view of chosen) {
      expect(security.text).toContain(view.theme.angle.security);
      expect(security.text).not.toContain(view.theme.angle.ai);
      expect(ai.text).toContain(view.theme.angle.ai);
    }
  });

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
    expect(param(router, 'concerns')).toBe('none');
    expect(param(router, 'view')).toBeNull();
    expect(screen.getByText(copy.brief.emptyNote)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.brief.print })).toBeDisabled();
    expect(screen.getByRole('button', { name: copy.brief.copy })).toBeDisabled();

    await user.click(concerns()[1]!);
    expect(param(router, 'concerns')).toBe(views[1]!.theme.id);
    expect(screen.getByRole('button', { name: copy.brief.copy })).toBeEnabled();
  });

  it('restores the choice from the address', async () => {
    await renderPage(`/brief?concerns=${views[2]!.theme.id}`);
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
    // The heading and the choices stay off the paper, so only the brief prints.
    expect(
      screen
        .getByRole('heading', { level: 1, name: site.routes.brief.title })
        .closest('[data-no-print]'),
    ).not.toBeNull();
    expect(
      screen.getByRole('group', { name: copy.brief.concernsLegend }).closest('[data-no-print]'),
    ).not.toBeNull();
    expect(printed[0]!.closest('[data-no-print]')).toBeNull();
  });
});
