import { useId } from 'react';
import { ToggleButton } from '@fluentui/react-components';
import { content } from '../lib/content/index.ts';
import { useDepth } from '../lib/state/depth.ts';
import styles from './TechnicalSwitch.module.css';

/**
 * The one setting in the header. Off, a page shows outcomes in plain language. On, it adds where each capability
 * is configured, the layer it acts on and the evidence behind each statement. The state is written out as well
 * as shown by the fill, so color is never the only signal.
 */
export function TechnicalSwitch() {
  const { depth, setDepth } = useDepth();
  const copy = content.site.ui.depth;
  const hintId = useId();
  const on = depth === 'technical';

  return (
    <>
      <ToggleButton
        shape="square"
        size="small"
        appearance={on ? 'primary' : 'outline'}
        checked={on}
        title={copy.hint}
        aria-describedby={hintId}
        onClick={() => setDepth(on ? 'executive' : 'technical')}
      >
        {copy.technical}
        <span aria-hidden="true" className={styles.state}>
          {on ? copy.on : copy.off}
        </span>
      </ToggleButton>
      <span id={hintId} className="visually-hidden">
        {copy.hint}
      </span>
    </>
  );
}
