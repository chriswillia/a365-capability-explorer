import { FluentProvider } from '@fluentui/react-components';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '../../app/routes.tsx';
import { content, contentMeta, pillarName } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { patternAnswers } from '../../lib/engine/evaluate.ts';
import { peopleRows } from '../../lib/engine/pillars.ts';
import {
  EXHIBIT_KEYS,
  exhibitId,
  exhibitPlan,
  readoutParts,
  type ReadoutPartId,
} from '../../lib/readout/plan.ts';
import { answerLabel, buildReadout } from '../../lib/readout/report.ts';
import { StateProviders } from '../../lib/state/StateProviders.tsx';
import { DEPTH_STORAGE_KEY } from '../../lib/state/depth.ts';
import { emptyWorkspace, type Assessment } from '../../lib/state/diagnostic-model.ts';
import { loadDiagnostics, saveDiagnostics } from '../../lib/state/diagnostic-storage.ts';
import { STORAGE_PREFIX } from '../../lib/state/storage.ts';
import { fluentTheme } from '../../theme/fluentTheme.ts';
import '../diagnostic/DiagnosticLayout.tsx';
import './CanvasPage.tsx';
import './ReadoutPage.tsx';

const { site } = content;
const copy = site.readout;

function seed(extra: Partial<Assessment> = {}) {
  const input = patternAnswers(content, 'process-agent', 'askhr');
  const data = emptyWorkspace();
  const metadata = {
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    contentVersion: contentMeta.contentVersion,
  };
  const organization = {
    ...metadata,
    id: crypto.randomUUID(),
    answers: { ...input.org, orgName: 'Fictional organization' },
  };
  const assessment: Assessment = {
    ...metadata,
    id: crypto.randomUUID(),
    organizationId: organization.id,
    answers: { ...input.useCase, useCaseName: 'Fictional readout' },
    mode: 'full',
    sectionId: 'review',
    patternId: 'process-agent',
    sampleId: 'askhr',
    ...extra,
  };
  data.organizations.push(organization);
  data.assessments.push(assessment);
  saveDiagnostics(loadDiagnostics(), data);
  const report = buildReadout(content, organization, assessment, contentMeta.contentVersion);
  return { assessment, report };
}

async function renderAt(path: string, title: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <FluentProvider theme={fluentTheme}>
      <StateProviders>
        <RouterProvider router={router} />
      </StateProviders>
    </FluentProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: title });
  return router;
}
const renderReadout = (assessment: Assessment, title: string) =>
  renderAt(`/diagnostic/${assessment.id}/readout`, title);
const eyebrow = (number: number, key: (typeof EXHIBIT_KEYS)[number]) =>
  renderTemplate(site.ui.exhibit.eyebrow, { number, label: copy.exhibits[key] });
const partLinks = () =>
  within(screen.getByRole('navigation', { name: site.ui.views.label })).getAllByRole('link');
// One part is on screen at a time; the others stay in the page, hidden.
const paneOf = (id: string) =>
  document.getElementById(id)!.closest('[data-print-visible]') as HTMLElement;
async function goToPart(
  router: Awaited<ReturnType<typeof renderReadout>>,
  assessment: Assessment,
  part: ReadoutPartId,
) {
  await router.navigate(`/diagnostic/${assessment.id}/readout?view=${part}`);
  await waitFor(() =>
    expect(partLinks().find((link) => link.textContent === copy.views[part])).toHaveAttribute(
      'aria-current',
      'true',
    ),
  );
}

describe('readout page', () => {
  it('numbers the executive exhibits 1, 2, 3… in reading order and matches the contents list', async () => {
    const { assessment, report } = seed();
    await renderReadout(assessment, report.title);
    const plan = exhibitPlan(false);
    const contents = within(screen.getByRole('navigation', { name: copy.contents }));
    expect(contents.getAllByRole('link').map((link) => link.textContent)).toEqual(
      plan.map((key) => copy.exhibits[key]),
    );
    for (const [i, key] of plan.entries()) {
      expect(contents.getByRole('link', { name: copy.exhibits[key] })).toHaveAttribute(
        'href',
        `#${exhibitId(key)}`,
      );
      const section = document.getElementById(exhibitId(key))!;
      expect(within(section).getByText(eyebrow(i + 1, key))).toBeInTheDocument();
    }
    for (const key of EXHIBIT_KEYS.filter((k) => !plan.includes(k)))
      expect(document.getElementById(exhibitId(key))).toBeNull();
    const order = plan.map((key) => document.getElementById(exhibitId(key))!);
    for (let i = 1; i < order.length; i++)
      expect(order[i - 1]!.compareDocumentPosition(order[i]!)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    expect(document.getElementById('readout-appendix')).toBeNull();
  });

  it('adds the technical exhibits and the appendix in Technical, still numbered without gaps', async () => {
    const user = userEvent.setup();
    const { assessment, report } = seed();
    await renderReadout(assessment, report.title);
    await user.click(screen.getByRole('button', { name: site.ui.depth.technical }));
    const plan = exhibitPlan(true);
    expect(plan).toHaveLength(EXHIBIT_KEYS.length);
    const contents = within(screen.getByRole('navigation', { name: copy.contents }));
    expect(contents.getAllByRole('link').map((link) => link.textContent)).toEqual([
      ...plan.map((key) => copy.exhibits[key]),
      copy.appendix,
    ]);
    for (const [i, key] of plan.entries())
      expect(
        within(document.getElementById(exhibitId(key))!).getByText(eyebrow(i + 1, key)),
      ).toBeInTheDocument();
    expect(contents.getByRole('link', { name: copy.appendix })).toHaveAttribute(
      'href',
      '#readout-appendix',
    );
    expect(document.getElementById('readout-appendix')).not.toBeNull();
  });

  it('shows one part at a time, and keeps every part in the page so the readout still prints whole', async () => {
    const { assessment, report } = seed();
    const router = await renderReadout(assessment, report.title);
    const parts = readoutParts(false);
    expect(partLinks().map((link) => link.textContent)).toEqual(
      parts.map((part) => copy.views[part.id]),
    );
    expect(partLinks()[0]).toHaveAttribute('aria-current', 'true');
    expect(partLinks()[1]).toHaveAttribute(
      'href',
      `/diagnostic/${assessment.id}/readout?view=controls`,
    );
    const plan = exhibitPlan(false);
    for (const part of parts)
      for (const key of part.exhibits.filter((candidate) => plan.includes(candidate)))
        expect(paneOf(exhibitId(key)).hidden, key).toBe(part.id !== 'summary');
    // The summary opens the first part, ahead of the exhibits.
    expect(paneOf('readout-summary')).toBe(paneOf(exhibitId('pillars')));
    expect(paneOf('readout-summary').hidden).toBe(false);
    for (const pane of document.querySelectorAll('[data-print-visible]'))
      expect(pane).toHaveAttribute('data-print-visible');

    await goToPart(router, assessment, 'controls');
    expect(paneOf(exhibitId('anatomy')).hidden).toBe(false);
    expect(paneOf(exhibitId('pillars')).hidden).toBe(true);
    expect(screen.getByRole('heading', { level: 2, name: copy.exhibits.anatomy })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 2, name: copy.exhibits.pillars })).toBeNull();
  });

  it('opens the part that holds an exhibit a link points at, and says so in the address', async () => {
    const { assessment, report } = seed();
    const router = await renderReadout(assessment, report.title);
    await router.navigate(`/diagnostic/${assessment.id}/readout#${exhibitId('licensing')}`);
    await waitFor(() => expect(router.state.location.search).toBe('?view=next'));
    expect(router.state.location.hash).toBe(`#${exhibitId('licensing')}`);
    expect(paneOf(exhibitId('licensing')).hidden).toBe(false);
    expect(partLinks().find((link) => link.textContent === copy.views.next)).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('steps from part to part from the foot of the page', async () => {
    const user = userEvent.setup();
    const { assessment, report } = seed();
    const router = await renderReadout(assessment, report.title);
    const parts = readoutParts(false);
    const pager = () => within(screen.getByRole('navigation', { name: site.ui.views.pagerLabel }));
    expect(pager().queryByRole('link', { name: new RegExp(site.ui.views.previous) })).toBeNull();
    await user.click(
      pager().getByRole('link', {
        name: `${site.ui.views.next}: ${copy.views[parts[1]!.id]}`,
      }),
    );
    expect(router.state.location.search).toBe('?view=controls');
  });

  it('adds the readiness detail and the appendix in Technical, and folds the long tables into closed panels', async () => {
    const user = userEvent.setup();
    const { assessment, report } = seed();
    const router = await renderReadout(assessment, report.title);
    await user.click(screen.getByRole('button', { name: site.ui.depth.technical }));
    expect(partLinks().map((link) => link.textContent)).toEqual(
      readoutParts(true).map((part) => copy.views[part.id]),
    );
    const table = document.getElementById('exhibit-capabilities-table') as HTMLDetailsElement;
    expect(table.open).toBe(false);
    expect(table.querySelector('summary')).toHaveTextContent(
      renderTemplate(copy.capabilityTable, { count: report.result.inScope.length }),
    );
    const appendix = ['scope', 'discovery', 'advisories', 'intensity', 'answers', 'sources'];
    for (const id of appendix)
      expect((document.getElementById(`appendix-${id}`) as HTMLDetailsElement).open, id).toBe(
        false,
      );
    await goToPart(router, assessment, 'detail');
    expect(paneOf(exhibitId('readiness')).hidden).toBe(false);
    expect(paneOf(exhibitId('integration')).hidden).toBe(false);

    // A link to a panel opens the part that holds it, and the panel.
    await router.navigate(`/diagnostic/${assessment.id}/readout#appendix-sources`);
    await waitFor(() => expect(router.state.location.search).toBe('?view=appendix'));
    await waitFor(() =>
      expect((document.getElementById('appendix-sources') as HTMLDetailsElement).open).toBe(true),
    );
  });

  it('falls back to the first part when the Technical view is turned off on a part only it has', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}${DEPTH_STORAGE_KEY}`, 'technical');
    const user = userEvent.setup();
    const { assessment, report } = seed();
    const router = await renderReadout(assessment, report.title);
    await goToPart(router, assessment, 'detail');
    await user.click(screen.getByRole('button', { name: site.ui.depth.technical }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(partLinks()[0]).toHaveAttribute('aria-current', 'true');
  });

  it('opens with the requirement areas and names the teams to involve', async () => {
    const { assessment, report } = seed();
    const router = await renderReadout(assessment, report.title);
    const areas = within(document.getElementById(exhibitId('pillars'))!);
    for (const row of report.pillars) {
      const card = areas
        .getByRole('heading', { level: 3, name: pillarName(row.pillar) })
        .closest('li')!;
      expect(card).toHaveTextContent(
        renderTemplate(site.mapping.pillarCount, {
          count: row.items.length,
          total: row.catalogTotal,
        }),
      );
    }
    await goToPart(router, assessment, 'golive');
    const people = within(within(document.getElementById(exhibitId('people'))!).getByRole('table'));
    const teams = peopleRows(content, report.result.inScope);
    expect(people.getAllByRole('row')).toHaveLength(teams.length + 1);
    for (const row of teams)
      expect(people.getByRole('rowheader', { name: row.team })).toBeInTheDocument();
  });

  it('shows how the agent acts, the production guardrails and who to license', async () => {
    const { assessment, report } = seed();
    const router = await renderReadout(assessment, report.title);
    const access = within(document.getElementById(exhibitId('access'))!);
    expect(access.getByText(copy.accessNote)).toBeInTheDocument();
    expect(access.getByRole('link', { name: copy.accessOpen })).toHaveAttribute(
      'href',
      `/access?assessment=${assessment.id}`,
    );
    expect(access.getByRole('table')).toBeInTheDocument();
    expect(
      access.getByRole('heading', {
        level: 3,
        name: new RegExp(`^${content.accessPatterns.changeBoth}`),
      }),
    ).toBeInTheDocument();

    await goToPart(router, assessment, 'golive');
    const guardrails = within(document.getElementById(exhibitId('guardrails'))!);
    expect(
      guardrails.getByText(renderTemplate(content.guardrails.summary, report.guardrails.counts)),
    ).toBeInTheDocument();
    for (const { items } of report.guardrails.gates)
      for (const { item } of items) expect(guardrails.getByText(item.title)).toBeInTheDocument();

    await goToPart(router, assessment, 'next');
    const licensing = within(document.getElementById(exhibitId('licensing'))!);
    expect(report.license.populations.length).toBeGreaterThan(0);
    for (const { population } of report.license.populations)
      expect(licensing.getByText(population.label)).toBeInTheDocument();
    for (const { item } of report.license.requirements)
      expect(licensing.getByText(item.text, { exact: false })).toBeInTheDocument();
    const unconfirmed = report.license.requirements.filter(({ status }) => status === 'unknown');
    expect(unconfirmed.length).toBeGreaterThan(0);
    for (const { item } of unconfirmed)
      expect(licensing.getByText(item.askPrompt!, { exact: false })).toBeInTheDocument();
    expect(licensing.getByRole('link', { name: copy.licenseOpen })).toHaveAttribute(
      'href',
      `/licensing?assessment=${assessment.id}`,
    );
  });

  it('keeps print and PowerPoint in the toolbar and the other ways to share behind one menu', async () => {
    const { assessment, report } = seed();
    await renderReadout(assessment, report.title);
    const menu = screen.getByText(copy.moreShare).closest('details')!;
    expect(menu).not.toHaveAttribute('open');
    expect(menu.closest('[data-no-print]')).not.toBeNull();
    const inside = within(menu);
    for (const name of [copy.markdown, copy.json, copy.copySummary])
      expect(inside.getByRole('button', { name })).toBeInTheDocument();
    for (const name of [copy.print, copy.powerpoint]) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeInTheDocument();
      expect(menu).not.toContainElement(button);
    }
  });

  it('keeps the logo editor out of the way until there is a logo', async () => {
    const { assessment, report } = seed();
    await renderReadout(assessment, report.title);
    expect(screen.getByText(copy.addLogo).closest('details')).not.toHaveAttribute('open');
  });

  it('lets the seller correct the engagement details on the page and saves them', async () => {
    const user = userEvent.setup();
    const { assessment, report } = seed();
    await renderReadout(assessment, report.title);
    await user.click(screen.getByText(copy.editDetails));
    const engagement = content.questions.find((q) => q.id === 'engagementName')!;
    await user.type(
      screen.getByRole('textbox', { name: engagement.label }),
      'Fictional engagement',
    );
    expect(screen.getByText('Fictional engagement', { selector: 'dd' })).toBeInTheDocument();
    expect(loadDiagnostics().data.assessments[0]!.answers.engagementName).toBe(
      'Fictional engagement',
    );
  });

  it('marks answers that have not been confirmed with the customer', async () => {
    const user = userEvent.setup();
    const { assessment, report } = seed({ assumedQuestionIds: ['autonomy', 'stage'] });
    expect(report.assumed).toEqual(['autonomy', 'stage']);
    await renderReadout(assessment, report.title);
    expect(
      screen.getByText(renderTemplate(copy.assumedTakeaway, { count: 2 })),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: site.ui.depth.technical }));
    const answer = `${answerLabel(content, report.answers, 'autonomy')} (${copy.assumedMark})`;
    expect(screen.getByText(answer, { selector: 'dd' })).toBeInTheDocument();
    expect(
      screen.queryByText(
        `${answerLabel(content, report.answers, 'accessModel')} (${copy.assumedMark})`,
      ),
    ).not.toBeInTheDocument();
  });

  it('opens every closed section for printing and closes the ones it opened afterwards', async () => {
    const { assessment, report } = seed();
    await renderReadout(assessment, report.title);
    // Let the page's effects register their print listeners before the print events arrive.
    await act(async () => {});
    const states = () =>
      [...document.querySelectorAll<HTMLDetailsElement>('main details')].map(
        (element) => element.open,
      );
    const before = states();
    expect(before.filter((open) => !open).length).toBeGreaterThan(2);
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(states().every(Boolean)).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(states()).toEqual(before);
  });
});

describe('canvas page', () => {
  const pillarCard = (row: { pillar: Parameters<typeof pillarName>[0] }) => {
    const section = screen
      .getByRole('heading', { level: 2, name: site.mapping.pillars })
      .closest('section')!;
    return within(section).getByRole('heading', { level: 3, name: pillarName(row.pillar) })
      .parentElement!;
  };

  it('lists the in-scope capabilities under each requirement area', async () => {
    const { assessment, report } = seed();
    await renderAt(`/canvas/${assessment.id}`, copy.canvas);
    for (const row of report.pillars) {
      const card = within(pillarCard(row));
      for (const { capability, level } of row.items)
        expect(
          card.getByText(`${capability.shortName} — ${site.mapping.levels[level]}`),
        ).toBeInTheDocument();
      if (row.items.length === 0)
        expect(card.getByText(site.mapping.pillarNone)).toBeInTheDocument();
    }
    expect(report.pillars.some((row) => row.items.length > 0)).toBe(true);
  });

  it('keeps the requirement areas on the blank canvas with nothing filled in', async () => {
    await renderAt('/canvas/blank', copy.canvas);
    for (const pillar of content.pillars) {
      const card = within(pillarCard({ pillar }));
      expect(card.queryAllByRole('listitem')).toHaveLength(0);
      expect(card.getByText(site.mapping.unknownAnswer)).toBeInTheDocument();
    }
  });

  it('marks an answer the customer has not confirmed in its canvas box', async () => {
    const { assessment, report } = seed({ assumedQuestionIds: ['autonomy'] });
    await renderAt(`/canvas/${assessment.id}`, copy.canvas);
    expect(
      screen.getByText(
        `${answerLabel(content, report.answers, 'autonomy')} (${copy.assumedMark})`,
        {
          selector: 'dd',
        },
      ),
    ).toBeInTheDocument();
  });
});
