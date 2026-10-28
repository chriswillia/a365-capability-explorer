import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { content } from '../lib/content/index.ts';
import { useViewAddress, type PageView } from '../lib/useView.ts';
import styles from './ViewSwitcher.module.css';

/**
 * What one view shows. A view that holds typed-in work passes `keep`, so it stays mounted but hidden when another
 * view is showing and leaving it does not lose what was entered.
 */
export function ViewPane({
  view,
  id,
  keep = false,
  children,
}: {
  view: PageView;
  id: string;
  keep?: boolean;
  children: ReactNode;
}) {
  const showing = view.id === id;
  if (!showing && !keep) return null;
  return <div hidden={!showing}>{children}</div>;
}

// Set when a seller steps to the next or previous view, so focus can follow them to the top of the new one.
let focusSwitcher = false;

/**
 * The views of a long page as links, so only one is on screen at a time. They are links, not tabs: each view has
 * an address, the Back button steps between views, and a link can open the page on the view it needs.
 */
export function ViewSwitcher({
  views,
  current,
}: {
  views: readonly PageView[];
  current: PageView;
}) {
  const address = useViewAddress(views);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!focusSwitcher) return;
    focusSwitcher = false;
    list.current?.querySelector<HTMLElement>('[aria-current]')?.focus({ preventScroll: true });
  }, [current.id]);

  return (
    <nav aria-label={content.site.ui.views.label} className={styles.switcher} data-no-print>
      <ul ref={list}>
        {views.map((view) => (
          <li key={view.id}>
            <Link
              to={address(view)}
              aria-current={view.id === current.id ? 'true' : undefined}
              className={view.id === current.id ? `${styles.link} ${styles.current}` : styles.link}
            >
              {view.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Previous and next view at the foot of a view, so a seller can work through a page in order. */
export function ViewPager({ views, current }: { views: readonly PageView[]; current: PageView }) {
  const address = useViewAddress(views);
  const { views: copy } = content.site.ui;
  const index = views.findIndex((view) => view.id === current.id);
  const previous = views[index - 1];
  const next = views[index + 1];
  if (previous === undefined && next === undefined) return null;
  const step = () => {
    focusSwitcher = true;
  };
  return (
    <nav aria-label={copy.pagerLabel} className={styles.pager} data-no-print>
      {previous !== undefined && (
        <Link to={address(previous)} rel="prev" onClick={step}>
          <span aria-hidden="true">← </span>
          {copy.previous}: {previous.label}
        </Link>
      )}
      {next !== undefined && (
        <Link to={address(next)} rel="next" className={styles.next} onClick={step}>
          {copy.next}: {next.label}
          <span aria-hidden="true"> →</span>
        </Link>
      )}
    </nav>
  );
}
