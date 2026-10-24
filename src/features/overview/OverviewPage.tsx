import { ButtonLink } from '../../components/ButtonLink.tsx';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { ExhibitFrame } from '../../components/ExhibitFrame.tsx';
import { HeroBand } from '../../components/HeroBand.tsx';
import { KeyTakeaway } from '../../components/KeyTakeaway.tsx';
import { KpiStrip, type Kpi } from '../../components/KpiStrip.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content, metrics, values } from '../../lib/content/index.ts';
import type { ConsoleDef, ControlPointDef } from '../../lib/content/schemas.ts';
import { formatNumber, renderTemplate } from '../../lib/content/template.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './OverviewPage.module.css';

const byOrder = <T extends { order: number }>(items: T[]) =>
  [...items].sort((a, b) => a.order - b.order);

export function Component() {
  usePageTitle('overview');
  const { depth } = useDepth();
  const { site } = content;
  const { overview } = site;
  const { glance, pillars, consoles, layers } = overview.exhibits;

  const kpis: Kpi[] = overview.kpis.map((kpi) => ({
    id: kpi.id,
    label: kpi.label,
    value: formatNumber(metrics[kpi.valueKey]),
    note: kpi.noteTemplate === undefined ? undefined : renderTemplate(kpi.noteTemplate, values),
  }));

  // "Most" is only said when it is true of the data.
  const platformMajority = metrics.platformShare > 0.5;
  const platformDetail = renderTemplate(overview.insights.platformDetail, values);

  const consoleColumns: Column<ConsoleDef>[] = [
    {
      key: 'console',
      header: consoles.columns.console,
      rowHeader: true,
      render: (c) => c.displayName,
    },
    { key: 'owner', header: consoles.columns.ownerTeam, render: (c) => c.ownerTeam },
    {
      key: 'count',
      header: consoles.columns.capabilities,
      numeric: true,
      render: (c) => formatNumber(metrics.byConsole[c.id]),
    },
    {
      key: 'gcc',
      header: consoles.columns.gcc,
      numeric: true,
      render: (c) => formatNumber(metrics.gccByConsole[c.id]),
    },
  ];

  const layerColumns: Column<ControlPointDef>[] = [
    { key: 'layer', header: layers.columns.layer, rowHeader: true, render: (cp) => cp.layer },
    { key: 'governs', header: layers.columns.governs, render: (cp) => cp.governs },
    {
      key: 'count',
      header: layers.columns.capabilities,
      numeric: true,
      render: (cp) => formatNumber(metrics.byControlPoint[cp.id]),
    },
  ];

  return (
    <>
      <HeroBand
        eyebrow={overview.heroEyebrow}
        title={<PageHeading>{site.productName}</PageHeading>}
        tagline={site.tagline}
        lede={overview.heroLede}
      >
        <ButtonLink to="/capabilities" variant="onDark">
          {overview.ctaExplore}
        </ButtonLink>
      </HeroBand>

      <div className={styles.page}>
        <ExhibitFrame
          number={1}
          label={glance.label}
          title={renderTemplate(glance.titleTemplate, values)}
          sourceIds={['sd-a365']}
          sourceNote={renderTemplate(glance.sourceNote, values)}
        >
          <KpiStrip items={kpis} />
          <KeyTakeaway detail={platformMajority ? platformDetail : undefined}>
            {platformMajority ? overview.insights.platformFoundation : platformDetail}
          </KeyTakeaway>
        </ExhibitFrame>

        <ExhibitFrame
          number={2}
          label={pillars.label}
          title={renderTemplate(pillars.titleTemplate, values)}
          sourceIds={['a365-overview']}
          sourceNote={pillars.sourceNote}
        >
          <ul className={styles.pillars}>
            {byOrder(content.pillars).map((pillar) => (
              <li key={pillar.id} className={styles.pillar}>
                <h3 className={styles.pillarName}>{pillar.label}</h3>
                <p className={styles.pillarCount}>
                  {renderTemplate(pillars.countLabel, { count: metrics.byPillar[pillar.id] })}
                </p>
                <p>{pillar.definition}</p>
              </li>
            ))}
          </ul>
        </ExhibitFrame>

        {depth === 'technical' ? (
          <>
            <ExhibitFrame
              number={3}
              label={consoles.label}
              title={renderTemplate(consoles.titleTemplate, values)}
              sourceIds={['sd-a365']}
              sourceNote={consoles.sourceNote}
            >
              <DataTable
                caption={consoles.label}
                hideCaption
                columns={consoleColumns}
                rows={byOrder(content.consoles)}
                rowKey={(c) => c.id}
              />
            </ExhibitFrame>
            <ExhibitFrame
              number={4}
              label={layers.label}
              title={renderTemplate(layers.titleTemplate, values)}
              sourceNote={layers.sourceNote}
            >
              <DataTable
                caption={layers.label}
                hideCaption
                columns={layerColumns}
                rows={byOrder(content.controlPoints)}
                rowKey={(cp) => cp.id}
              />
            </ExhibitFrame>
          </>
        ) : (
          <p className={styles.hint}>{overview.technicalHint}</p>
        )}
      </div>
    </>
  );
}
