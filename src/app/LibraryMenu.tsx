import { matchPath, NavLink, useLocation } from 'react-router';
import { MenuDetails } from '../components/MenuDetails.tsx';
import { content } from '../lib/content/index.ts';
import type { Site } from '../lib/content/schemas.ts';
import styles from './LibraryMenu.module.css';

type NavKey = keyof Site['ui']['nav'];

const EXPLORE: { key: NavKey; to: string }[] = [
  { key: 'fit', to: '/fit' },
  { key: 'access', to: '/access' },
  { key: 'capabilities', to: '/capabilities' },
  { key: 'learn', to: '/learn' },
];
const PACK: { key: NavKey; to: string }[] = [
  { key: 'portfolio', to: '/portfolio' },
  { key: 'workshop', to: '/workshop' },
  { key: 'methodology', to: '/methodology' },
];

function MoreDetails({ active }: { active: boolean }) {
  const { nav, library } = content.site.ui;
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
      <MenuDetails
        summary={nav.library}
        className={active ? `${styles.menu} ${styles.active}` : styles.menu}
        panelClassName={styles.panel}
      >
        <p className={styles.heading}>{library.exploreHeading}</p>
        <ul>{EXPLORE.map(link)}</ul>
        <p className={styles.heading}>{library.packHeading}</p>
        <ul>{PACK.map(link)}</ul>
      </MenuDetails>
    </li>
  );
}

/** Stack fit, the capabilities, Learn and the customer pack: the reference material behind the main steps. */
export function LibraryMenu() {
  const { pathname } = useLocation();
  const active = [...EXPLORE, ...PACK].some(
    (item) => matchPath({ path: item.to, end: false }, pathname) !== null,
  );
  // A new page starts with the menu closed: keying on the path remounts it, with no effect to wait for.
  return <MoreDetails key={pathname} active={active} />;
}
