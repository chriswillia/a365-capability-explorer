import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { loadDiagnostics } from '../../lib/state/diagnostic-storage.ts';
import { addSampleCustomer, sampleCustomer } from '../../lib/state/sample.ts';
import { renderRoute, seedAssessment } from '../../test-support/playbook.tsx';
import '../passport/PassportPage.tsx';

const { site } = content;
const copy = site.ui.sample;
const home = () => renderRoute('/', site.productName);
const block = async () => within(await screen.findByRole('region', { name: copy.heading }));
const recent = () =>
  screen
    .queryByRole('heading', { level: 2, name: site.overview.recent.heading })
    ?.closest('section') ?? null;
const header = () => within(screen.getByRole('banner'));

afterEach(() => vi.restoreAllMocks());

describe('the sample customer on the home page', () => {
  it('describes the sample and offers only to load it before it is saved', async () => {
    await home();
    const region = await block();
    expect(
      region.getByText(renderTemplate(copy.body, { count: copy.sampleIds.length })),
    ).toBeInTheDocument();
    for (const id of copy.sampleIds)
      expect(
        region.getByText(content.samples.find((s) => s.id === id)!.title, { exact: false }),
      ).toBeInTheDocument();
    expect(region.getByRole('button', { name: copy.load })).toBeInTheDocument();
    for (const name of [copy.open, copy.reset, copy.remove])
      expect(region.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(recent()).toBeNull();
  });

  it('loads the sample, opens its first agent in the passport, and marks it as sample data', async () => {
    const user = userEvent.setup();
    const router = await home();
    await user.click((await block()).getByRole('button', { name: copy.load }));

    const { data } = loadDiagnostics();
    const customer = sampleCustomer(data)!;
    const agents = data.assessments.filter((a) => a.organizationId === customer.id);
    expect(agents.map((a) => a.sampleId)).toEqual(copy.sampleIds);
    await screen.findByRole('heading', { level: 1, name: site.routes.map.title });
    expect(router.state.location.pathname).toBe('/map');
    expect(router.state.location.search).toBe(`?assessment=${agents[0]!.id}`);
    expect(router.state.location.search).not.toContain(copy.customerName);

    const result = await screen.findByRole('region', { name: content.passport.result.heading });
    expect(within(result).getByText(copy.chip)).toBeInTheDocument();
    expect(header().getByText(copy.chip)).toBeInTheDocument();
  });

  it('offers to open, reset or remove a saved sample, and lists it among recent customers with its mark', async () => {
    addSampleCustomer();
    await home();
    const region = await block();
    for (const name of [copy.open, copy.reset, copy.remove])
      expect(region.getByRole('button', { name })).toBeInTheDocument();
    expect(region.queryByRole('button', { name: copy.load })).not.toBeInTheDocument();
    await waitFor(() => expect(recent()).not.toBeNull());
    expect(within(recent()!).getByText(copy.customerName)).toBeInTheDocument();
    expect(within(recent()!).getByText(copy.chip)).toBeInTheDocument();
  });

  it('opens the sample that is already saved without adding a second one', async () => {
    const user = userEvent.setup();
    const { ok, assessmentId } = addSampleCustomer() as { ok: true; assessmentId: string };
    expect(ok).toBe(true);
    const router = await home();
    await user.click((await block()).getByRole('button', { name: copy.open }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/map'));
    expect(router.state.location.search).toBe(`?assessment=${assessmentId}`);
    expect(loadDiagnostics().data.organizations).toHaveLength(1);
  });

  it('removes the sample everywhere on the page at once, and says so', async () => {
    const user = userEvent.setup();
    addSampleCustomer();
    await home();
    const region = await block();
    await waitFor(() => expect(recent()).not.toBeNull());
    expect(header().getByText(copy.chip)).toBeInTheDocument();

    await user.click(region.getByRole('button', { name: copy.remove }));
    expect(await region.findByText(copy.removed)).toBeInTheDocument();
    expect(loadDiagnostics().data.organizations).toEqual([]);
    expect(loadDiagnostics().data.assessments).toEqual([]);
    // The recent list and the header shortcut update without leaving the page.
    expect(recent()).toBeNull();
    expect(header().queryByText(copy.chip)).not.toBeInTheDocument();
    expect(region.getByRole('button', { name: copy.load })).toBeInTheDocument();
    expect(region.queryByRole('button', { name: copy.remove })).not.toBeInTheDocument();
  });

  it('leaves a real customer alone when the sample is removed', async () => {
    const user = userEvent.setup();
    const real = seedAssessment({}, { orgName: 'Fictional real customer' });
    addSampleCustomer();
    await home();
    await user.click((await block()).getByRole('button', { name: copy.remove }));
    await waitFor(() => expect(sampleCustomer(loadDiagnostics().data)).toBeUndefined());
    const { data } = loadDiagnostics();
    expect(data.organizations.map((o) => o.id)).toEqual([real.organization.id]);
    expect(data.assessments.map((a) => a.id)).toEqual([real.assessment.id]);
    await waitFor(() =>
      expect(within(recent()!).getByText('Fictional real customer')).toBeInTheDocument(),
    );
    expect(within(recent()!).queryByText(copy.customerName)).not.toBeInTheDocument();
  });

  it('puts the sample back to its original answers when it is reset', async () => {
    const user = userEvent.setup();
    const original = addSampleCustomer();
    expect(original.ok).toBe(true);
    await home();
    await user.click((await block()).getByRole('button', { name: copy.reset }));
    expect(await (await block()).findByText(copy.resetDone)).toBeInTheDocument();
    const { data } = loadDiagnostics();
    expect(data.organizations).toHaveLength(1);
    expect(data.assessments).toHaveLength(copy.sampleIds.length);
    expect(data.assessments.some((a) => original.ok && a.id === original.assessmentId)).toBe(false);
  });

  it('says so, and stays on the page, when the browser will not save the sample', async () => {
    const user = userEvent.setup();
    const router = await home();
    const region = await block();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    await user.click(region.getByRole('button', { name: copy.load }));
    expect(await region.findByText(copy.error)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});
