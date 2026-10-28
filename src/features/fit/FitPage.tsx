import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Badge } from '../../components/Badge.tsx';
import { ReviewBadge } from '../../components/VerifiedBadge.tsx';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { PageIntro } from '../../components/PageIntro.tsx';
import { SourceNote } from '../../components/SourceNote.tsx';
import { content } from '../../lib/content/index.ts';
import { platformFor, readList } from '../../lib/content/fit.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { loadDiagnostics } from '../../lib/state/diagnostic-storage.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './FitPage.module.css';

type Platform = (typeof content.fit.platforms.items)[number];
type Tool = (typeof content.fit.stack.items)[number];

const platformIds = content.fit.platforms.items.map((item) => item.id);
const toolIds = content.fit.stack.items.map((item) => item.id);
const consoleName = new Map(
  content.consoles.map((console_) => [console_.id, console_.displayName]),
);

export function Component() {
  usePageTitle('fit');
  const copy = content.fit;
  const { site } = content;
  const { badges } = site.ui;
  const [params, setParams] = useSearchParams();
  const workspace = useMemo(() => loadDiagnostics().data, []);

  // A saved assessment can start the platform choice from its own build platform answer.
  const assessment = workspace.assessments.find((a) => a.id === params.get('assessment'));
  const answered = assessment?.answers.buildPlatform;
  const fromAssessment = typeof answered === 'string' ? platformFor(content, answered) : null;
  const platforms =
    readList(params.get('platforms'), platformIds) ??
    (fromAssessment === null ? [] : [fromAssessment.id]);
  const tools = readList(params.get('tools'), toolIds) ?? [];

  const toggle = (
    key: 'platforms' | 'tools',
    current: string[],
    id: string,
    checked: boolean,
    all: string[],
  ) => {
    const next = all.filter((candidate) =>
      candidate === id ? checked : current.includes(candidate),
    );
    setParams(
      (previous) => {
        const updated = new URLSearchParams(previous);
        updated.set(key, next.length === 0 ? 'none' : next.join(','));
        return updated;
      },
      { replace: true, preventScrollReset: true, flushSync: true },
    );
  };

  const chosenPlatforms = copy.platforms.items.filter((item) => platforms.includes(item.id));
  const chosenTools = copy.stack.items.filter((item) => tools.includes(item.id));
  const capabilitiesOf = (tool: Tool) =>
    content.capabilities.filter((capability) => capability.source.console === tool.console);

  const platformColumns: Column<Platform>[] = [
    {
      key: 'platform',
      header: copy.platforms.columns.platform,
      rowHeader: true,
      render: (p) => p.label,
    },
    {
      key: 'route',
      header: copy.platforms.columns.route,
      render: (p) => (
        <>
          <strong>{copy.platforms.routeLabels[p.route]}.</strong> {p.summary}
          <SourceNote sourceIds={p.sourceIds} evidence={p.evidence} lastVerified={p.lastVerified} />
        </>
      ),
    },
    {
      key: 'needs',
      header: copy.platforms.columns.needs,
      render: (p) => (
        <ul className={styles.list}>
          {p.needs.map((need) => (
            <li key={need}>{need}</li>
          ))}
        </ul>
      ),
    },
    {
      key: 'status',
      header: copy.platforms.columns.status,
      render: (p) =>
        p.status === undefined ? (
          <span className={styles.muted}>{p.statusNote ?? ''}</span>
        ) : (
          <>
            <Badge tone="outline">
              {p.status === 'preview' ? badges.preview : badges.frontierPreview}
            </Badge>
            {p.statusNote !== undefined && <p className={styles.muted}>{p.statusNote}</p>}
          </>
        ),
    },
  ];

  const toolColumns: Column<Tool>[] = [
    { key: 'product', header: copy.stack.columns.product, rowHeader: true, render: (t) => t.label },
    {
      key: 'adds',
      header: copy.stack.columns.adds,
      render: (t) => (
        <>
          {t.adds}
          <SourceNote sourceIds={t.sourceIds} evidence={t.evidence} lastVerified={t.lastVerified} />
        </>
      ),
    },
    { key: 'stays', header: copy.stack.columns.stays, render: (t) => t.stays },
    {
      key: 'capabilities',
      header: copy.stack.columns.capabilities,
      render: (t) => (
        <Link to={`/capabilities?${new URLSearchParams({ console: t.console }).toString()}`}>
          {capabilitiesOf(t).length} · {consoleName.get(t.console) ?? t.console}
        </Link>
      ),
    },
  ];

  const connectedColumns: Column<(typeof copy.connected.rows)[number]>[] = [
    {
      key: 'platform',
      header: copy.connected.columns.platform,
      rowHeader: true,
      render: (row) => row.platform,
    },
    {
      key: 'environment',
      header: copy.connected.columns.environment,
      render: (row) => row.environment,
    },
    {
      key: 'observability',
      header: copy.connected.columns.observability,
      render: (row) => copy.connected.observability[row.observability],
    },
  ];

  const jump: [string, string][] = [
    ['statements', copy.statements.heading],
    ['platforms', copy.platforms.heading],
    ['connected', copy.connected.heading],
    ['stack', copy.stack.heading],
    ['new', copy.netNew.heading],
    ['limits', copy.boundaries.heading],
  ];

  return (
    <PageContainer>
      <PageHeading>{site.routes.fit.title}</PageHeading>
      <PageIntro
        notice={
          <p>
            <ReviewBadge reviewStatus={copy.reviewStatus} /> {copy.notice}
          </p>
        }
      >
        {copy.intro}
      </PageIntro>
      <nav aria-label={copy.jumpLabel}>
        <ul className={styles.jump}>
          {jump.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`}>{label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <section id="statements" aria-labelledby="statements-heading" className={styles.section}>
        <h2 id="statements-heading">{copy.statements.heading}</h2>
        <p>{copy.statements.intro}</p>
        <ul className={styles.statements}>
          {copy.statements.items.map((item) => (
            <li key={item.id}>
              <p>{item.text}</p>
              <SourceNote
                sourceIds={item.sourceIds}
                evidence={item.evidence}
                lastVerified={item.lastVerified}
              />
            </li>
          ))}
        </ul>
      </section>

      <section id="platforms" aria-labelledby="platforms-heading" className={styles.section}>
        <h2 id="platforms-heading">{copy.platforms.heading}</h2>
        <p>{copy.platforms.intro}</p>
        <fieldset className={styles.choices}>
          <legend>{copy.platforms.legend}</legend>
          {copy.platforms.items.map((item) => (
            <label key={item.id} className={styles.choice}>
              <input
                type="checkbox"
                checked={platforms.includes(item.id)}
                onChange={(event) =>
                  toggle('platforms', platforms, item.id, event.target.checked, platformIds)
                }
              />
              <span>{item.label}</span>
            </label>
          ))}
        </fieldset>
        {chosenPlatforms.length === 0 ? (
          <p className={styles.muted}>{copy.platforms.emptyNote}</p>
        ) : (
          <DataTable
            caption={copy.platforms.heading}
            hideCaption
            scrollLabel={renderTemplate(site.readout.tableLabel, { label: copy.platforms.heading })}
            columns={platformColumns}
            rows={chosenPlatforms}
            rowKey={(row) => row.id}
          />
        )}
      </section>

      <section id="connected" aria-labelledby="connected-heading" className={styles.section}>
        <h2 id="connected-heading">{copy.connected.heading}</h2>
        <p>{copy.connected.intro}</p>
        <DataTable
          caption={copy.connected.heading}
          hideCaption
          scrollLabel={renderTemplate(site.readout.tableLabel, { label: copy.connected.heading })}
          columns={connectedColumns}
          rows={copy.connected.rows}
          rowKey={(row) => row.id}
        />
        <h3>{copy.connected.limitsHeading}</h3>
        <ul className={styles.list}>
          {copy.connected.limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
        <SourceNote
          sourceIds={copy.connected.sourceIds}
          evidence={copy.connected.evidence}
          lastVerified={copy.connected.lastVerified}
        />
      </section>

      <section id="stack" aria-labelledby="stack-heading" className={styles.section}>
        <h2 id="stack-heading">{copy.stack.heading}</h2>
        <p>{copy.stack.intro}</p>
        <fieldset className={styles.choices}>
          <legend>{copy.stack.legend}</legend>
          {copy.stack.items.map((item) => (
            <label key={item.id} className={styles.choice}>
              <input
                type="checkbox"
                checked={tools.includes(item.id)}
                onChange={(event) => toggle('tools', tools, item.id, event.target.checked, toolIds)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </fieldset>
        {chosenTools.length === 0 ? (
          <p className={styles.muted}>{copy.stack.emptyNote}</p>
        ) : (
          <DataTable
            caption={copy.stack.heading}
            hideCaption
            scrollLabel={renderTemplate(site.readout.tableLabel, { label: copy.stack.heading })}
            columns={toolColumns}
            rows={chosenTools}
            rowKey={(row) => row.id}
          />
        )}
      </section>

      <section id="new" aria-labelledby="new-heading" className={styles.section}>
        <h2 id="new-heading">{copy.netNew.heading}</h2>
        <p>{copy.netNew.intro}</p>
        <ul className={styles.list}>
          {copy.netNew.capabilityIds.flatMap((id) => {
            const capability = content.capabilities.find((c) => c.id === id);
            return capability === undefined
              ? []
              : [
                  <li key={id}>
                    <Link to={`/capabilities/${id}`}>{capability.shortName}</Link>
                  </li>,
                ];
          })}
        </ul>
        <SourceNote sourceIds={copy.netNew.sourceIds} evidence={copy.netNew.evidence} />
      </section>

      <section id="limits" aria-labelledby="limits-heading" className={styles.section}>
        <h2 id="limits-heading">{copy.boundaries.heading}</h2>
        <ul className={styles.list}>
          {copy.boundaries.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
