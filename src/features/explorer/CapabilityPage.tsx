import { Link, useParams } from 'react-router';
import { Badge } from '../../components/Badge.tsx';
import { ExternalLink } from '../../components/ExternalLink.tsx';
import { createGlossaryAnnotator } from '../../lib/content/annotateGlossary.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { consoleById, content, controlPointById, sourceById } from '../../lib/content/index.ts';
import { licensingTier, sourcesDiffer } from '../../lib/content/derive.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { Component as NotFoundPage } from '../not-found/NotFoundPage.tsx';
import type { Capability } from '../../lib/content/schemas.ts';
import styles from './CapabilitiesPage.module.css';
import { evaluatePatterns } from '../../lib/engine/evaluate.ts';
import { RuleExplanation } from '../mapping/RuleExplanation.tsx';

const patterns = evaluatePatterns(content, 'catalog');

function SourceCitation({ id }: { id: string }) {
  const source = sourceById(id);
  return source && <ExternalLink href={source.url}>{source.title}</ExternalLink>;
}

function Brief({ capability: c }: { capability: Capability }) {
  usePageTitle('capability', c.shortName);
  const { depth } = useDepth();
  const { site } = content;
  const { brief: copy } = site.capabilities;
  const { badges } = site.ui;
  const technical = depth === 'technical';
  const annotate = createGlossaryAnnotator();
  const correction = new URL(`${site.repoUrl}/issues/new`);
  correction.searchParams.set('title', `Correction: ${c.shortName}`);

  return (
    <PageContainer>
      <Link to="/capabilities">{copy.back}</Link>
      <PageHeading>{c.shortName}</PageHeading>
      <div className={styles.badges}>
        <Badge tone="draft">{c.reviewStatus === 'draft' ? badges.draft : badges.reviewed}</Badge>
        {c.status === 'preview' && <Badge tone="neutral">{badges.preview}</Badge>}
        {c.status === 'frontier-preview' && <Badge tone="neutral">{badges.frontierPreview}</Badge>}
        {sourcesDiffer(c) && <Badge tone="amber">{badges.sourcesDiffer}</Badge>}
      </div>
      <section>
        <h2>{copy.summary}</h2>
        <p>{annotate((technical ? c.summary : (c.executiveValue ?? c.summary)) ?? '')}</p>
        <h3>{site.capabilities.officialWording}</h3>
        <blockquote>{c.source.featureText}</blockquote>
        <SourceCitation id={c.source.sourceId} />
        <p>
          {copy.verified}: <time dateTime={c.source.lastVerified}>{c.source.lastVerified}</time>
        </p>
      </section>
      <div className={styles.cards}>
        {c.withoutIt && (
          <section className={styles.card}>
            <h2>{copy.withoutIt}</h2>
            <p>{annotate(c.withoutIt)}</p>
          </section>
        )}
        {c.withIt && (
          <section className={styles.card}>
            <h2>{copy.withIt}</h2>
            <p>{annotate(c.withIt)}</p>
          </section>
        )}
      </div>
      <section>
        <h2>{copy.where}</h2>
        <ul>
          {content.controlPoints.map((point) => (
            <li key={point.id}>
              {point.layer}
              {c.controlPoints.includes(point.id)
                ? ` — ${site.capabilities.explorer.applies}`
                : ` — ${site.capabilities.explorer.notApplicable}`}
              {technical && c.controlPoints.includes(point.id) && (
                <p>{annotate(controlPointById(point.id)?.governs ?? '')}</p>
              )}
            </li>
          ))}
        </ul>
        <h2>{copy.when}</h2>
        <ul>
          {content.lifecycle
            .filter((stage) => c.lifecycleStages.includes(stage.id))
            .map((stage) => (
              <li key={stage.id}>{stage.label}</li>
            ))}
        </ul>
        <h2>{copy.owner}</h2>
        <p>{c.ownerTeam ?? consoleById(c.source.console)?.ownerTeam}</p>
        {technical && <p>{consoleById(c.source.console)?.displayName}</p>}
        <h2>{copy.setup}</h2>
        <p>{site.ui.setup[c.setup]}</p>
      </section>
      <section>
        <h2>{copy.availability}</h2>
        <p>{licensingTier(c) === 'foundational' ? badges.foundational : badges.premium}</p>
        <p>{c.source.gccAvailable ? badges.gccAvailable : badges.gccUnavailable}</p>
        <SourceCitation id={c.source.sourceId} />
      </section>
      {c.questionsItAnswers && (
        <section>
          <h2>{copy.questions}</h2>
          <ul>
            {c.questionsItAnswers.map((q) => (
              <li key={q}>{annotate(q)}</li>
            ))}
          </ul>
        </section>
      )}
      {c.discoveryQuestions && (
        <section>
          <h2>{copy.discovery}</h2>
          <ul>
            {c.discoveryQuestions.map((q) => (
              <li key={q}>{annotate(q)}</li>
            ))}
          </ul>
        </section>
      )}
      {technical && c.dependencies && (
        <section>
          <h2>{copy.dependencies}</h2>
          <ul>
            {c.dependencies.map((d) => (
              <li key={d.note}>
                {annotate(d.note)} (<SourceCitation id={d.sourceId} />)
              </li>
            ))}
          </ul>
        </section>
      )}
      {technical && c.prerequisites && (
        <section>
          <h2>{copy.prerequisites}</h2>
          <p>{copy.conditionalNote}</p>
          <ul>
            {c.prerequisites.map((p) => (
              <li key={p.gap}>
                {annotate(p.gap)} — {copy.evidence[p.evidence]}{' '}
                {p.sourceId && <SourceCitation id={p.sourceId} />}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2>{site.mapping.whenInScope}</h2>
        {content.rules
          .filter((rule) => rule.recommend.some((r) => r.capability === c.id))
          .map((rule) => (
            <RuleExplanation key={rule.id} rule={rule} capabilityId={c.id} />
          ))}
      </section>
      <section>
        <h2>{site.mapping.typicalPatterns}</h2>
        <p className={styles.note}>{site.mapping.neutralNote}</p>
        <ul className={styles.relatedLinks}>
          {patterns
            .filter(({ result }) => result.inScope.some((r) => r.capability.id === c.id))
            .map(({ pattern }) => (
              <li key={pattern.id}>
                <Link to={`/patterns/${pattern.id}`}>{pattern.title}</Link>
              </li>
            ))}
        </ul>
        <Link className={styles.relatedLink} to="/patterns">
          {site.mapping.matrix}
        </Link>
      </section>
      <section>
        <h2>{site.mapping.riskAssociations}</h2>
        <p className={styles.note}>{site.mapping.riskNote}</p>
        <ul className={styles.relatedLinks}>
          {content.risks
            .filter((r) => r.mitigatedBy.includes(c.id))
            .map((risk) => (
              <li key={risk.id}>
                <Link to={`/capabilities?lens=risk&group=${risk.id}`}>{risk.title}</Link>
              </li>
            ))}
        </ul>
      </section>
      {c.sourceNotes && (
        <section>
          <h2>{copy.sourceNotes}</h2>
          <ul>
            {c.sourceNotes.map((note) => (
              <li key={`${note.sourceId}-${note.note}`}>
                {note.differs && <Badge tone="amber">{badges.sourcesDiffer}</Badge>}
                <p>{annotate(note.note)}</p>
                <SourceCitation id={note.sourceId} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {c.docs && (
        <section>
          <h2>{copy.docs}</h2>
          <ul>
            {c.docs.map((doc) => (
              <li key={doc.url}>
                <ExternalLink href={doc.url}>{doc.title}</ExternalLink>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className={styles.note}>{copy.assessmentPending}</p>
      <ExternalLink href={correction.href}>{copy.correction}</ExternalLink>
    </PageContainer>
  );
}

export function Component() {
  const { id } = useParams();
  const capability = content.capabilities.find((c) => c.id === id);
  return capability ? <Brief capability={capability} /> : <NotFoundPage />;
}
