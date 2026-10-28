import { Link } from 'react-router';
import { Badge, type BadgeTone } from '../../components/Badge.tsx';
import { DataTable, type Column } from '../../components/DataTable.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { PageIntro } from '../../components/PageIntro.tsx';
import { SourceNote } from '../../components/SourceNote.tsx';
import { ViewPager, ViewPane, ViewSwitcher } from '../../components/ViewSwitcher.tsx';
import { licensingTier } from '../../lib/content/derive.ts';
import { content, pillarName } from '../../lib/content/index.ts';
import type { AudienceId } from '../../lib/content/schemas.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { themeViews } from '../../lib/content/value.ts';
import { useAudience } from '../../lib/state/audience.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { useView, type PageView } from '../../lib/useView.ts';
import { ConversationGuide } from '../conversation/ConversationGuide.tsx';
import { DiscoveryPicker } from './DiscoveryPicker.tsx';
import { ValueBrief } from './ValueBrief.tsx';
import styles from './ValuePage.module.css';

const themes = themeViews(content);
const themeTitle = new Map(themes.map((view) => [view.theme.id, view.theme.title]));
const pillars = [...content.pillars].sort((a, b) => a.order - b.order);
type PlanRow = (typeof content.value.jointPlan.rows)[number];

const KIND_TONE: Record<'customer' | 'partner' | 'research', BadgeTone> = {
  customer: 'info',
  partner: 'amber',
  research: 'neutral',
};

// The pitch is a story told in order: say it, prepare for the buyer, run the meeting, then leave a brief.
const VIEWS: PageView[] = [
  {
    id: 'say',
    label: content.value.views.say,
    sections: ['pitch', 'problem', 'outcomes', 'proof'],
    prefixes: ['theme-'],
  },
  {
    id: 'prepare',
    label: content.value.views.prepare,
    sections: ['buyers', 'entry', 'pushback', 'questions'],
  },
  {
    id: 'run',
    label: content.value.views.run,
    sections: ['team', 'proof-of-value', 'boundaries'],
    prefixes: ['conversation', 'requirement-'],
  },
  { id: 'brief', label: content.value.views.brief, sections: [], prefixes: ['brief'] },
];

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

function PitchSection({ audience }: { audience: AudienceId }) {
  const copy = content.value;
  const otherAudiences = (['ai', 'security', 'joint'] as const).filter((id) => id !== audience);
  return (
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
  );
}

function ProblemSection() {
  const copy = content.value;
  return (
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
            {statement.caveat !== undefined && <p className={styles.caveat}>{statement.caveat}</p>}
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
  );
}

function OutcomesSection({ audience }: { audience: AudienceId }) {
  const copy = content.value;
  const { badges } = content.site.ui;
  const angles: ('ai' | 'security')[] =
    audience === 'ai' ? ['ai'] : audience === 'security' ? ['security'] : ['ai', 'security'];
  return (
    <section
      id="outcomes"
      aria-labelledby="outcomes-heading"
      data-no-print
      className={styles.section}
    >
      <h2 id="outcomes-heading">{copy.themes.heading}</h2>
      <p>{copy.themes.intro}</p>
      {pillars.map((pillar) => {
        const group = themes.filter((view) => view.pillar.id === pillar.id);
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
                          <Link to={`/capabilities/${capability.id}`}>{capability.shortName}</Link>{' '}
                          <Badge
                            tone={licensingTier(capability) === 'foundational' ? 'outline' : 'info'}
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
  );
}

function ProofSection() {
  const copy = content.value;
  return (
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
  );
}

function BuyersSection() {
  const copy = content.value;
  return (
    <section id="buyers" aria-labelledby="buyers-heading" data-no-print className={styles.section}>
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
  );
}

function EntrySection() {
  const copy = content.value;
  return (
    <section id="entry" aria-labelledby="entry-heading" data-no-print className={styles.section}>
      <h2 id="entry-heading">{copy.entryPoints.heading}</h2>
      <p>{copy.entryPoints.intro}</p>
      <ul className={styles.cards}>
        {copy.entryPoints.items.map((entry) => (
          <li key={entry.id} className={styles.card}>
            <h3>{entry.situation}</h3>
            <h4>{copy.entryPoints.conversationLabel}</h4>
            <p>{entry.conversation}</p>
            <h4>{copy.entryPoints.licensingLabel}</h4>
            <p>{entry.licensing}</p>
            <ul className={styles.entryLinks}>
              {entry.links.map((link) => (
                <li key={link.to + link.label}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
            <SourceNote
              sourceIds={entry.sourceIds}
              evidence={entry.evidence}
              lastVerified={entry.lastVerified}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PushbackSection() {
  const copy = content.value;
  return (
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
  );
}

function TeamSection() {
  const copy = content.value;
  const planColumns: Column<PlanRow>[] = [
    { key: 'topic', header: copy.jointPlan.columns.topic, rowHeader: true, render: (r) => r.topic },
    { key: 'ai', header: copy.jointPlan.columns.ai, render: (r) => r.ai },
    { key: 'security', header: copy.jointPlan.columns.security, render: (r) => r.security },
    { key: 'together', header: copy.jointPlan.columns.together, render: (r) => r.together },
  ];
  return (
    <section id="team" aria-labelledby="team-heading" data-no-print className={styles.section}>
      <h2 id="team-heading">{copy.jointPlan.heading}</h2>
      <p>{copy.jointPlan.intro}</p>
      <DataTable
        caption={copy.jointPlan.heading}
        hideCaption
        scrollLabel={renderTemplate(content.site.readout.tableLabel, {
          label: copy.jointPlan.heading,
        })}
        columns={planColumns}
        rows={copy.jointPlan.rows}
        rowKey={(row) => row.id}
      />
    </section>
  );
}

function ProofOfValueSection() {
  const copy = content.value;
  return (
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
  );
}

function BoundariesSection() {
  const copy = content.value;
  return (
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
  );
}

export function Component() {
  usePageTitle('pitch');
  const { audience } = useAudience();
  const { depth } = useDepth();
  const copy = content.value;
  const { site } = content;
  const view = useView(VIEWS);

  return (
    <PageContainer>
      <div data-no-print className={styles.top}>
        <PageHeading>{site.routes.pitch.title}</PageHeading>
        <PageIntro
          notice={
            <p>
              {depth === 'technical' && copy.reviewStatus === 'draft' && (
                <Badge tone="draft">{site.ui.badges.draft}</Badge>
              )}{' '}
              {copy.notice}
            </p>
          }
        >
          {copy.intro}
        </PageIntro>
        <ViewSwitcher views={VIEWS} current={view} />
      </div>

      <ViewPane view={view} id="say">
        <p className={styles.audience} data-no-print>
          {renderTemplate(copy.audienceNote, { label: copy.pitch.audiences[audience].label })}
        </p>
        <PitchSection audience={audience} />
        <ProblemSection />
        <OutcomesSection audience={audience} />
        <ProofSection />
      </ViewPane>
      <ViewPane view={view} id="prepare" keep>
        <BuyersSection />
        <EntrySection />
        <PushbackSection />
        <DiscoveryPicker />
      </ViewPane>
      <ViewPane view={view} id="run">
        <ConversationGuide />
        <TeamSection />
        <ProofOfValueSection />
        <BoundariesSection />
      </ViewPane>
      <ViewPane view={view} id="brief" keep>
        <ValueBrief />
      </ViewPane>
      <ViewPager views={VIEWS} current={view} />
    </PageContainer>
  );
}
