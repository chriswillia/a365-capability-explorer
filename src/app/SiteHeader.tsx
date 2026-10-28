import { lazy, Suspense } from 'react';
import { Link, NavLink } from 'react-router';
import { AudienceToggle } from '../components/AudienceToggle.tsx';
import { ViewDepthToggle } from '../components/ViewDepthToggle.tsx';
import { content } from '../lib/content/index.ts';
import type { Site } from '../lib/content/schemas.ts';
import { LibraryMenu } from './LibraryMenu.tsx';
import styles from './SiteHeader.module.css';

// The customer shortcut reads local storage, so it loads after the first paint instead of with the landing page.
const CurrentCustomer = lazy(() => import('./CurrentCustomer.tsx'));

// The four jobs of a customer conversation, in order. The reference material lives in the Library menu.
const NAV: { key: keyof Site['ui']['nav']; to: string; end?: boolean }[] = [
  { key: 'overview', to: '/', end: true },
  { key: 'pitch', to: '/pitch' },
  { key: 'map', to: '/diagnostic' },
  { key: 'licensing', to: '/licensing' },
];

export function SiteHeader() {
  const { productName, ui } = content.site;

  return (
    <header className={styles.header} data-no-print>
      <div className={styles.top}>
        <Link to="/" className={styles.brand} aria-label={ui.homeLinkLabel}>
          <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <rect width="32" height="32" rx="4" className={styles.markBase} />
            <path d="M5 21 Q16 8 27 21" className={styles.markArc} />
            <circle cx="16" cy="12" r="2.2" className={styles.markSun} />
          </svg>
          <span className={styles.name}>{productName}</span>
        </Link>
        <div className={styles.tools}>
          <AudienceToggle />
          <ViewDepthToggle />
        </div>
      </div>
      <div className={styles.bar}>
        <nav aria-label={ui.mainNavLabel} className={styles.nav}>
          <ul>
            {NAV.map((item) => (
              <li key={item.key}>
                <NavLink
                  to={item.to}
                  end={item.end}
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
        <Suspense fallback={null}>
          <CurrentCustomer />
        </Suspense>
      </div>
    </header>
  );
}
