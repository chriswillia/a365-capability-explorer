import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { content } from '../lib/content/index.ts';
import { SiteFooter } from './SiteFooter.tsx';
import { SiteHeader } from './SiteHeader.tsx';
import styles from './AppShell.module.css';

export function AppShell() {
  const { ui } = content.site;
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  // After a client-side navigation, move focus to the new page's heading so keyboard and screen reader
  // users land at the top of the new page instead of staying on the link they activated.
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const heading = mainRef.current?.querySelector<HTMLElement>('[data-page-title]');
    (heading ?? mainRef.current)?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <a
        className={styles.skipLink}
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        {ui.skipToContent}
      </a>
      <div className={styles.banner} data-no-print>
        {ui.previewBanner}
      </div>
      <SiteHeader />
      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <SiteFooter />
      <ScrollRestoration />
    </div>
  );
}
