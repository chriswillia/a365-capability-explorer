import { CheckmarkCircle16Regular, Prohibited16Regular } from '@fluentui/react-icons';
import { Badge } from '../../components/Badge.tsx';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { ExternalLink } from '../../components/ExternalLink.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import {
  consoleById,
  content,
  controlPointById,
  pillarById,
  sourceById,
  values,
} from '../../lib/content/index.ts';
import { licensingTier, primaryControlPoint, sourcesDiffer } from '../../lib/content/derive.ts';
import type { Capability } from '../../lib/content/schemas.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './CapabilitiesPage.module.css';

function CapabilityCell({ capability, technical }: { capability: Capability; technical: boolean }) {
  const { capabilities: copy, ui } = content.site;
  const { badges } = ui;

  return (
    <div className={styles.cell}>
      <span className={styles.name}>{capability.shortName}</span>
      {technical ? (
        <>
          <code className={styles.id}>{capability.id}</code>
          <span className={styles.wording}>
            {copy.officialWording}: “{capability.source.featureText}”
          </span>
          {(capability.dependencies ?? []).map((dependency) => {
            const source = sourceById(dependency.sourceId);
            return (
              <span key={dependency.note} className={styles.wording}>
                {copy.dependencyPrefix}: {dependency.note}
                {source !== undefined && (
                  <>
                    {' '}
                    (<ExternalLink href={source.url}>{source.title}</ExternalLink>)
                  </>
                )}
              </span>
            );
          })}
        </>
      ) : (
        capability.executiveValue !== undefined && (
          <span className={styles.detail}>{capability.executiveValue}</span>
        )
      )}
      <span className={styles.badges}>
        {capability.reviewStatus === 'draft' ? (
          <Badge tone="draft">{badges.draft}</Badge>
        ) : (
          <Badge tone="outline">{badges.reviewed}</Badge>
        )}
        {capability.status === 'preview' && <Badge tone="neutral">{badges.preview}</Badge>}
        {capability.status === 'frontier-preview' && (
          <Badge tone="neutral">{badges.frontierPreview}</Badge>
        )}
        {sourcesDiffer(capability) && <Badge tone="amber">{badges.sourcesDiffer}</Badge>}
      </span>
    </div>
  );
}

export function Component() {
  usePageTitle('capabilities');
  const { depth } = useDepth();
  const technical = depth === 'technical';
  const { site, capabilities } = content;
  const { capabilities: copy, ui } = site;
  const { badges } = ui;

  const licensing: Column<Capability> = {
    key: 'licensing',
    header: copy.columns.licensing,
    render: (c) =>
      licensingTier(c) === 'foundational' ? (
        <Badge tone="outline">{badges.foundational}</Badge>
      ) : (
        <Badge tone="info">{badges.premium}</Badge>
      ),
  };

  const columns: Column<Capability>[] = [
    {
      key: 'capability',
      header: copy.columns.capability,
      rowHeader: true,
      render: (c) => <CapabilityCell capability={c} technical={technical} />,
    },
    {
      key: 'pillar',
      header: copy.columns.pillar,
      nowrap: true,
      render: (c) => pillarById(c.pillar)?.label,
    },
  ];
  if (technical) {
    columns.push(
      {
        key: 'console',
        header: copy.columns.console,
        render: (c) => consoleById(c.source.console)?.displayName,
      },
      {
        key: 'layer',
        header: copy.columns.layer,
        render: (c) => controlPointById(primaryControlPoint(c))?.layer,
      },
      { key: 'setup', header: copy.columns.setup, render: (c) => ui.setup[c.setup] },
      licensing,
      {
        key: 'gcc',
        header: copy.columns.gcc,
        nowrap: true,
        render: (c) =>
          c.source.gccAvailable ? (
            <Badge tone="outline" icon={<CheckmarkCircle16Regular />}>
              {badges.gccAvailable}
            </Badge>
          ) : (
            <Badge tone="neutral" icon={<Prohibited16Regular />}>
              {badges.gccUnavailable}
            </Badge>
          ),
      },
      {
        key: 'wave',
        header: copy.columns.wave,
        nowrap: true,
        render: (c) => renderTemplate(copy.waveLabel, { n: c.defaultWave }),
      },
    );
  } else {
    columns.push(licensing);
  }

  return (
    <PageContainer>
      <PageHeading>{site.routes.capabilities.title}</PageHeading>
      <p className={styles.intro}>{copy.intro}</p>
      <DataTable
        caption={renderTemplate(copy.tableCaption, values)}
        columns={columns}
        rows={capabilities}
        rowKey={(c) => c.id}
        scrollLabel={copy.scrollRegionLabel}
      />
      {capabilities.some(sourcesDiffer) && <p className={styles.note}>{copy.sourcesDifferNote}</p>}
      <p className={styles.note}>{copy.draftNote}</p>
    </PageContainer>
  );
}
