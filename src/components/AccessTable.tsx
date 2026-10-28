import { Link } from 'react-router';
import { content } from '../lib/content/index.ts';
import type { AccessPatterns } from '../lib/content/schemas.ts';
import { renderTemplate } from '../lib/content/template.ts';
import { Badge, type BadgeTone } from './Badge.tsx';
import { DataTable, type Column } from './DataTable.tsx';
import { SourceNote } from './SourceNote.tsx';

type Row = AccessPatterns['capabilities'][number];

const TONE: Record<Row['delegated'], BadgeTone> = {
  applies: 'info',
  differs: 'amber',
  'not-stated': 'neutral',
};

/** What Microsoft's documentation says about each capability under each way of acting. A table, so it needs no alternative. */
export function AccessTable() {
  const copy = content.accessPatterns;
  const cell = (value: Row['delegated']) => (
    <Badge tone={TONE[value]}>{copy.applicability[value]}</Badge>
  );
  const columns: Column<Row>[] = [
    {
      key: 'capability',
      header: copy.columns.capability,
      rowHeader: true,
      render: (row) => {
        const capability = content.capabilities.find((c) => c.id === row.capabilityId);
        return capability === undefined ? (
          row.capabilityId
        ) : (
          <Link to={`/capabilities/${capability.id}`}>{capability.shortName}</Link>
        );
      },
    },
    { key: 'delegated', header: copy.columns.delegated, render: (row) => cell(row.delegated) },
    { key: 'own', header: copy.columns.own, render: (row) => cell(row.own) },
    {
      key: 'agentAccount',
      header: copy.columns.agentAccount,
      render: (row) => cell(row.agentAccount),
    },
    {
      key: 'note',
      header: copy.columns.note,
      render: (row) => (
        <>
          {row.note}
          <SourceNote
            sourceIds={row.sourceIds}
            evidence={row.evidence}
            lastVerified={row.lastVerified}
          />
        </>
      ),
    },
  ];
  return (
    <DataTable
      caption={copy.statedHeading}
      hideCaption
      scrollLabel={renderTemplate(content.site.readout.tableLabel, { label: copy.statedHeading })}
      columns={columns}
      rows={copy.capabilities}
      rowKey={(row) => row.capabilityId}
    />
  );
}
