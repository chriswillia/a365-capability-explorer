import { useId } from 'react';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content } from '../../lib/content/index.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './PrivacyPage.module.css';

type Stored = (typeof content.site.privacy.stored)[number];

export function Component() {
  usePageTitle('privacy');
  const { site } = content;
  const { privacy } = site;
  const storedId = useId();
  const hostedId = useId();

  const columns: Column<Stored>[] = [
    { key: 'what', header: privacy.storedColumns.what, rowHeader: true, render: (row) => row.what },
    { key: 'where', header: privacy.storedColumns.where, render: (row) => row.where },
    { key: 'why', header: privacy.storedColumns.why, render: (row) => row.why },
  ];

  return (
    <PageContainer narrow>
      <PageHeading>{site.routes.privacy.title}</PageHeading>
      <p className={styles.statement}>{privacy.statement}</p>
      <section aria-labelledby={storedId} className={styles.section}>
        <h2 id={storedId}>{privacy.storedHeading}</h2>
        <p>{privacy.storedIntro}</p>
        <DataTable
          caption={privacy.storedHeading}
          hideCaption
          columns={columns}
          rows={privacy.stored}
          rowKey={(row) => row.what}
        />
      </section>
      <section aria-labelledby={hostedId} className={styles.section}>
        <h2 id={hostedId}>{privacy.selfHostedHeading}</h2>
        <p>{privacy.selfHosted}</p>
      </section>
      <p className={styles.note}>{privacy.futureNote}</p>
    </PageContainer>
  );
}
