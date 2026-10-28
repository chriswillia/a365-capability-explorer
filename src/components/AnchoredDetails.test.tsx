import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AnchoredDetails } from './AnchoredDetails.tsx';

function renderAt(hash: string, defaultOpen = false) {
  render(
    <MemoryRouter initialEntries={[`/page${hash}`]}>
      <AnchoredDetails id="area-one" summary="Area one" defaultOpen={defaultOpen}>
        <p>Inside the panel</p>
      </AnchoredDetails>
      <AnchoredDetails id="area-two" summary="Area two">
        <p>Inside the other panel</p>
      </AnchoredDetails>
    </MemoryRouter>,
  );
  return {
    one: document.getElementById('area-one') as HTMLDetailsElement,
    two: document.getElementById('area-two') as HTMLDetailsElement,
  };
}

describe('AnchoredDetails', () => {
  it('stays closed until it is needed, and opens for printing', () => {
    const { one } = renderAt('');
    expect(one.open).toBe(false);
    expect(one).toHaveAttribute('data-print-open');
    expect(within(one).getByText('Area one', { selector: 'summary' })).toBeInTheDocument();
  });

  it('opens when a link points at it, and leaves the others alone', () => {
    const { one, two } = renderAt('#area-two');
    expect(two.open).toBe(true);
    expect(one.open).toBe(false);
  });

  it('can start open', () => {
    const { one } = renderAt('', true);
    expect(one.open).toBe(true);
  });

  it('opens and closes by the seller’s hand', async () => {
    const user = userEvent.setup();
    const { one } = renderAt('');
    await user.click(screen.getByText('Area one'));
    expect(one.open).toBe(true);
    await user.click(screen.getByText('Area one'));
    expect(one.open).toBe(false);
  });

  it('ignores an address it cannot read', () => {
    const { one, two } = renderAt('#%E0%A4%A');
    expect(one.open).toBe(false);
    expect(two.open).toBe(false);
  });
});
