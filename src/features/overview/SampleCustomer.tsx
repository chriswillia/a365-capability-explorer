import { useState } from 'react';
import { useNavigate } from 'react-router';
import { content } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import {
  addSampleCustomer,
  removeSampleCustomer,
  resetSampleCustomer,
  sampleCustomer,
} from '../../lib/state/sample.ts';
import { savedWorkspaceChanged, useSavedWorkspace } from '../../lib/state/workspace.ts';
import styles from './OverviewPage.module.css';

/**
 * Loads, opens, resets and removes the fictional sample customer. It lives in this browser like any other
 * customer, is marked as sample data wherever it appears, and removing it leaves every real customer alone.
 */
export default function SampleCustomer() {
  const copy = content.site.ui.sample;
  const navigate = useNavigate();
  const data = useSavedWorkspace();
  const [message, setMessage] = useState<string | null>(null);
  const loaded = sampleCustomer(data) !== undefined;
  const titles = copy.sampleIds.map(
    (id) => content.samples.find((sample) => sample.id === id)?.title ?? id,
  );

  const open = () => {
    const result = addSampleCustomer();
    if (!result.ok) {
      setMessage(copy.error);
      return;
    }
    navigate(`/map?assessment=${result.assessmentId}`);
  };
  const reset = () => {
    setMessage(resetSampleCustomer().ok ? copy.resetDone : copy.error);
    savedWorkspaceChanged();
  };
  const remove = () => {
    setMessage(removeSampleCustomer() ? copy.removed : copy.error);
    savedWorkspaceChanged();
  };

  return (
    <section aria-labelledby="sample-heading" className={styles.section}>
      <h2 id="sample-heading">{copy.heading}</h2>
      <p>{renderTemplate(copy.body, { count: titles.length })}</p>
      <p className={styles.hint}>
        {copy.agentsLabel}: {titles.join('; ')}
      </p>
      <p className={styles.sampleActions}>
        <button type="button" onClick={open}>
          {loaded ? copy.open : copy.load}
        </button>
        {loaded && (
          <>
            <button type="button" onClick={reset}>
              {copy.reset}
            </button>
            <button type="button" onClick={remove}>
              {copy.remove}
            </button>
          </>
        )}
      </p>
      <p role="status" className={styles.hint}>
        {message ?? ''}
      </p>
    </section>
  );
}
