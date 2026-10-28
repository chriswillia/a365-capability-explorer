import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '../lib/content/index.ts';
import { DataTable, type Column } from './DataTable.tsx';

interface Row {
  id: string;
  name: string;
  value: string;
}
const rows: Row[] = [
  { id: 'a', name: 'First', value: 'One' },
  { id: 'b', name: 'Second', value: 'Two' },
];
const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', rowHeader: true, render: (row) => row.name },
  { key: 'value', header: 'Value', render: (row) => row.value },
];
const hint = content.site.ui.scrollHint;

/** jsdom has no layout, so a test says how wide the table is and when the observer fires. */
function stubLayout(scrollWidth: number, clientWidth: number) {
  class FakeObserver {
    private readonly callback: () => void;
    constructor(callback: () => void) {
      this.callback = callback;
    }
    observe() {
      this.callback();
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', FakeObserver);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth);
}

describe('DataTable scroll region', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('is a focusable, named region, with one row header per row', () => {
    render(
      <DataTable
        caption="Things"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        scrollLabel="Things, scrollable"
      />,
    );
    expect(screen.getByRole('region', { name: 'Things, scrollable' })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.getAllByRole('rowheader')).toHaveLength(rows.length);
  });

  it('tells the reader to scroll sideways when the table is wider than the screen', async () => {
    stubLayout(900, 400);
    render(
      <DataTable
        caption="Things"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        scrollLabel="Things, scrollable"
      />,
    );
    expect(await screen.findByText(hint)).toBeInTheDocument();
  });

  it('shows no hint when the whole table fits', () => {
    stubLayout(400, 400);
    render(
      <DataTable
        caption="Things"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        scrollLabel="Things, scrollable"
      />,
    );
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });

  it('keeps the hint out of the reading order, because the region already says it scrolls', async () => {
    stubLayout(900, 400);
    render(
      <DataTable
        caption="Things"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        scrollLabel="Things, scrollable"
      />,
    );
    expect(await screen.findByText(hint)).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows no hint, and no scroll region, for a table that never scrolls', () => {
    stubLayout(900, 400);
    render(<DataTable caption="Things" columns={columns} rows={rows} rowKey={(row) => row.id} />);
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('still renders where the browser has no ResizeObserver', () => {
    render(
      <DataTable
        caption="Things"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        scrollLabel="Things, scrollable"
      />,
    );
    expect(screen.getByRole('table', { name: 'Things' })).toBeInTheDocument();
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });
});
