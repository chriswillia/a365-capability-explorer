import { CheckmarkCircle16Regular, Prohibited16Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Badge } from '../../components/Badge.tsx';
import { AccessFitBadge } from '../../components/AccessFitBadge.tsx';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { ExternalLink } from '../../components/ExternalLink.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { VerifiedBadge } from '../../components/VerifiedBadge.tsx';
import {
  consoleById,
  content,
  controlPointById,
  pillarById,
  pillarName,
  sourceById,
  values,
} from '../../lib/content/index.ts';
import { licensingTier, primaryControlPoint, sourcesDiffer } from '../../lib/content/derive.ts';
import type { Capability } from '../../lib/content/schemas.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './CapabilitiesPage.module.css';
import { CatalogGlance } from './CatalogGlance.tsx';
import {
  applyFilter,
  belongsTo,
  createLensMembership,
  explorerSearch,
  filterCapabilities,
  filterLabel,
  GCC_FILTERS,
  hasFilters,
  lensGroups,
  LENSES,
  LICENSING_FILTERS,
  matchShortcuts,
  matrixLens,
  MAX_COMPARE,
  readExplorerState,
  sectionGroups,
  sectionOf,
  SECTIONINGS,
  SETUP_FILTERS,
  VIEWS,
  type ExplorerState,
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
        <VerifiedBadge date={capability.source.lastVerified} />
        {technical && capability.reviewStatus === 'draft' && (
          <Badge tone="draft">{badges.draft}</Badge>
        )}
        {technical && capability.reviewStatus === 'reviewed' && (
          <Badge tone="outline">{badges.reviewed}</Badge>
        )}
        {capability.status === 'preview' && <Badge tone="neutral">{badges.preview}</Badge>}
        {capability.status === 'frontier-preview' && (
          <Badge tone="neutral">{badges.frontierPreview}</Badge>
        )}
        {sourcesDiffer(capability) && <Badge tone="amber">{badges.sourcesDiffer}</Badge>}
        <AccessFitBadge capabilityId={capability.id} />
      </span>
    </div>
  );
}

function GccBadge({ capability }: { capability: Capability }) {
  const { badges } = content.site.ui;
  return capability.source.gccAvailable ? (
    <Badge tone="outline" icon={<CheckmarkCircle16Regular />}>
      {badges.gccAvailable}
    </Badge>
  ) : (
    <Badge tone="neutral" icon={<Prohibited16Regular />}>
      {badges.gccUnavailable}
    </Badge>
  );
}

function LicensingBadge({ capability }: { capability: Capability }) {
  const { badges } = content.site.ui;
  return licensingTier(capability) === 'foundational' ? (
    <Badge tone="outline">{badges.foundational}</Badge>
  ) : (
    <Badge tone="info">{badges.premium}</Badge>
  );
}

export function Component() {
  usePageTitle('capabilities');
  const { depth } = useDepth();
  const technical = depth === 'technical';
  const { site, capabilities } = content;
  const { capabilities: copy, ui } = site;
  const [params, setParams] = useSearchParams();
  const state = readExplorerState(params, content);
  const explorer = copy.explorer;
  // Comparing is for the seller who asks for it: the checkboxes appear once it is turned on, and stay while any
  // capability is selected, so a shared link that carries a comparison still shows it.
  const [compareOn, setCompareOn] = useState(false);
  const comparing = compareOn || state.compare.length > 0;
  const filtered = filterCapabilities(capabilities, state, membership);
  const compared = state.compare.flatMap((id) => capabilities.filter((c) => c.id === id));
  const activeLens = state.lens || (state.view === 'matrix' ? matrixLens(state) : '');
  const groups = activeLens === '' ? [] : lensGroups(content, activeLens);
  const sectioned = state.by !== 'none' && state.view !== 'matrix';
  const sections = sectioned
    ? sectionGroups(content, state.by as 'pillar' | 'console')
        .map((group) => ({
          ...group,
          rows: filtered.filter((c) => sectionOf(c, state.by as 'pillar' | 'console') === group.id),
        }))
        .filter((group) => group.rows.length > 0)
    : [];
  const draftCount = filtered.filter((c) => c.reviewStatus === 'draft').length;
  const shortcuts = matchShortcuts(state.query, copy.shortcuts)
    .map((shortcut) => {
      const next = applyFilter(state, shortcut.filter);
      return {
        shortcut,
        next,
        count: filterCapabilities(capabilities, next, membership).length,
        applied:
          explorerSearch(next).toString() === explorerSearch({ ...state, query: '' }).toString(),
      };
    })
    .filter((item) => !item.applied);

  const update = (changes: Partial<ExplorerState>) => {
    const next = { ...state, ...changes };
    if (changes.lens !== undefined && changes.group === undefined) next.group = '';
    setParams(explorerSearch(next), { replace: 'query' in changes, preventScrollReset: true });
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

  const capabilityColumn: Column<Capability> = {
    key: 'capability',
    header: copy.columns.capability,
    rowHeader: true,
    render: (c) => <CapabilityCell capability={c} technical={technical} />,
  };
  const pillarColumn: Column<Capability> = {
    key: 'pillar',
    header: copy.columns.pillar,
    render: (c) => {
      const pillar = pillarById(c.pillar);
      return pillar === undefined ? null : pillarName(pillar);
    },
  };
  const productColumn: Column<Capability> = {
    key: 'console',
    header: copy.columns.console,
    render: (c) => consoleById(c.source.console)?.displayName,
  };
  const licensingColumn: Column<Capability> = {
    key: 'licensing',
    header: copy.columns.licensing,
    render: (c) => <LicensingBadge capability={c} />,
  };
  const gccColumn: Column<Capability> = {
    key: 'gcc',
    header: copy.columns.gcc,
    nowrap: true,
    render: (c) => <GccBadge capability={c} />,
  };
  const compareColumn: Column<Capability> = {
    key: 'compare',
    header: explorer.compare,
    render: comparisonControl,
  };
  const columnsFor = (by: ExplorerState['by'] | 'matrix'): Column<Capability>[] => [
    capabilityColumn,
    ...(by === 'pillar' ? [] : [pillarColumn]),
    ...(by === 'console' ? [] : [productColumn]),
    ...(technical
      ? [
          {
            key: 'layer',
            header: copy.columns.layer,
            render: (c: Capability) => controlPointById(primaryControlPoint(c))?.layer,
          },
          {
            key: 'setup',
            header: copy.columns.setup,
            render: (c: Capability) => ui.setup[c.setup],
          },
          licensingColumn,
          gccColumn,
          {
            key: 'wave',
            header: copy.columns.wave,
            nowrap: true,
            render: (c: Capability) => renderTemplate(copy.waveLabel, { n: c.defaultWave }),
          },
        ]
      : [
          {
            key: 'availability',
            header: copy.columns.availability,
            render: (c: Capability) => (
              <span className={styles.badges}>
                <LicensingBadge capability={c} />
                <GccBadge capability={c} />
              </span>
            ),
          },
        ]),
    ...(comparing ? [compareColumn] : []),
  ];
  const detailedColumns: Column<Capability>[] = [
    capabilityColumn,
    { key: 'summary', header: copy.brief.summary, render: (c) => c.summary },
    pillarColumn,
    productColumn,
    {
      key: 'layers',
      header: copy.columns.layer,
      render: (c) => c.controlPoints.map((id) => controlPointById(id)?.layer).join(', '),
    },
    { key: 'setup', header: copy.columns.setup, render: (c) => ui.setup[c.setup] },
    licensingColumn,
    gccColumn,
    compareColumn,
  ];
  const matrixColumns: Column<Capability>[] = [
    capabilityColumn,
    ...groups.map((group) => ({
      key: group.id,
      header: group.label,
      render: (c: Capability) =>
        belongsTo(c, matrixLens(state), group.id, membership)
          ? explorer.applies
          : explorer.notApplicable,
    })),
    ...(comparing ? [compareColumn] : []),
  ];
  const resultsText = renderTemplate(explorer.results, { ...values, count: filtered.length });
  // The filters behind "More filters" count here, so a closed drawer never hides why results are narrowed.
  const moreActive = [state.console, state.licensing, state.gcc, state.setup, state.lens].filter(
    (value) => value !== '',
  ).length;
  const facetCount = (changes: Partial<ExplorerState>) =>
    filterCapabilities(capabilities, { ...state, ...changes }, membership).length;
  const select = <T extends string>(
    id: string,
    label: string,
    value: string,
    options: readonly { value: T | ''; label: string }[],
    onChange: (value: string) => void,
  ) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <PageContainer>
      <PageHeading>{site.routes.capabilities.title}</PageHeading>
      <p className={styles.intro}>{copy.intro}</p>
      <p className={styles.intro}>
        {copy.valueBrief.text} <Link to="/brief">{copy.valueBrief.cta}</Link>
      </p>
      <details className={styles.glance}>
        <summary>{copy.glance.heading}</summary>
        <CatalogGlance />
      </details>
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
        <div className={styles.search}>
          <label htmlFor="explorer-search">{explorer.search}</label>
          <input
            id="explorer-search"
            type="search"
            value={state.query}
            onChange={(event) => update({ query: event.target.value })}
          />
          {shortcuts.length > 0 && (
            <div className={styles.shortcuts}>
              <span>{explorer.shortcutIntro}</span>
              <ul>
                {shortcuts.map(({ shortcut, next, count }) => (
                  <li key={shortcut.id}>
                    <button
                      type="button"
                      onClick={() => setParams(explorerSearch(next), { preventScrollReset: true })}
                    >
                      {renderTemplate(explorer.shortcutLabel, {
                        label: filterLabel(content, shortcut.filter),
                        count,
                      })}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <fieldset className={styles.chips}>
          <legend>{explorer.pillarFilter}</legend>
          <button
            type="button"
            aria-pressed={state.pillar === ''}
            onClick={() => update({ pillar: '' })}
          >
            {renderTemplate(explorer.pillarChip, {
              label: explorer.allPillars,
              count: facetCount({ pillar: '' }),
            })}
          </button>
          {sectionGroups(content, 'pillar').map((pillar) => (
            <button
              key={pillar.id}
              type="button"
              aria-pressed={state.pillar === pillar.id}
              onClick={() => update({ pillar: state.pillar === pillar.id ? '' : pillar.id })}
            >
              {renderTemplate(explorer.pillarChip, {
                label: pillar.label,
                count: facetCount({ pillar: pillar.id }),
              })}
            </button>
          ))}
        </fieldset>
        <div className={styles.toolbar}>
          {hasFilters(state) && (
            <button
              type="button"
              onClick={() =>
                update({
                  query: '',
                  pillar: '',
                  console: '',
                  licensing: '',
                  gcc: '',
                  setup: '',
                  lens: '',
                  group: '',
                })
              }
            >
              {explorer.reset}
            </button>
          )}
        </div>
        <details className={styles.more} open={moreActive > 0}>
          <summary>
            {moreActive > 0
              ? renderTemplate(explorer.moreActive, { count: moreActive })
              : explorer.more}
          </summary>
          <div className={styles.filters}>
            {select(
              'explorer-view',
              explorer.view,
              state.view,
              VIEWS.map((value) => ({ value, label: explorer.views[value] })),
              (value) => update({ view: value as ExplorerState['view'] }),
            )}
            <label className={styles.compareToggle}>
              <input
                type="checkbox"
                checked={comparing}
                disabled={state.compare.length > 0}
                onChange={(event) => setCompareOn(event.target.checked)}
              />
              {explorer.compareToggle}
            </label>
          </div>
          <div className={styles.filters}>
            {select(
              'explorer-console',
              explorer.productArea,
              state.console,
              [
                { value: '', label: explorer.anyOption },
                ...sectionGroups(content, 'console').map((group) => ({
                  value: group.id,
                  label: group.label,
                })),
              ],
              (value) => update({ console: value }),
            )}
            {select(
              'explorer-licensing',
              explorer.licensing,
              state.licensing,
              [
                { value: '', label: explorer.anyOption },
                ...LICENSING_FILTERS.map((value) => ({
                  value,
                  label: explorer.licensingOptions[value],
                })),
              ],
              (value) => update({ licensing: value as ExplorerState['licensing'] }),
            )}
            {select(
              'explorer-gcc',
              explorer.gcc,
              state.gcc,
              [
                { value: '', label: explorer.anyOption },
                ...GCC_FILTERS.map((value) => ({ value, label: explorer.gccOptions[value] })),
              ],
              (value) => update({ gcc: value as ExplorerState['gcc'] }),
            )}
            {select(
              'explorer-setup',
              explorer.setup,
              state.setup,
              [
                { value: '', label: explorer.anyOption },
                ...SETUP_FILTERS.map((value) => ({ value, label: explorer.setupOptions[value] })),
              ],
              (value) => update({ setup: value as ExplorerState['setup'] }),
            )}
          </div>
          <div className={styles.filters}>
            {select(
              'explorer-group-by',
              explorer.groupBy,
              state.by,
              SECTIONINGS.map((value) => ({ value, label: explorer.groupByOptions[value] })),
              (value) => update({ by: value as ExplorerState['by'] }),
            )}
            {select(
              'explorer-lens',
              explorer.lens,
              activeLens,
              [
                { value: '', label: explorer.noLens },
                ...LENSES.map((lens) => ({ value: lens, label: explorer.lenses[lens] })),
              ],
              (value) => update({ lens: value as ExplorerState['lens'] }),
            )}
            {select(
              'explorer-group',
              explorer.group,
              state.group,
              [
                { value: '', label: explorer.all },
                ...groups.map((group) => ({ value: group.id, label: group.label })),
              ],
              (value) => update({ group: value }),
            )}
          </div>
        </details>
      </div>
      <p role="status">{resultsText}</p>
      {technical && draftCount > 0 && (
        <p className={styles.note}>
          {renderTemplate(explorer.draftSummary, { draft: draftCount, total: filtered.length })}
        </p>
      )}
      {comparing && (
        <p className={styles.note}>{renderTemplate(explorer.comparisonHint, { n: MAX_COMPARE })}</p>
      )}
      {filtered.length === 0 ? (
        <>
          <p>{explorer.empty}</p>
          <p className={styles.note}>{explorer.emptyGuidance}</p>
        </>
      ) : state.view === 'matrix' ? (
        <DataTable
          caption={resultsText}
          hideCaption
          columns={matrixColumns}
          rows={filtered}
          rowKey={(c) => c.id}
          scrollLabel={copy.scrollRegionLabel}
        />
      ) : sectioned ? (
        sections.map((group) => (
          <section key={group.id} aria-labelledby={`group-${group.id}`} className={styles.group}>
            <h2 id={`group-${group.id}`}>{group.label}</h2>
            <p className={styles.note}>
              {renderTemplate(explorer.groupCount, { count: group.rows.length })}
            </p>
            {state.view === 'cards' ? (
              <ul className={styles.cards}>
                {group.rows.map((c) => (
                  <li key={c.id} className={styles.card}>
                    <CapabilityCell capability={c} technical={technical} />
                    <p>{c.summary}</p>
                    <span className={styles.badges}>
                      <LicensingBadge capability={c} />
                      <GccBadge capability={c} />
                    </span>
                    {comparing && comparisonControl(c)}
                  </li>
                ))}
              </ul>
            ) : (
              <DataTable
                caption={`${group.label}: ${resultsText}`}
                hideCaption
                columns={columnsFor(state.by)}
                rows={group.rows}
                rowKey={(c) => c.id}
                scrollLabel={`${group.label} — ${copy.scrollRegionLabel}`}
              />
            )}
          </section>
        ))
      ) : state.view === 'cards' ? (
        <ul className={styles.cards}>
          {filtered.map((c) => (
            <li key={c.id} className={styles.card}>
              <CapabilityCell capability={c} technical={technical} />
              <p>{c.summary}</p>
              <p>{pillarById(c.pillar)?.label}</p>
              <span className={styles.badges}>
                <LicensingBadge capability={c} />
                <GccBadge capability={c} />
              </span>
              {comparing && comparisonControl(c)}
            </li>
          ))}
        </ul>
      ) : (
        <DataTable
          caption={resultsText}
          hideCaption
          columns={columnsFor('none')}
          rows={filtered}
          rowKey={(c) => c.id}
          scrollLabel={copy.scrollRegionLabel}
        />
      )}
      {compared.length > 0 && (
        <section id="comparison" aria-labelledby="comparison-title" className={styles.group}>
          <h2 id="comparison-title">{explorer.comparison}</h2>
          <button type="button" onClick={() => update({ compare: [] })}>
            {explorer.clearComparison}
          </button>
          <DataTable
            caption={explorer.comparison}
            hideCaption
            rows={compared}
            columns={detailedColumns}
            rowKey={(c) => c.id}
            scrollLabel={`${explorer.comparison} — ${copy.scrollRegionLabel}`}
          />
        </section>
      )}
      {capabilities.some(sourcesDiffer) && <p className={styles.note}>{copy.sourcesDifferNote}</p>}
      {technical && <p className={styles.note}>{copy.draftNote}</p>}
      {compared.length > 0 && (
        <div className={styles.compareBar} role="group" aria-label={explorer.compare}>
          <span role="status">
            {renderTemplate(explorer.compareBar, { count: compared.length })}
          </span>
          <a href="#comparison">{explorer.showComparison}</a>
          <button type="button" onClick={() => update({ compare: [] })}>
            {explorer.clearComparison}
          </button>
        </div>
      )}
    </PageContainer>
  );
}
