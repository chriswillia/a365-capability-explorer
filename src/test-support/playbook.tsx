import { FluentProvider } from '@fluentui/react-components';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '../app/routes.tsx';
import { content, contentMeta } from '../lib/content/index.ts';
import type { Answers } from '../lib/content/schemas.ts';
import {
  emptyWorkspace,
  type Assessment,
  type Organization,
} from '../lib/state/diagnostic-model.ts';
import { loadDiagnostics, saveDiagnostics } from '../lib/state/diagnostic-storage.ts';
import { StateProviders } from '../lib/state/StateProviders.tsx';
import { fluentTheme } from '../theme/fluentTheme.ts';

/** Renders the whole app at an address, as the page tests need, and waits for the page's own heading. */
export async function renderRoute(path: string, heading: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <FluentProvider theme={fluentTheme}>
      <StateProviders>
        <RouterProvider router={router} />
      </StateProviders>
    </FluentProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: heading });
  return router;
}

/** Saves a fictional customer with one assessment in the browser storage the pages read. */
export function seedAssessment(
  useCase: Answers = {},
  org: Answers = {},
): { organization: Organization; assessment: Assessment } {
  const data = emptyWorkspace();
  const metadata = {
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    contentVersion: contentMeta.contentVersion,
  };
  const organization: Organization = {
    ...metadata,
    id: crypto.randomUUID(),
    answers: { orgName: 'Fictional customer', ...org },
  };
  const assessment: Assessment = {
    ...metadata,
    id: crypto.randomUUID(),
    organizationId: organization.id,
    answers: { useCaseName: 'Fictional agent', ...useCase },
    mode: 'full',
    sectionId: 'review',
    patternId: null,
    sampleId: null,
  };
  data.organizations.push(organization);
  data.assessments.push(assessment);
  saveDiagnostics(loadDiagnostics(), data);
  return { organization, assessment };
}

export const optionLabel = (questionId: string, value: string) =>
  content.questions.find((q) => q.id === questionId)!.options.find((o) => o.value === value)!.label;
