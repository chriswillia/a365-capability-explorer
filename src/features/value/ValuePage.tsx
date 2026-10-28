import { Link } from 'react-router';
import { Badge, type BadgeTone } from '../../components/Badge.tsx';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { SourceNote } from '../../components/SourceNote.tsx';
import { licensingTier } from '../../lib/content/derive.ts';
import { content, pillarName } from '../../lib/content/index.ts';
import type { AudienceId } from '../../lib/content/schemas.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { themeViews } from '../../lib/content/value.ts';
import { useAudience } from '../../lib/state/audience.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { ConversationGuide } from '../conversation/ConversationGuide.tsx';
import { ValueBrief } from './ValueBrief.tsx';
import styles from './ValuePage.module.css';

const views = themeViews(content);
const themeTitle = new Map(views.map((view) => [view.theme.id, view.theme.title]));
const pillars = [...content.pillars].sort((a, b) => a.order - b.order);
type PlanRow = (typeof content.value.jointPlan.rows)[number];

const KIND_TONE: Record<'customer' | 'partner' | 'research', BadgeTone> = {
  customer: 'info',
  partner: 'amber',
  research: 'neutral',
};

function Pitch({ audience, heading }: { audience: AudienceId; heading: boolean }) {
  const copy = content.value.pitch;
  const version = copy.audiences[audience];
  return (
    <div className={styles.pitch}>
      {heading && <h3>{version.label}</h3>}
      <p className={styles.opening}>{version.opening}</p>
      <h4>{copy.beatsLabel}</h4>
      <ol>
        {version.beats.map((beat) => (
          <li key={beat}>{beat}</li>
        ))}
      </ol>
      <p>
        <strong>{copy.askLabel}:</strong> {version.ask}
      </p>
    </div>
  );
}

export function Component() {
  usePageTitle('pitch');
  const { audience } = useAudience();
  const { depth } = useDepth();
  const copy = content.value;
  const { site } = content;
  const { badges } = site.ui;
  const otherAudiences = (['ai', 'security', 'joint'] as const).filter((id) => id !== audience);
  const angles: ('ai' | 'security')[] =
    audience === 'ai' ? ['ai'] : audience === 'security' ? ['security'] : ['ai', 'security'];

  const planColumns: Column<PlanRow>[] = [
    { key: 'topic', header: copy.jointPlan.columns.topic, rowHeader: true, render: (r) => r.topic },
    { key: 'ai', header: copy.jointPlan.columns.ai, render: (r) => r.ai },
    { key: 'security', header: copy.jointPlan.columns.security, render: (r) => r.security },
    { key: 'together', header: copy.jointPlan.columns.together, render: (r) => r.together },
  ];

  const jump: [string, string][] = [
    ['pitch', copy.pitch.heading],
    ['problem', copy.problem.heading],
    ['outcomes', copy.themes.heading],
    ['buyers', copy.buyers.heading],
    ['pushback', copy.objections.heading],
    ['proof', copy.proof.heading],
    ['brief', copy.brief.heading],
    ['team', copy.jointPlan.heading],
    ['proof-of-value', copy.proofOfValue.heading],
    ['conversation', content.conversation.title],
  ];

  return (
    <PageContainer>
      <div data-no-print className={styles.top}>
        <PageHeading>{site.routes.pitch.title}</PageHeading>
        <p className={styles.intro}>{copy.intro}</p>
        <p className={styles.notice}>
          {depth === 'technical' && copy.reviewStatus === 'draft' && (
            <Badge tone="draft">{badges.draft}</Badge>
          )}{' '}
          {copy.notice}
        </p>
        <p className={styles.audience}>
          {renderTemplate(copy.audienceNote, { label: copy.pitch.audiences[audience].label })}
        </p>
        <nav aria-label={copy.jumpLabel}>
          <ul className={styles.jump}>
            {jump.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <section id="pitch" aria-labelledby="pitch-heading" data-no-print className={styles.section}>
        <h2 id="pitch-heading">{copy.pitch.heading}</h2>
        <p>{copy.pitch.intro}</p>
        <Pitch audience={audience} heading={false} />
        <details className={styles.more}>
          <summary>{copy.pitch.othersLabel}</summary>
          {otherAudiences.map((id) => (
            <Pitch key={id} audience={id} heading />
          ))}
        </details>
        <SourceNote sourceIds={copy.pitch.sourceIds} evidence={copy.pitch.evidence} />
      </section>

      <section
        id="problem"
        aria-labelledby="problem-heading"
        data-no-print
        className={styles.section}
      >
        <h2 id="problem-heading">{copy.problem.heading}</h2>
        <p>{copy.problem.intro}</p>
        <ul className={styles.statements}>
          {copy.problem.statements.map((statement) => (
            <li key={statement.id}>
              <p>{statement.text}</p>
              {statement.caveat !== undefined && (
                <p className={styles.caveat}>{statement.caveat}</p>
              )}
              <SourceNote
                sourceIds={statement.sourceIds}
                evidence={statement.evidence}
                lastVerified={statement.lastVerified}
              />
            </li>
          ))}
        </ul>
        <h3>{copy.gaps.heading}</h3>
        <p>{copy.gaps.intro}</p>
        <ul className={styles.statements}>
          {copy.gaps.items.map((gap) => (
            <li key={gap.id}>
              <p>
                {gap.text}{' '}
                <a href={`#theme-${gap.themeId}`}>{themeTitle.get(gap.themeId) ?? gap.themeId}</a>
              </p>
            </li>
          ))}
        </ul>
        <SourceNote
          sourceIds={copy.gaps.items[0]?.sourceIds ?? []}
          evidence={copy.gaps.items[0]?.evidence}
          lastVerified={copy.gaps.items[0]?.lastVerified}
        />
      </section>

      <section
        id="outcomes"
        aria-labelledby="outcomes-heading"
        data-no-print
        className={styles.section}
      >
        <h2 id="outcomes-heading">{copy.themes.heading}</h2>
        <p>{copy.themes.intro}</p>
        {pillars.map((pillar) => {
          const group = views.filter((view) => view.pillar.id === pillar.id);
          if (group.length === 0) return null;
          return (
            <div key={pillar.id} className={styles.group}>
              <h3>{pillarName(pillar)}</h3>
              <ul className={styles.cards}>
                {group.map((view) => (
                  <li key={view.theme.id} id={`theme-${view.theme.id}`} className={styles.card}>
                    <h4>{view.theme.title}</h4>
                    <p>{view.theme.outcome}</p>
                    <div className={styles.angles}>
                      <p className={styles.angleLabel}>{copy.themes.angleLabel}</p>
                      {angles.map((kind) => (
                        <p key={kind}>
                          <strong>
                            {kind === 'ai'
                              ? copy.themes.aiAngleLabel
                              : copy.themes.securityAngleLabel}
                            :
                          </strong>{' '}
                          {view.theme.angle[kind]}
                        </p>
                      ))}
                    </div>
                    <details>
                      <summary>
                        {copy.themes.capabilitiesLabel} ({view.capabilities.length})
                      </summary>
                      <ul className={styles.capabilities}>
                        {view.capabilities.map((capability) => (
                          <li key={capability.id}>
                            <Link to={`/capabilities/${capability.id}`}>
                              {capability.shortName}
                            </Link>{' '}
                            <Badge
                              tone={
                                licensingTier(capability) === 'foundational' ? 'outline' : 'info'
                              }
                            >
                              {licensingTier(capability) === 'foundational'
                                ? badges.foundational
                                : badges.premium}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                      <p className={styles.meta}>
                        {copy.themes.ownersLabel}: {view.productAreas.join(', ')}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section
        id="buyers"
        aria-labelledby="buyers-heading"
        data-no-print
        className={styles.section}
      >
        <h2 id="buyers-heading">{copy.buyers.heading}</h2>
        <p>{copy.buyers.intro}</p>
        <ul className={styles.cards}>
          {copy.buyers.items.map((buyer) => (
            <li key={buyer.id} className={styles.card}>
              <h3>{buyer.label}</h3>
              <h4>{copy.buyers.asksLabel}</h4>
              <ul className={styles.plain}>
                {buyer.asks.map((ask) => (
                  <li key={ask}>{ask}</li>
                ))}
              </ul>
              <p>
                <strong>{copy.buyers.leadLabel}:</strong> {buyer.lead}
              </p>
              <p className={styles.meta}>
                {copy.buyers.themesLabel}:{' '}
                {buyer.themeIds.map((id, index) => (
                  <span key={id}>
                    {index > 0 && ', '}
                    <a href={`#theme-${id}`}>{themeTitle.get(id) ?? id}</a>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="pushback"
        aria-labelledby="pushback-heading"
        data-no-print
        className={styles.section}
      >
        <h2 id="pushback-heading">{copy.objections.heading}</h2>
        <p>{copy.objections.intro}</p>
        <div className={styles.objections}>
          {copy.objections.items.map((item) => (
            <details key={item.id} className={styles.objection}>
              <summary>{item.objection}</summary>
              <p>{item.answer}</p>
              <SourceNote sourceIds={item.sourceIds} evidence={item.evidence} />
            </details>
          ))}
        </div>
      </section>

      <section id="proof" aria-labelledby="proof-heading" data-no-print className={styles.section}>
        <h2 id="proof-heading">{copy.proof.heading}</h2>
        <p>{copy.proof.intro}</p>
        <ul className={styles.statements}>
          {copy.proof.items.map((item) => (
            <li key={item.id}>
              <p>
                <Badge tone={KIND_TONE[item.kind]}>{copy.proof.kinds[item.kind]}</Badge>{' '}
                <strong>{item.who}.</strong> {item.summary}
              </p>
              {item.caveat !== undefined && <p className={styles.caveat}>{item.caveat}</p>}
              <SourceNote
                sourceIds={item.sourceIds}
                evidence={item.evidence}
                lastVerified={item.lastVerified}
              />
            </li>
          ))}
        </ul>
      </section>

      <ValueBrief />

      <section id="team" aria-labelledby="team-heading" data-no-print className={styles.section}>
        <h2 id="team-heading">{copy.jointPlan.heading}</h2>
        <p>{copy.jointPlan.intro}</p>
        <DataTable
          caption={copy.jointPlan.heading}
          hideCaption
          scrollLabel={renderTemplate(site.readout.tableLabel, { label: copy.jointPlan.heading })}
          columns={planColumns}
          rows={copy.jointPlan.rows}
          rowKey={(row) => row.id}
        />
      </section>

      <section
        id="proof-of-value"
        aria-labelledby="pov-heading"
        data-no-print
        className={styles.section}
      >
        <h2 id="pov-heading">{copy.proofOfValue.heading}</h2>
        <p>{copy.proofOfValue.intro}</p>
        <ol className={styles.steps}>
          {copy.proofOfValue.steps.map((step) => (
            <li key={step.id}>
              <strong>{step.title}.</strong> {step.detail}
            </li>
          ))}
        </ol>
        <h3>{copy.proofOfValue.measuresHeading}</h3>
        <ul className={styles.plain}>
          {copy.proofOfValue.measures.map((measure) => (
            <li key={measure}>{measure}</li>
          ))}
        </ul>
        <p className={styles.meta}>{copy.proofOfValue.note}</p>
      </section>

      <ConversationGuide />

      <section
        id="boundaries"
        aria-labelledby="boundaries-heading"
        data-no-print
        className={styles.section}
      >
        <h2 id="boundaries-heading">{copy.boundaries.heading}</h2>
        <ul className={styles.plain}>
          {copy.boundaries.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
