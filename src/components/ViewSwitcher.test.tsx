import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { content } from '../lib/content/index.ts';
import { useView, type PageView } from '../lib/useView.ts';
import { ViewPager, ViewPane, ViewSwitcher } from './ViewSwitcher.tsx';

const copy = content.site.ui.views;

const VIEWS: PageView[] = [
  { id: 'one', label: 'One', sections: ['alpha'] },
  { id: 'two', label: 'Two', sections: ['beta'], prefixes: ['gamma-'] },
  { id: 'three', label: 'Three', sections: [] },
];

function Probe() {
  const view = useView(VIEWS);
  return (
    <>
      <ViewSwitcher views={VIEWS} current={view} />
      <ViewPane view={view} id="one">
        <h2 id="alpha">First part</h2>
      </ViewPane>
      <ViewPane view={view} id="two">
        <h2 id="beta">Second part</h2>
        <p id="gamma-1">Built from data</p>
      </ViewPane>
      <ViewPane view={view} id="three" keep>
        <label>
          Typed work <input />
        </label>
      </ViewPane>
      <ViewPager views={VIEWS} current={view} />
    </>
  );
}

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/page', element: <Probe /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return router;
}

const switcher = () => within(screen.getByRole('navigation', { name: copy.label }));
const pager = () => within(screen.getByRole('navigation', { name: copy.pagerLabel }));

describe('views of a long page', () => {
  it('shows the first view and marks it as the current one', () => {
    renderAt('/page');
    expect(
      switcher()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['One', 'Two', 'Three']);
    expect(switcher().getByRole('link', { name: 'One' })).toHaveAttribute('aria-current', 'true');
    expect(switcher().getByRole('link', { name: 'Two' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('heading', { name: 'First part' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Second part' })).not.toBeInTheDocument();
  });

  it('shows the view the address names', async () => {
    renderAt('/page?view=two');
    expect(screen.getByRole('heading', { name: 'Second part' })).toBeVisible();
    expect(switcher().getByRole('link', { name: 'Two' })).toHaveAttribute('aria-current', 'true');
  });

  it('cleans up an address that names a view that does not exist', async () => {
    const router = renderAt('/page?view=nothing&keep=1');
    expect(screen.getByRole('heading', { name: 'First part' })).toBeVisible();
    await waitFor(() => expect(router.state.location.search).toBe('?keep=1'));
  });

  it('opens the view that holds a section a link points at, and puts the view in the address', async () => {
    const router = renderAt('/page#beta');
    expect(screen.getByRole('heading', { name: 'Second part' })).toBeVisible();
    await waitFor(() => expect(router.state.location.search).toBe('?view=two'));
    expect(router.state.location.hash).toBe('#beta');
  });

  it('opens the view that holds a section made from data, by its prefix', () => {
    renderAt('/page#gamma-1');
    expect(screen.getByText('Built from data')).toBeVisible();
  });

  it('lets a section win over the view the address already names', async () => {
    const router = renderAt('/page?view=two#alpha');
    expect(screen.getByRole('heading', { name: 'First part' })).toBeVisible();
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(router.state.location.hash).toBe('#alpha');
  });

  it('addresses each view with its name, keeps the rest of the address and names no section', () => {
    renderAt('/page?x=1&view=two#beta');
    expect(switcher().getByRole('link', { name: 'One' })).toHaveAttribute('href', '/page?x=1');
    expect(switcher().getByRole('link', { name: 'Three' })).toHaveAttribute(
      'href',
      '/page?x=1&view=three',
    );
  });

  it('steps to the next and previous view from the foot, and moves focus to the current one', async () => {
    const user = userEvent.setup();
    const router = renderAt('/page');
    expect(pager().queryByRole('link', { name: /Previous/ })).toBeNull();
    await user.click(pager().getByRole('link', { name: `${copy.next}: Two` }));
    expect(router.state.location.search).toBe('?view=two');
    await waitFor(() => expect(switcher().getByRole('link', { name: 'Two' })).toHaveFocus());
    await user.click(pager().getByRole('link', { name: `${copy.previous}: One` }));
    expect(router.state.location.search).toBe('');
    expect(pager().queryByRole('link', { name: /Previous/ })).toBeNull();
  });

  it('keeps work typed into a view that stays mounted while another view is showing', async () => {
    const user = userEvent.setup();
    renderAt('/page?view=three');
    await user.type(screen.getByLabelText('Typed work'), 'a note');
    await user.click(switcher().getByRole('link', { name: 'One' }));
    expect(screen.queryByRole('heading', { name: 'Second part' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Typed work')).not.toBeVisible();
    await user.click(switcher().getByRole('link', { name: 'Three' }));
    expect(screen.getByLabelText('Typed work')).toHaveValue('a note');
    expect(screen.getByLabelText('Typed work')).toBeVisible();
  });
});
