import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A native disclosure used as a menu. Escape closes it and returns focus to its summary, a press anywhere outside
 * it closes it, and so does tabbing out of it. Closing on the press, not on the focus leaving, keeps it open while
 * the pointer is still inside it in browsers that do not focus a button when it is clicked, and a program moving
 * focus, as a page does when it loads, does not close it.
 */
export function MenuDetails({
  summary,
  className,
  panelClassName,
  children,
}: {
  summary: ReactNode;
  className?: string;
  panelClassName?: string;
  children: ReactNode;
}) {
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const element = menu.current;
    if (element === null) return;
    let tabbed = false;
    const closeOutside = (event: Event) => {
      if (element.open && !element.contains(event.target as Node | null)) element.open = false;
    };
    const noteKey = (event: KeyboardEvent) => {
      tabbed = event.key === 'Tab';
    };
    const closeOnTabOut = (event: FocusEvent) => {
      if (tabbed) closeOutside(event);
      tabbed = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !element.open) return;
      element.open = false;
      element.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', noteKey, true);
    document.addEventListener('focusin', closeOnTabOut);
    element.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', noteKey, true);
      document.removeEventListener('focusin', closeOnTabOut);
      element.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <details ref={menu} className={className}>
      <summary>{summary}</summary>
      <div className={panelClassName}>{children}</div>
    </details>
  );
}
