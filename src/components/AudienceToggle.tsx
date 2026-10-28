import { useId } from 'react';
import { ToggleButton } from '@fluentui/react-components';
import { content } from '../lib/content/index.ts';
import { AUDIENCES } from '../lib/content/constants.ts';
import { useAudience } from '../lib/state/audience.ts';
import styles from './AudienceToggle.module.css';

/**
 * The global Selling as switch: AI seller, Security seller or both. It changes the pitch and talk tracks on the
 * value pages. The facts, sources and recommendations never change with it.
 */
export function AudienceToggle() {
  const { audience, setAudience } = useAudience();
  const labels = content.site.ui.audience;
  const hintId = useId();

  return (
    <div className={styles.wrapper}>
      <span className={styles.label} aria-hidden="true">
        {labels.label}
      </span>
      <div
        role="group"
        aria-label={labels.groupLabel}
        aria-describedby={hintId}
        className={styles.group}
      >
        {AUDIENCES.map((id) => (
          <ToggleButton
            key={id}
            shape="square"
            size="small"
            appearance={audience === id ? 'primary' : 'outline'}
            checked={audience === id}
            onClick={() => setAudience(id)}
          >
            {labels[id]}
          </ToggleButton>
        ))}
      </div>
      <span id={hintId} className={styles.hint}>
        {labels.hint}
      </span>
    </div>
  );
}
