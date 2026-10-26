import { CheckmarkCircle16Regular, Prohibited16Regular } from '@fluentui/react-icons';
import { Link, useSearchParams } from 'react-router';
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
import {
  belongsTo,
  createLensMembership,
  filterCapabilities,
  lensGroups,
  LENSES,
  MAX_COMPARE,
  readExplorerState,
  VIEWS,
} from './explorer.ts';

const membership = createLensMembership(content);

function CapabilityCell({ capability, technical }: { capability: Capability; technical: boolean }) {
  const { capabilities: copy, ui } = content.site;
  const { badges } = ui;

  return (
    <div className={styles.cell}>
      <Link className={styles.name} to={`/capabilities/${capability.id}`}>
        {capability.shortName}
      </Link>
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
  const [params, setParams] = useSearchParams();
  const state = readExplorerState(params, content);
  const explorer = copy.explorer;
  const groups = lensGroups(content, state.lens);
  const filtered = filterCapabilities(capabilities, state, membership);
  const compared = state.compare.flatMap((id) => capabilities.filter((c) => c.id === id));

  const update = (changes: Record<string, string | string[]>) => {
    const next = new URLSearchParams();
    const merged = {
      q: state.query,
      lens: state.lens,
      group: state.group,
      view: state.view,
      compare: state.compare,
      ...changes,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (Array.isArray(value)) value.forEach((item) => next.append(key, item));
      else if (value !== '') next.set(key, value);
    }
    setParams(next, { replace: 'q' in changes, preventScrollReset: true });
  };
  const comparisonControl = (c: Capability) => (
    <label className={styles.compare}>
      <input
        type="checkbox"
        checked={state.compare.includes(c.id)}
        disabled={!state.compare.includes(c.id) && compared.length >= MAX_COMPARE}
        onChange={(event) =>
          update({
            compare: event.target.checked
              ? [...state.compare, c.id]
              : state.compare.filter((id) => id !== c.id),
          })
        }
      />
      {explorer.compare}
      <span className="visually-hidden"> {c.shortName}</span>
    </label>
  );

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
  const detailedColumns: Column<Capability>[] = [
    columns[0]!,
    { key: 'summary', header: copy.brief.summary, render: (c) => c.summary },
    {
      key: 'console',
      header: copy.columns.console,
      render: (c) => consoleById(c.source.console)?.displayName,
    },
    {
      key: 'layers',
      header: copy.columns.layer,
      render: (c) => c.controlPoints.map((id) => controlPointById(id)?.layer).join(', '),
    },
    { key: 'setup', header: copy.columns.setup, render: (c) => ui.setup[c.setup] },
    licensing,
    {
      key: 'gcc',
      header: copy.columns.gcc,
      render: (c) => (c.source.gccAvailable ? badges.gccAvailable : badges.gccUnavailable),
    },
    { key: 'compare', header: explorer.compare, render: comparisonControl },
  ];
  columns.push({ key: 'compare', header: explorer.compare, render: comparisonControl });
  const matrixColumns: Column<Capability>[] = [
    columns[0]!,
    ...groups.map((group) => ({
      key: group.id,
      header: group.label,
      render: (c: Capability) =>
        belongsTo(c, state.lens, group.id, membership) ? explorer.applies : explorer.notApplicable,
    })),
    { key: 'compare', header: explorer.compare, render: comparisonControl },
  ];

  return (
    <PageContainer>
      <PageHeading>{site.routes.capabilities.title}</PageHeading>
      <p className={styles.intro}>{copy.intro}</p>
      {(state.lens === 'pattern' || state.lens === 'risk') && (
        <aside>
          <p>{state.lens === 'pattern' ? site.mapping.neutralNote : site.mapping.riskNote}</p>
          <Link to={state.lens === 'pattern' ? '/patterns' : '/methodology#risks'}>
            {state.lens === 'pattern' ? site.routes.patterns.title : site.mapping.riskAssociations}
          </Link>
        </aside>
      )}
      {state.invalid && <p role="alert">{explorer.invalidLink}</p>}
      <div className={styles.controls}>
        <div>
          <label htmlFor="explorer-search">{explorer.search}</label>
          <input
            id="explorer-search"
            type="search"
            value={state.query}
            onChange={(event) => update({ q: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor="explorer-lens">{explorer.lens}</label>
          <select
            id="explorer-lens"
            value={state.lens}
            onChange={(event) => update({ lens: event.target.value, group: '' })}
          >
            {LENSES.map((lens) => (
              <option key={lens} value={lens}>
                {explorer.lenses[lens]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="explorer-group">{explorer.group}</label>
          <select
            id="explorer-group"
            value={state.group}
            onChange={(event) => update({ group: event.target.value })}
          >
            <option value="">{explorer.all}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="explorer-view">{explorer.view}</label>
          <select
            id="explorer-view"
            value={state.view}
            onChange={(event) => update({ view: event.target.value })}
          >
            {VIEWS.map((view) => (
              <option key={view} value={view}>
                {explorer.views[view]}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => update({ q: '', group: '' })}>
          {explorer.reset}
        </button>
      </div>
      <p role="status">{renderTemplate(explorer.results, { ...values, count: filtered.length })}</p>
      <p className={styles.note}>{renderTemplate(explorer.comparisonHint, { n: MAX_COMPARE })}</p>
      {filtered.length === 0 ? (
        <p>{explorer.empty}</p>
      ) : state.view === 'cards' ? (
        <ul className={styles.cards}>
          {filtered.map((c) => (
            <li key={c.id} className={styles.card}>
              <CapabilityCell capability={c} technical={technical} />
              <p>{c.summary}</p>
              <p>{pillarById(c.pillar)?.label}</p>
              {comparisonControl(c)}
            </li>
          ))}
        </ul>
      ) : (
        <DataTable
          caption={renderTemplate(explorer.results, { ...values, count: filtered.length })}
          columns={state.view === 'matrix' ? matrixColumns : columns}
          rows={filtered}
          rowKey={(c) => c.id}
          scrollLabel={copy.scrollRegionLabel}
        />
      )}
      {compared.length > 0 && (
        <section aria-labelledby="comparison-title">
          <h2 id="comparison-title">{explorer.comparison}</h2>
          <button type="button" onClick={() => update({ compare: [] })}>
            {explorer.clearComparison}
          </button>
          <DataTable
            caption={explorer.comparison}
            rows={compared}
            columns={detailedColumns}
            rowKey={(c) => c.id}
            scrollLabel={`${explorer.comparison} — ${copy.scrollRegionLabel}`}
          />
        </section>
      )}
      {capabilities.some(sourcesDiffer) && <p className={styles.note}>{copy.sourcesDifferNote}</p>}
      <p className={styles.note}>{copy.draftNote}</p>
    </PageContainer>
  );
}
