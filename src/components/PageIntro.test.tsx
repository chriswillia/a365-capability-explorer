import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { content } from '../lib/content/index.ts';
import { PageIntro } from './PageIntro.tsx';

describe('PageIntro', () => {
  it('opens with the sentence and keeps the notices behind About this page', () => {
    render(
      <PageIntro notice={<p>A notice about the page.</p>}>One sentence about the page.</PageIntro>,
    );
    expect(screen.getByText('One sentence about the page.')).toBeVisible();
    const summary = screen.getByText(content.site.ui.about.label);
    expect(summary.tagName).toBe('SUMMARY');
    const about = summary.closest('details')!;
    expect(about.open).toBe(false);
    expect(about).toContainElement(screen.getByText('A notice about the page.'));
    // The notices still reach the paper.
    expect(about).toHaveAttribute('data-print-open');
  });

  it('shows no About this page when the page has nothing to add', () => {
    render(<PageIntro>Just the sentence.</PageIntro>);
    expect(screen.getByText('Just the sentence.')).toBeVisible();
    expect(screen.queryByText(content.site.ui.about.label)).toBeNull();
  });
});
