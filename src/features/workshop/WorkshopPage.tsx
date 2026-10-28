import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router';
import { ExternalLink } from '../../components/ExternalLink.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { PresentationControls } from '../../components/PresentationControls.tsx';
import {
  consoleById,
  content,
  contentMeta,
  pillarName,
  sourceById,
} from '../../lib/content/index.ts';
import { licensingTier } from '../../lib/content/derive.ts';
import { computeWorkshopMinutes } from '../../lib/content/metrics.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { describeCondition } from '../../lib/engine/conditions.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { Evidence } from '../mapping/Evidence.tsx';
import styles from './Workshop.module.css';

type PrintTarget = 'all' | 'guide' | 'checklist' | 'patterns' | 'capabilities';

export function Component() {
  usePageTitle('workshop');
  const copy = content.workshop;
  const { depth } = useDepth();
  const [target, setTarget] = useState<PrintTarget>('all');
  const [error, setError] = useState(false);
  useEffect(() => {
    const reset = () => setTarget('all');
    window.addEventListener('afterprint', reset);
    return () => window.removeEventListener('afterprint', reset);
  }, []);
  const print = (next: PrintTarget) => {
    setError(false);
    flushSync(() => setTarget(next));
    try {
      window.print();
    } catch (error) {
      setTarget('all');
      if (!(error instanceof DOMException)) throw error;
      setError(true);
    }
  };
  const stamp = (
    <p className={styles.stamp}>
      {content.site.readout.draft} · {contentMeta.contentVersion}
    </p>
  );
  return (
    <PageContainer>
      <div
        className={styles.page}
        data-workshop-print={target}
        data-presentation-document
        data-print-document
      >
        <PresentationControls />
        <PageHeading>{content.site.routes.workshop.title}</PageHeading>
        <p>{copy.introduction}</p>
        {depth === 'technical' && (
          <p>
            {copy.reviewStatus === 'draft'
              ? content.site.ui.badges.draft
              : content.site.ui.badges.reviewed}
          </p>
        )}
        {stamp}
        <div className={styles.actions} data-presentation-hide data-no-print>
          <a href="#workshop-guide">{copy.guide}</a>
          <a href="#checklist">{copy.checklistTitle}</a>
          <a href="#pattern-cards">{copy.patternsTitle}</a>
          <a href="#capability-cards">{copy.capabilitiesTitle}</a>
          <Link to="/canvas/blank">{content.site.readout.blankCanvas}</Link>
          <Link to="/pitch#conversation">{content.site.routes.conversation.title}</Link>
          <Link to="/portfolio">{content.site.routes.portfolio.title}</Link>
          <button type="button" onClick={() => print('guide')}>
            {copy.printGuide}
          </button>
          <button type="button" onClick={() => print('checklist')}>
            {copy.printChecklist}
          </button>
          <button type="button" onClick={() => print('patterns')}>
            {copy.printPatterns}
          </button>
          <button type="button" onClick={() => print('capabilities')}>
            {copy.printCapabilities}
          </button>
        </div>
        {error && <p role="alert">{copy.printError}</p>}
        <section id="workshop-guide" data-workshop-part="guide">
          <h2>{copy.title}</h2>
          <h3>{copy.preparationTitle}</h3>
          <ul>
            {copy.preparation.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
          <h3>{copy.agendaTitle}</h3>
          <p>{renderTemplate(copy.duration, { count: computeWorkshopMinutes(copy.agenda) })}</p>
          <ol className={styles.agenda}>
            {copy.agenda.map((item) => (
              <li key={item.id}>
                <h4>{item.title}</h4>
                <p>{renderTemplate(copy.minutes, { count: item.minutes })}</p>
                <ul>
                  {item.instructions.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
                <p>
                  <strong>{copy.outputLabel}:</strong> {item.output}
                </p>
              </li>
            ))}
          </ol>
          <h3>{copy.followupTitle}</h3>
          <ul>
            {copy.followup.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </section>
        <section id="checklist" data-workshop-part="checklist">
          <h2>{copy.checklistTitle}</h2>
          <p>{copy.checklistNote}</p>
          {[...content.pillars]
            .sort((a, b) => a.order - b.order)
            .map((pillar) => {
              const capabilities = content.capabilities.filter((c) => c.pillar === pillar.id);
              return (
                <div key={pillar.id} className={styles.checklistGroup}>
                  <h3>
                    {renderTemplate(copy.checklistPillar, {
                      label: pillarName(pillar),
                      count: capabilities.length,
                    })}
                  </h3>
                  <table className={styles.checklist}>
                    <caption className="visually-hidden">{pillarName(pillar)}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{copy.checklistColumns.discuss}</th>
                        <th scope="col">{copy.checklistColumns.capability}</th>
                        <th scope="col">{copy.checklistColumns.productArea}</th>
                        <th scope="col">{copy.checklistColumns.availability}</th>
                        <th scope="col">{copy.checklistColumns.requirement}</th>
                        <th scope="col">{copy.checklistColumns.owner}</th>
                        <th scope="col">{copy.checklistColumns.priority}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capabilities.map((capability) => (
                        <tr key={capability.id}>
                          <td className={styles.box}>
                            <span aria-hidden="true">☐</span>
                            <span className="visually-hidden">{capability.shortName}</span>
                          </td>
                          <th scope="row">{capability.shortName}</th>
                          <td>{consoleById(capability.source.console)?.displayName}</td>
                          <td>
                            {licensingTier(capability) === 'foundational'
                              ? content.site.ui.badges.foundational
                              : content.site.ui.badges.premium}
                            {' · '}
                            {capability.source.gccAvailable
                              ? content.site.ui.badges.gccAvailable
                              : content.site.ui.badges.gccUnavailable}
                          </td>
                          <td className={styles.writeIn} />
                          <td className={styles.writeIn} />
                          <td className={styles.writeIn} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          {stamp}
        </section>
        <section id="pattern-cards" data-workshop-part="patterns">
          <h2>{copy.patternsTitle}</h2>
          <p>{copy.cardNote}</p>
          <div className={styles.cards}>
            {content.patterns.map((pattern) => (
              <article className={styles.card} key={pattern.id} data-pattern-card={pattern.id}>
                <div>
                  <p>{copy.front}</p>
                  <h3>{pattern.title}</h3>
                  <p>{pattern.summary}</p>
                  <Link to={`/patterns/${pattern.id}`}>{content.site.routes.pattern.title}</Link>
                </div>
                <div>
                  <h4>{copy.back}</h4>
                  <p>{pattern.narrative}</p>
                  <Evidence {...pattern} />
                  <Link to={`/diagnostic?pattern=${pattern.id}`}>
                    {content.site.mapping.startAssessment}
                  </Link>
                  {stamp}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section id="capability-cards" data-workshop-part="capabilities">
          <h2>{copy.capabilitiesTitle}</h2>
          <p>{copy.cardNote}</p>
          <div className={styles.cards}>
            {content.capabilities.map((capability) => {
              const rules = content.rules.filter((rule) =>
                rule.recommend.some(
                  (recommendation) => recommendation.capability === capability.id,
                ),
              );
              const source = sourceById(capability.source.sourceId)!;
              return (
                <article
                  className={styles.card}
                  key={capability.id}
                  data-capability-card={capability.id}
                >
                  <div>
                    <p>{copy.front}</p>
                    <h3>{capability.shortName}</h3>
                    <dl>
                      <dt>{content.site.capabilities.brief.where}</dt>
                      <dd>
                        {capability.controlPoints
                          .map(
                            (id) => content.controlPoints.find((point) => point.id === id)!.layer,
                          )
                          .join('; ')}
                      </dd>
                      <dt>{content.site.capabilities.columns.console}</dt>
                      <dd>{capability.source.console}</dd>
                    </dl>
                    <Link to={`/capabilities/${capability.id}`}>
                      {content.site.routes.capability.title}
                    </Link>
                    <p>
                      <ExternalLink href={source.url}>{source.title}</ExternalLink>
                    </p>
                    {stamp}
                  </div>
                  <div>
                    <h4>{copy.back}</h4>
                    <p>{capability.summary ?? content.site.learn.pending}</p>
                    {depth === 'technical' && (
                      <p>
                        {capability.reviewStatus === 'draft'
                          ? content.site.ui.badges.draft
                          : content.site.ui.badges.reviewed}
                      </p>
                    )}
                    <h4>{copy.scope}</h4>
                    {rules.length === 0 ? (
                      <p>{copy.noRules}</p>
                    ) : (
                      <ul>
                        {rules.map((rule) => (
                          <li key={rule.id}>
                            <p>
                              {describeCondition(
                                rule.when,
                                content.questions,
                                content.site.mapping.condition,
                              )}
                            </p>
                            <Evidence
                              {...rule.recommend.find(
                                (recommendation) => recommendation.capability === capability.id,
                              )!}
                              reviewStatus={rule.reviewStatus}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    {(capability.sourceNotes ?? [])
                      .filter((note) => note.differs)
                      .map((note) => (
                        <p key={note.sourceId}>
                          {content.site.capabilities.brief.sourceNotes}: {note.note}
                        </p>
                      ))}
                    {stamp}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <p data-print-only>{content.site.disclaimer}</p>
      </div>
    </PageContainer>
  );
}
