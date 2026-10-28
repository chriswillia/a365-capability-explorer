import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePrintOpensDetails } from './usePrintOpensDetails.ts';

function Page() {
  usePrintOpensDetails();
  return (
    <>
      <details data-print-open>
        <summary>Closed, opens for print</summary>
        <p>Hidden detail</p>
      </details>
      <details data-print-open open>
        <summary>Already open</summary>
        <p>Open detail</p>
      </details>
      <details>
        <summary>Not marked</summary>
        <p>Stays closed</p>
      </details>
    </>
  );
}

const disclosure = (name: string) => screen.getByText(name).closest('details')!;

describe('usePrintOpensDetails', () => {
  it('opens the marked disclosures for printing and puts them back afterwards', () => {
    render(<Page />);
    window.dispatchEvent(new Event('beforeprint'));
    expect(disclosure('Closed, opens for print').open).toBe(true);
    expect(disclosure('Already open').open).toBe(true);
    expect(disclosure('Not marked').open).toBe(false);

    window.dispatchEvent(new Event('afterprint'));
    expect(disclosure('Closed, opens for print').open).toBe(false);
    // One that was already open stays open, because printing did not open it.
    expect(disclosure('Already open').open).toBe(true);
    expect(disclosure('Not marked').open).toBe(false);
  });

  it('stops listening when the page goes away', () => {
    const { unmount } = render(<Page />);
    const element = disclosure('Closed, opens for print');
    unmount();
    window.dispatchEvent(new Event('beforeprint'));
    expect(element.open).toBe(false);
  });
});
