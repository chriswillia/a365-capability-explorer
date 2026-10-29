import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { content } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { renderRoute, seedAssessment } from '../../test-support/playbook.tsx';

const { site } = content;
const back = (name: string) => renderTemplate(site.ui.working.back, { name });

// The pages for one agent, and the heading each shows. Each one is a click from the passport where its steps start.
const pages = [
  ['licensing', (id: string) => `/licensing?assessment=${id}`, site.routes.licensing.title],
  ['deploy', (id: string) => `/deploy?assessment=${id}`, site.routes.deploy.title],
  ['access', (id: string) => `/access?assessment=${id}`, site.routes.access.title],
  ['canvas', (id: string) => `/canvas/${id}`, site.readout.canvas],
  ['full discovery', (id: string) => `/diagnostic/${id}`, 'Fictional agent'],
] as const;

describe('the way back to an agent passport', () => {
  it.each(pages)('is on the %s page for an agent', async (_name, path, heading) => {
    const { assessment } = seedAssessment({ accessModel: 'delegated' });
    await renderRoute(path(assessment.id), heading);
    expect(
      screen.getByRole('link', { name: back('Fictional customer · Fictional agent') }),
    ).toHaveAttribute('href', `/map?assessment=${assessment.id}#passport-heading`);
  });

  it('is on the readout too, with its customer and agent named', async () => {
    const { assessment } = seedAssessment({ accessModel: 'delegated' });
    await renderRoute(
      `/diagnostic/${assessment.id}/readout`,
      renderTemplate(site.readout.title, {
        label: 'Fictional agent',
        organization: 'Fictional customer',
      }),
    );
    expect(
      screen.getByRole('link', { name: back('Fictional customer · Fictional agent') }),
    ).toHaveAttribute('href', `/map?assessment=${assessment.id}#passport-heading`);
  });

  it('is left out where no agent is chosen, so a page for none shows no dead link', async () => {
    await renderRoute('/licensing', site.routes.licensing.title);
    expect(screen.queryByRole('link', { name: /^Back to the passport/ })).not.toBeInTheDocument();
  });
});
