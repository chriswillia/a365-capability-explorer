import { useId } from 'react';
import { ToggleButton } from '@fluentui/react-components';
import { content } from '../lib/content/index.ts';
import { useDepth } from '../lib/state/depth.ts';
import styles from './ViewDepthToggle.module.css';

/** The global Executive | Technical switch. Executive shows outcomes; Technical adds product areas and evidence. */
export function ViewDepthToggle() {
  const { depth, setDepth } = useDepth();
  const { depth: labels } = content.site.ui;
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
        <ToggleButton
          shape="square"
          size="small"
          appearance={depth === 'executive' ? 'primary' : 'outline'}
          checked={depth === 'executive'}
          onClick={() => setDepth('executive')}
        >
          {labels.executive}
        </ToggleButton>
        <ToggleButton
          shape="square"
          size="small"
          appearance={depth === 'technical' ? 'primary' : 'outline'}
          checked={depth === 'technical'}
          onClick={() => setDepth('technical')}
        >
          {labels.technical}
        </ToggleButton>
      </div>
      <span id={hintId} className={styles.hint}>
        {labels.hint}
      </span>
    </div>
  );
}
