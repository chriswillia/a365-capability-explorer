import { useEffect, useRef, useState } from 'react';
import { content } from '../lib/content/index.ts';

export function PresentationControls() {
  const [presenting, setPresenting] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const copy = content.site.presentation;
  useEffect(() => {
    if (!presenting) return;
    document.body.setAttribute('data-presentation-mode', '');
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setPresenting(false);
      button.current?.focus();
    };
    window.addEventListener('keydown', escape);
    return () => {
      document.body.removeAttribute('data-presentation-mode');
      window.removeEventListener('keydown', escape);
    };
  }, [presenting]);
  return (
    <div data-no-print>
      <button
        ref={button}
        type="button"
        aria-pressed={presenting}
        onClick={() => setPresenting(!presenting)}
      >
        {presenting ? copy.exit : copy.enter}
      </button>
      {presenting && <p role="status">{copy.note}</p>}
    </div>
  );
}
