import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { content } from '../../lib/content/index.ts';
import { emptyWorkspace } from '../../lib/state/diagnostic-model.ts';
import { DiagnosticContext, type DiagnosticContextValue } from '../../lib/state/diagnostics.ts';
import { MAX_IMPORT_BYTES } from '../../lib/state/diagnostic-transfer.ts';
import { DiagnosticTransfer } from './DiagnosticTransfer.tsx';

function provider() {
  const data = emptyWorkspace();
  const state: DiagnosticContextValue = {
    data,
    savedRaw: null,
    recoveryRaw: null,
    error: null,
    dirty: false,
    change: vi.fn(),
    reload: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
  };
  return state;
}

describe('portable assessment file limits', () => {
  it('distinguishes an oversized imported file from an oversized export selection', async () => {
    const state = provider();
    const { container } = render(
      <DiagnosticContext value={state}>
        <DiagnosticTransfer />
      </DiagnosticContext>,
    );
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(MAX_IMPORT_BYTES + 1)], 'big.json', {
            type: 'application/json',
          }),
        ],
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      content.site.readout.importErrors.size,
    );
    expect(state.change).not.toHaveBeenCalled();
  });

  it('prevents a JSON download larger than the supported import size and offers a specific remedy', () => {
    const state = provider();
    const entity = {
      createdAt: '2026-10-26T12:00:00.000Z',
      updatedAt: '2026-10-26T12:00:00.000Z',
      contentVersion: 'old',
    };
    const organizationId = crypto.randomUUID();
    state.data.organizations.push({ ...entity, id: organizationId, answers: {} });
    state.data.assessments.push({
      ...entity,
      id: crypto.randomUUID(),
      organizationId,
      answers: { retiredAnswer: 'x'.repeat(MAX_IMPORT_BYTES) },
      mode: 'full',
      sectionId: 'review',
      patternId: null,
      sampleId: null,
    });
    render(
      <DiagnosticContext value={state}>
        <DiagnosticTransfer assessmentIds={[state.data.assessments[0]!.id]} />
      </DiagnosticContext>,
    );
    fireEvent.click(screen.getByRole('button', { name: content.site.portfolio.export }));
    expect(screen.getByRole('alert')).toHaveTextContent(content.site.readout.exportTooLarge);
    expect(state.change).not.toHaveBeenCalled();
  });
});
