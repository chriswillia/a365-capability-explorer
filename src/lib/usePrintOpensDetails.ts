import { useEffect } from 'react';

/**
 * Opens every disclosure marked data-print-open while the page prints, so what a seller hides on screen, such as
 * a statement's sources, still reaches the paper, and then puts back the ones that were closed.
 */
export function usePrintOpensDetails(): void {
  useEffect(() => {
    const opened: HTMLDetailsElement[] = [];
    const before = () => {
      for (const element of document.querySelectorAll<HTMLDetailsElement>(
        'details[data-print-open]:not([open])',
      )) {
        element.open = true;
        opened.push(element);
      }
    };
    const after = () => {
      for (const element of opened) element.open = false;
      opened.length = 0;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
}
