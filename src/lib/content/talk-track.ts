import type { Capability, Content } from './schemas.ts';

/**
 * What to say about a capability, in the seller's voice: the outcome in a sentence and what changes with it, taken
 * from the capability's own editorial text, so a talk track says nothing the capability page does not already say.
 */
export function talkTrack(capability: Capability): string {
  return [capability.executiveValue ?? capability.summary, capability.withIt]
    .filter((part): part is string => part !== undefined && part.trim() !== '')
    .join(' ');
}

/** The talk track and the questions to ask, as plain text to paste into notes or an email. */
export function talkTrackText(data: Content, capability: Capability): string {
  const copy = data.site.capabilities.brief;
  const questions = capability.discoveryQuestions ?? [];
  return [
    capability.shortName,
    '',
    `${copy.talkTrack}: ${talkTrack(capability)}`,
    ...(questions.length === 0 ? [] : ['', `${copy.askLabel}:`, ...questions.map((q) => `- ${q}`)]),
  ].join('\n');
}
