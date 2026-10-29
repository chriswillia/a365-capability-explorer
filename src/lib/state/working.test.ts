import { describe, expect, it } from 'vitest';
import { contentMeta } from '../content/index.ts';
import { emptyWorkspace, type Assessment } from './diagnostic-model.ts';
import { agentInAddress, currentAgent } from './working.ts';

const stamp = (updatedAt: string) => ({
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt,
  contentVersion: contentMeta.contentVersion,
});

function workspace() {
  const data = emptyWorkspace();
  const first = crypto.randomUUID();
  const second = crypto.randomUUID();
  for (const id of [first, second])
    data.organizations.push({ ...stamp('2026-10-02T09:00:00.000Z'), id, answers: {} });
  const agent = (organizationId: string, updatedAt: string): Assessment => ({
    ...stamp(updatedAt),
    id: crypto.randomUUID(),
    organizationId,
    answers: {},
    mode: 'quick',
    sectionId: 'profile',
    patternId: null,
    sampleId: null,
  });
  const a = agent(first, '2026-10-03T09:00:00.000Z');
  const b = agent(second, '2026-10-04T09:00:00.000Z');
  const c = agent(second, '2026-10-05T09:00:00.000Z');
  data.assessments.push(a, b, c);
  return { data, first, second, a, b, c };
}

describe('the agent an address is about', () => {
  it.each([
    ['/diagnostic/abc', '', 'abc'],
    ['/diagnostic/abc/readout', '', 'abc'],
    ['/canvas/abc', '', 'abc'],
    ['/leave-behind/abc', '', 'abc'],
    ['/map', '?assessment=abc', 'abc'],
    ['/licensing', '?assessment=abc', 'abc'],
    ['/deploy', '?assessment=abc', 'abc'],
    ['/access', '?assessment=abc', 'abc'],
    ['/diagnostic', '', null],
    ['/map', '', null],
    ['/pitch', '?assessment=abc', null],
    ['/portfolio', '?assessment=abc', null],
  ])('%s%s names %s', (pathname, search, expected) => {
    expect(agentInAddress(pathname, search)).toBe(expected);
  });
});

describe('the agent a seller is working on', () => {
  it('is none before an agent is saved', () => {
    expect(currentAgent(emptyWorkspace(), '/', '')).toBeUndefined();
  });

  it('is the agent the page is about', () => {
    const { data, a } = workspace();
    expect(currentAgent(data, `/diagnostic/${a.id}/readout`, '')).toBe(
      data.assessments.find((x) => x.id === a.id),
    );
    expect(currentAgent(data, '/licensing', `?assessment=${a.id}`)?.id).toBe(a.id);
  });

  it('is the agent changed most recently when the page is about none', () => {
    const { data, c } = workspace();
    expect(currentAgent(data, '/pitch', '')?.id).toBe(c.id);
    expect(currentAgent(data, '/diagnostic/not-saved', '')?.id).toBe(c.id);
  });

  it('is the newest agent of the customer whose portfolio is open, and the newest overall when that customer is not saved', () => {
    const { data, first, a, c } = workspace();
    expect(currentAgent(data, '/portfolio', `?customer=${first}`)?.id).toBe(a.id);
    expect(currentAgent(data, '/portfolio', '?customer=missing')?.id).toBe(c.id);
  });
});
