import { useEffect, useRef } from 'react';
import { matchPath, NavLink, useLocation } from 'react-router';
import { content } from '../lib/content/index.ts';
import type { Site } from '../lib/content/schemas.ts';
import styles from './LibraryMenu.module.css';

type NavKey = keyof Site['ui']['nav'];

const EXPLORE: { key: NavKey; to: string }[] = [
  { key: 'fit', to: '/fit' },
  { key: 'access', to: '/access' },
  { key: 'capabilities', to: '/capabilities' },
  { key: 'patterns', to: '/patterns' },
  { key: 'learn', to: '/learn' },
];
const PACK: { key: NavKey; to: string }[] = [
  { key: 'portfolio', to: '/portfolio' },
  { key: 'workshop', to: '/workshop' },
  { key: 'methodology', to: '/methodology' },
];

function LibraryDetails({ active }: { active: boolean }) {
  const { nav, library } = content.site.ui;
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const element = menu.current;
    if (element === null) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !element.open) return;
      element.open = false;
      element.querySelector('summary')?.focus();
    };
    element.addEventListener('keydown', close);
    return () => element.removeEventListener('keydown', close);
  }, []);

  const link = (item: { key: NavKey; to: string }) => (
    <li key={item.key}>
      <NavLink
        to={item.to}
        className={({ isActive }) => (isActive ? `${styles.link} ${styles.current}` : styles.link)}
      >
        {nav[item.key]}
      </NavLink>
    </li>
  );

  return (
    <li className={styles.item}>
      <details
        ref={menu}
        className={active ? `${styles.menu} ${styles.active}` : styles.menu}
        // Tabbing or clicking away closes the menu, as a native menu would.
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            event.currentTarget.open = false;
        }}
      >
        <summary>{nav.library}</summary>
        <div className={styles.panel}>
          <p className={styles.heading}>{library.exploreHeading}</p>
          <ul>{EXPLORE.map(link)}</ul>
          <p className={styles.heading}>{library.packHeading}</p>
          <ul>{PACK.map(link)}</ul>
        </div>
      </details>
    </li>
  );
}

/** Stack fit, capabilities, scenarios, learning pages and the customer pack: the reference material behind the main steps. */
export function LibraryMenu() {
  const { pathname } = useLocation();
  const active = [...EXPLORE, ...PACK].some(
    (item) => matchPath({ path: item.to, end: false }, pathname) !== null,
  );
  // A new page starts with the menu closed: keying on the path remounts it, with no effect to wait for.
  return <LibraryDetails key={pathname} active={active} />;
}
