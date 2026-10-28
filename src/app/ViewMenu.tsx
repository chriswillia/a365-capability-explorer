import { AudienceToggle } from '../components/AudienceToggle.tsx';
import { MenuDetails } from '../components/MenuDetails.tsx';
import { ViewDepthToggle } from '../components/ViewDepthToggle.tsx';
import { content } from '../lib/content/index.ts';
import { renderTemplate } from '../lib/content/template.ts';
import { useAudience } from '../lib/state/audience.ts';
import { useDepth } from '../lib/state/depth.ts';
import styles from './ViewMenu.module.css';

/**
 * Selling as and Detail level in one menu, so the header stays one row. The summary says what is chosen, so a
 * seller can see at a glance how the site is set without opening it.
 */
export function ViewMenu() {
  const { ui } = content.site;
  const { audience } = useAudience();
  const { depth } = useDepth();
  const summary = renderTemplate(ui.view.summary, {
    label: ui.view.label,
    audience: ui.audience[audience],
    depth: ui.depth[depth],
  });
  return (
    <MenuDetails summary={summary} className={styles.menu} panelClassName={styles.panel}>
      <AudienceToggle />
      <ViewDepthToggle />
    </MenuDetails>
  );
}
