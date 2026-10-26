import { describe, expect, it } from 'vitest';
import { createGlossaryMatcher } from './glossary.ts';
import type { GlossaryEntry } from './schemas.ts';
import { content } from './index.ts';

const entry: GlossaryEntry = {
  id: 'mcp',
  term: 'Model Context Protocol',
  aliases: ['MCP'],
  definition: 'Tool protocol.',
  sourceId: 'a365-sdk',
  evidence: 'stated',
  reviewStatus: 'draft',
  lastVerified: '2026-10-24',
};
describe('first-use glossary matching', () => {
  it('links a term or alias only once across a page, case-insensitively', () => {
    const match = createGlossaryMatcher([entry]);
    expect(match('Use mcp, then Model Context Protocol.')).toEqual([
      'Use ',
      { text: 'mcp', entry },
      ', then Model Context Protocol.',
    ]);
    expect(match('MCP again.')).toEqual(['MCP again.']);
    expect(createGlossaryMatcher([entry])('MCP')[1]).toEqual({ text: 'MCP', entry });
  });
  it('does not match inside words and prefers longer phrases', () => {
    const long = { ...entry, id: 'long', term: 'MCP servers', aliases: [] };
    const match = createGlossaryMatcher([entry, long]);
    expect(match('xMCP MCPs éMCP MCP_ MCP servers')).toEqual([
      'xMCP MCPs éMCP MCP_ ',
      { text: 'MCP servers', entry: long },
      '',
    ]);
  });
  it('preserves all text, punctuation and characters without interpreting HTML', () => {
    const text = '<script>MCP & MCP</script>';
    const segments = createGlossaryMatcher([entry])(text);
    expect(segments.map((part) => (typeof part === 'string' ? part : part.text)).join('')).toBe(
      text,
    );
    expect(createGlossaryMatcher([])(text)).toEqual([text]);
  });
  it('uses only defined catalog terms and aliases', () => {
    const match = createGlossaryMatcher(content.glossary);
    expect(
      match('DLP for agents').some((part) => typeof part !== 'string' && part.entry.id === 'dlp'),
    ).toBe(true);
  });
});
