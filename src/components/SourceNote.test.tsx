import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { content } from '../lib/content/index.ts';
import { renderTemplate } from '../lib/content/template.ts';
import { DEPTH_STORAGE_KEY } from '../lib/state/depth.ts';
import { StateProviders } from '../lib/state/StateProviders.tsx';
import { STORAGE_PREFIX } from '../lib/state/storage.ts';
import { SourceNote } from './SourceNote.tsx';

const [first, second] = content.sources;
const { exhibit } = content.site.ui;

const show = (props: Partial<Parameters<typeof SourceNote>[0]> = {}) =>
  render(
    <StateProviders>
      <SourceNote
        sourceIds={[first!.id, second!.id]}
        evidence="stated"
        lastVerified="2026-10-27"
        {...props}
      />
    </StateProviders>,
  );

describe('SourceNote', () => {
  it('says how many sources there are and when they were read, and keeps the list one click away', () => {
    show();
    const summary = screen.getByText(
      renderTemplate(exhibit.sourcesSummary, { count: 2, date: '2026-10-27' }),
    );
    expect(summary.tagName).toBe('SUMMARY');
    const note = summary.closest('details')!;
    expect(note.open).toBe(false);
    for (const source of [first!, second!])
      expect(within(note).getByRole('link', { name: source.title, hidden: true })).toHaveAttribute(
        'href',
        source.url,
      );
    expect(within(note).getByText(first!.title).closest('p')).toHaveTextContent(
      exhibit.sourcePrefix,
    );
    expect(within(note).getByText('2026-10-27').tagName).toBe('TIME');
    // The evidence tag is for the Technical view.
    expect(within(note).queryByText(content.site.learn.evidence.stated)).toBeNull();
  });

  it('opens its list in the Technical view, with the evidence tag', () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}${DEPTH_STORAGE_KEY}`, 'technical');
    show();
    const note = screen
      .getByText(renderTemplate(exhibit.sourcesSummary, { count: 2, date: '2026-10-27' }))
      .closest('details')!;
    expect(note.open).toBe(true);
    expect(within(note).getByText(content.site.learn.evidence.stated)).toBeVisible();
  });

  it('is marked to open for printing, so the sources still reach the paper', () => {
    show();
    const summary = screen.getByText(
      renderTemplate(exhibit.sourcesSummary, { count: 2, date: '2026-10-27' }),
    );
    expect(summary.closest('details')).toHaveAttribute('data-print-open');
  });

  it('counts the sources it can find and leaves out the date when there is none', () => {
    show({ sourceIds: [first!.id, 'no-such-source'], lastVerified: null });
    const summary = screen.getByText(renderTemplate(exhibit.sourcesSummaryUndated, { count: 1 }));
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.closest('details')!.querySelector('time')).toBeNull();
  });
});
