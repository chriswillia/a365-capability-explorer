import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MenuDetails } from './MenuDetails.tsx';

function Page() {
  return (
    <>
      <button type="button">Before</button>
      <MenuDetails summary="The menu">
        <button type="button">Inside one</button>
        <p>Some text in the panel</p>
      </MenuDetails>
      <button type="button">After</button>
    </>
  );
}

const menu = () => screen.getByText('The menu').closest('details') as HTMLDetailsElement;

describe('MenuDetails', () => {
  it('opens from its summary and closes on Escape, with focus back on the summary', async () => {
    const user = userEvent.setup();
    render(<Page />);
    expect(menu().open).toBe(false);
    await user.click(screen.getByText('The menu'));
    expect(menu().open).toBe(true);
    await user.keyboard('{Escape}');
    expect(menu().open).toBe(false);
    expect(screen.getByText('The menu')).toHaveFocus();
  });

  it('stays open for a press inside it, even on text that cannot take focus, and closes for a press outside', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByText('The menu'));
    await user.click(screen.getByText('Some text in the panel'));
    expect(menu().open).toBe(true);
    await user.click(screen.getByRole('button', { name: 'After' }));
    expect(menu().open).toBe(false);
  });

  it('closes when the user tabs out of it, and not before', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByText('The menu'));
    await user.tab();
    expect(screen.getByRole('button', { name: 'Inside one' })).toHaveFocus();
    expect(menu().open).toBe(true);
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    expect(menu().open).toBe(false);
  });

  it('stays open when a program moves focus elsewhere, as a page does when it loads', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByText('The menu'));
    act(() => screen.getByRole('button', { name: 'After' }).focus());
    expect(menu().open).toBe(true);
  });

  it('stops listening when it goes away', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Page />);
    await user.click(screen.getByText('The menu'));
    const element = menu();
    unmount();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    // Nothing throws, and the detached menu was left as it was.
    expect(element.open).toBe(true);
  });
});
