import { matchPath, NavLink, useLocation } from 'react-router';
import { MenuDetails } from '../components/MenuDetails.tsx';
import { content } from '../lib/content/index.ts';
import type { Site } from '../lib/content/schemas.ts';
import styles from './LibraryMenu.module.css';

type NavKey = keyof Site['ui']['nav'];

// Reference pages a seller opens now and then, behind the steps they do in order.
const REFERENCE: { key: NavKey; to: string }[] = [
  { key: 'capabilities', to: '/capabilities' },
  { key: 'access', to: '/access' },
  { key: 'learn', to: '/learn' },
  { key: 'methodology', to: '/methodology' },
];

function MoreDetails({ active }: { active: boolean }) {
  const { nav } = content.site.ui;

  return (
    <li className={styles.item}>
      <MenuDetails
        summary={nav.library}
        className={active ? `${styles.menu} ${styles.active}` : styles.menu}
        panelClassName={styles.panel}
      >
        <ul>
          {REFERENCE.map((item) => (
            <li key={item.key}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.current}` : styles.link
                }
              >
                {nav[item.key]}
              </NavLink>
            </li>
          ))}
        </ul>
      </MenuDetails>
    </li>
  );
}

/** The capabilities, how agents act, Learn and how recommendations work: the reference pages behind the steps. */
export function LibraryMenu() {
  const { pathname } = useLocation();
  const active = REFERENCE.some(
    (item) => matchPath({ path: item.to, end: false }, pathname) !== null,
  );
  // A new page starts with the menu closed: keying on the path remounts it, with no effect to wait for.
  return <MoreDetails key={pathname} active={active} />;
}
