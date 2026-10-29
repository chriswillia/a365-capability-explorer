import { DataTable, type Column } from '../../components/DataTable.tsx';
import { content } from '../../lib/content/index.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import styles from './TeamAndProof.module.css';

type PlanRow = (typeof content.value.jointPlan.rows)[number];

/** A suggested split of the work between the AI seller and the Security seller. */
export function JointPlan() {
  const copy = content.value.jointPlan;
  const columns: Column<PlanRow>[] = [
    { key: 'topic', header: copy.columns.topic, rowHeader: true, render: (r) => r.topic },
    { key: 'ai', header: copy.columns.ai, render: (r) => r.ai },
    { key: 'security', header: copy.columns.security, render: (r) => r.security },
    { key: 'together', header: copy.columns.together, render: (r) => r.together },
  ];
  return (
    <section id="team" aria-labelledby="team-heading" data-no-print className={styles.section}>
      <h2 id="team-heading">{copy.heading}</h2>
      <p>{copy.intro}</p>
      <DataTable
        caption={copy.heading}
        hideCaption
        scrollLabel={renderTemplate(content.site.readout.tableLabel, { label: copy.heading })}
        columns={columns}
        rows={copy.rows}
        rowKey={(row) => row.id}
      />
    </section>
  );
}

/** A small, time-boxed proof with one real agent, and the measures to agree with the customer. */
export function ProofOfValue() {
  const copy = content.value.proofOfValue;
  return (
    <section
      id="proof-of-value"
      aria-labelledby="pov-heading"
      data-no-print
      className={styles.section}
    >
      <h2 id="pov-heading">{copy.heading}</h2>
      <p>{copy.intro}</p>
      <ol className={styles.steps}>
        {copy.steps.map((step) => (
          <li key={step.id}>
            <strong>{step.title}.</strong> {step.detail}
          </li>
        ))}
      </ol>
      <h3>{copy.measuresHeading}</h3>
      <ul className={styles.plain}>
        {copy.measures.map((measure) => (
          <li key={measure}>{measure}</li>
        ))}
      </ul>
      <p className={styles.meta}>{copy.note}</p>
    </section>
  );
}
