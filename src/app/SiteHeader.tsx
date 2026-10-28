import { lazy, Suspense, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { content } from '../lib/content/index.ts';
import type { Site } from '../lib/content/schemas.ts';
import { LibraryMenu } from './LibraryMenu.tsx';
import { ViewMenu } from './ViewMenu.tsx';
import styles from './SiteHeader.module.css';

// The customer shortcut reads local storage, so it loads after the first paint instead of with the landing page.
const CurrentCustomer = lazy(() => import('./CurrentCustomer.tsx'));

// What a seller does, in order, with the example agents ahead of the customer's own agent. The logo is the link
// home. The reference material lives in the More menu.
const NAV: { key: keyof Site['ui']['nav']; to: string }[] = [
  { key: 'pitch', to: '/pitch' },
  { key: 'patterns', to: '/patterns' },
  { key: 'map', to: '/map' },
  { key: 'licensing', to: '/licensing' },
  { key: 'deploy', to: '/deploy' },
];

export function SiteHeader() {
  const { productName, ui } = content.site;
  const { pathname } = useLocation();
  // On a phone the links sit behind a Menu button. The menu is open only on the page it was opened on, so it
  // closes by itself after a link is followed, with no effect to wait for.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <header className={styles.header} data-no-print>
      <div className={styles.row}>
        <Link to="/" className={styles.brand} aria-label={ui.homeLinkLabel}>
          <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <rect width="32" height="32" rx="4" className={styles.markBase} />
            <path d="M5 21 Q16 8 27 21" className={styles.markArc} />
            <circle cx="16" cy="12" r="2.2" className={styles.markSun} />
          </svg>
          <span className={styles.name}>{productName}</span>
        </Link>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls="site-links"
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          {ui.menuLabel}
        </button>
        <div id="site-links" className={open ? `${styles.links} ${styles.open}` : styles.links}>
          <nav aria-label={ui.mainNavLabel} className={styles.nav}>
            <ul>
              {NAV.map((item) => (
                <li key={item.key}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      isActive ? `${styles.link} ${styles.active}` : styles.link
                    }
                  >
                    {ui.nav[item.key]}
                  </NavLink>
                </li>
              ))}
              <LibraryMenu />
            </ul>
          </nav>
          <div className={styles.end}>
            <Suspense fallback={null}>
              <CurrentCustomer />
            </Suspense>
            <ViewMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
