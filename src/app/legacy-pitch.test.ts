import { describe, expect, it } from 'vitest';
import { conversationDestination, pitchDestination } from './legacy-pitch.ts';

const at = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });

describe('where an old Pitch address goes', () => {
  it.each([
    ['the bare address', '', '', at('/capabilities')],
    ['the first part, Say it', '', '#pitch', at('/capabilities')],
    ['a section that no longer exists', '', '#proof', at('/capabilities')],
    [
      'the preparation part, which kept only the pushback',
      '?view=prepare',
      '',
      at('/fit', '', '#pushback'),
    ],
    ['the pushback section', '?view=prepare', '#pushback', at('/fit', '', '#pushback')],
    ['the meeting part', '?view=run', '', at('/patterns', '?view=conversation', '#conversation')],
    [
      'the conversation guide',
      '',
      '#conversation',
      at('/patterns', '?view=conversation', '#conversation'),
    ],
    [
      'a requirement area of the guide',
      '?audience=security&view=run',
      '#requirement-secure',
      at('/patterns', '?view=conversation', '#requirement-secure'),
    ],
    ['the joint plan', '?view=run', '#team', at('/patterns', '?view=conversation', '#team')],
    ['the value brief part', '?view=brief', '', at('/brief')],
    [
      'the value brief with the outcomes that were chosen',
      '?view=brief&concerns=protect-data,control-reach',
      '',
      at('/brief', '?concerns=protect-data%2Ccontrol-reach'),
    ],
    ['the value brief section', '', '#brief', at('/brief')],
  ])('sends %s to where it moved', (_name, search, hash, expected) => {
    expect(pitchDestination(search, hash)).toEqual(expected);
  });

  it('reads an address with a malformed escape as a section that no longer exists', () => {
    expect(pitchDestination('', '#%E0%A4%A')).toEqual(at('/capabilities'));
  });
});

describe('where the old conversation address goes', () => {
  it('opens the guide on Scope an agent', () => {
    expect(conversationDestination('', '')).toEqual(
      at('/patterns', '?view=conversation', '#conversation'),
    );
  });

  it('keeps the rest of the query string and a hash that points inside the guide', () => {
    expect(conversationDestination('?audience=security', '#requirement-govern')).toEqual(
      at('/patterns', '?audience=security&view=conversation', '#requirement-govern'),
    );
  });
});
