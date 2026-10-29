import { lazy, Suspense, useState } from 'react';
import { Link, matchPath, useLocation } from 'react-router';
import { content } from '../lib/content/index.ts';
import type { Site } from '../lib/content/schemas.ts';
import { LibraryMenu } from './LibraryMenu.tsx';
import { TechnicalSwitch } from './TechnicalSwitch.tsx';
import styles from './SiteHeader.module.css';

// The link to the agent a seller is working on reads local storage, so it loads after the first paint instead of
// with the landing page.
const WorkingOn = lazy(() => import('./WorkingOn.tsx'));

// What a seller does, in order. Scoping an agent starts at the examples and goes on to the agent's passport, so
// both pages mark it as current. The logo is the link home. The reference material lives in the More menu.
const NAV: { key: keyof Site['ui']['nav']; to: string; also?: string[] }[] = [
  { key: 'pitch', to: '/pitch' },
  { key: 'scope', to: '/patterns', also: ['/map'] },
  { key: 'fit', to: '/fit' },
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
  const within = (path: string) => matchPath({ path, end: false }, pathname) !== null;

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
              {NAV.map((item) => {
                const current = [item.to, ...(item.also ?? [])].some(within);
                return (
                  <li key={item.key}>
                    <Link
                      to={item.to}
                      className={current ? `${styles.link} ${styles.active}` : styles.link}
                      aria-current={pathname === item.to ? 'page' : current ? 'true' : undefined}
                    >
                      {ui.nav[item.key]}
                    </Link>
                  </li>
                );
              })}
              <LibraryMenu />
            </ul>
          </nav>
          <div className={styles.end}>
            <Suspense fallback={null}>
              <WorkingOn />
            </Suspense>
            <TechnicalSwitch />
          </div>
        </div>
      </div>
    </header>
  );
}
