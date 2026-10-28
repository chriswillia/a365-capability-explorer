import { useState, type ReactNode } from 'react';
import { content } from '../../lib/content/index.ts';
import type { Capability } from '../../lib/content/schemas.ts';
import { talkTrack, talkTrackText } from '../../lib/content/talk-track.ts';
import styles from './CapabilitiesPage.module.css';

/** What to say about one capability, with a button that copies it, and the questions to ask, as text. */
export function TalkTrack({
  capability,
  annotate,
}: {
  capability: Capability;
  annotate: (text: string) => ReactNode;
}) {
  const copy = content.site.capabilities.brief;
  const [copied, setCopied] = useState(false);
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(talkTrackText(content, capability));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section aria-labelledby="say-heading" className={styles.say}>
      <h2 id="say-heading">{copy.talkTrack}</h2>
      <p>{annotate(talkTrack(capability))}</p>
      <p className={styles.sayActions}>
        <button type="button" onClick={() => void copyText()}>
          {copy.copyTalkTrack}
        </button>
        <span role="status">{copied ? copy.talkTrackCopied : ''}</span>
      </p>
    </section>
  );
}
