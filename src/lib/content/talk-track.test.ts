import { describe, expect, it } from 'vitest';
import { content } from './index.ts';
import { talkTrack, talkTrackText } from './talk-track.ts';

const brief = content.site.capabilities.brief;

describe('talkTrack', () => {
  it('says the outcome and what changes with the capability, from its own text', () => {
    const capability = content.capabilities.find((c) => c.id === 'registry-inventory')!;
    const text = talkTrack(capability);
    expect(text).toContain(capability.executiveValue!);
    expect(text).toContain(capability.withIt!);
    expect(text.indexOf(capability.executiveValue!)).toBeLessThan(text.indexOf(capability.withIt!));
  });

  it('falls back to the summary when there is no outcome, and leaves out what is missing', () => {
    const base = content.capabilities[0]!;
    const bare = { ...base, executiveValue: undefined, withIt: undefined };
    expect(talkTrack(bare)).toBe(base.summary);
    expect(talkTrack({ ...base, executiveValue: '  ', withIt: 'It changes.' })).toBe('It changes.');
  });

  it('says something for every capability, and adds nothing that is not on the capability', () => {
    for (const capability of content.capabilities) {
      const text = talkTrack(capability);
      expect(text.length).toBeGreaterThan(20);
      const own = [capability.executiveValue, capability.summary, capability.withIt].join(' ');
      for (const sentence of text.split(/(?<=[.!?])\s+/)) expect(own).toContain(sentence);
    }
  });
});

describe('talkTrackText', () => {
  it('names the capability, then what to say, then what to ask', () => {
    const capability = content.capabilities.find((c) => c.id === 'registry-inventory')!;
    const lines = talkTrackText(content, capability).split('\n');
    expect(lines[0]).toBe(capability.shortName);
    expect(lines[2]).toBe(`${brief.talkTrack}: ${talkTrack(capability)}`);
    expect(lines).toContain(`${brief.askLabel}:`);
    for (const question of capability.discoveryQuestions!) expect(lines).toContain(`- ${question}`);
  });

  it('leaves out the questions when a capability has none', () => {
    const capability = { ...content.capabilities[0]!, discoveryQuestions: undefined };
    expect(talkTrackText(content, capability)).not.toContain(brief.askLabel);
  });
});
