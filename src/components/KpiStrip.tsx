import styles from './KpiStrip.module.css';

export interface Kpi {
  id: string;
  label: string;
  value: string;
  note?: string;
}

/** A row of headline numbers. In the DOM the label comes before the value, so a screen reader hears "label: value". */
export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <dl className={styles.strip}>
      {items.map((item) => (
        <div key={item.id} className={styles.tile}>
          <dt className={styles.label}>{item.label}</dt>
          <dd className={styles.value}>{item.value}</dd>
          {item.note !== undefined && <dd className={styles.note}>{item.note}</dd>}
        </div>
      ))}
    </dl>
  );
}
