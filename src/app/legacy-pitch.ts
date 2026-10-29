export interface Destination {
  pathname: string;
  search: string;
  hash: string;
}

const anchorOf = (hash: string): string => {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
};

/** Scope an agent, on the part that holds the conversation guide. The rest of the query string and the hash stay. */
export function conversationDestination(search: string, hash: string): Destination {
  const params = new URLSearchParams(search);
  params.set('view', 'conversation');
  return {
    pathname: '/patterns',
    search: `?${params.toString()}`,
    hash: hash === '' ? '#conversation' : hash,
  };
}

const CONVERSATION_ANCHORS = new Set(['conversation', 'team', 'proof-of-value']);

/**
 * The Pitch page is gone, but its address still answers. A link into one of the parts that moved goes to where it
 * went: the conversation guide to Scope an agent, the answers to pushback to Stack fit and the value brief to its
 * own page, with the outcomes that were chosen. Anything else the page held goes to the capabilities, where a
 * seller now starts.
 */
export function pitchDestination(search: string, hash: string): Destination {
  const anchor = anchorOf(hash);
  const params = new URLSearchParams(search);
  const view = params.get('view');
  if (
    CONVERSATION_ANCHORS.has(anchor) ||
    anchor.startsWith('conversation-') ||
    anchor.startsWith('requirement-') ||
    (anchor === '' && view === 'run')
  )
    return conversationDestination('', hash);
  if (anchor === 'pushback' || (anchor === '' && view === 'prepare'))
    return { pathname: '/fit', search: '', hash: '#pushback' };
  if (anchor.startsWith('brief') || (anchor === '' && view === 'brief')) {
    const concerns = params.get('concerns');
    return {
      pathname: '/brief',
      search: concerns === null ? '' : `?${new URLSearchParams({ concerns }).toString()}`,
      hash: '',
    };
  }
  return { pathname: '/capabilities', search: '', hash: '' };
}
