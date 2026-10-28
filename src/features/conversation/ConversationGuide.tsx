import { Link } from 'react-router';
import { Badge } from '../../components/Badge.tsx';
import { content, pillarName } from '../../lib/content/index.ts';
import { requirementGuides } from '../../lib/content/conversation.ts';
import { licensingTier } from '../../lib/content/derive.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { useDepth } from '../../lib/state/depth.ts';
import styles from './ConversationGuide.module.css';

const guides = requirementGuides(content);

/** How to run the customer conversation: five steps, then each area's capabilities, questions, people and flags. */
export function ConversationGuide() {
  const copy = content.conversation;
  const { badges } = content.site.ui;
  const { depth } = useDepth();
  const pending = content.faq.filter((item) => item.fact === null).length;
  return (
    <section
      id="conversation"
      aria-labelledby="conversation-heading"
      data-no-print
      className={styles.section}
    >
      <h2 id="conversation-heading">{copy.title}</h2>
      <p>{copy.introduction}</p>
      {depth === 'technical' && copy.reviewStatus === 'draft' && (
        <p>
          <Badge tone="draft">{badges.draft}</Badge>
        </p>
      )}
      <h3 id="conversation-steps">{copy.stepsTitle}</h3>
      <ol className={styles.steps} aria-labelledby="conversation-steps">
        {copy.steps.map((step) => (
          <li key={step.id} className={styles.step}>
            <h4>{step.title}</h4>
            <p>{step.instruction}</p>
            {step.action && <Link to={step.action.to}>{step.action.label}</Link>}
          </li>
        ))}
      </ol>
      <h3 id="conversation-requirements">{copy.requirementsTitle}</h3>
      <p>{copy.requirementsIntro}</p>
      <nav aria-label={copy.jumpLabel}>
        <ul className={styles.jump}>
          {guides.map(({ pillar }) => (
            <li key={pillar.id}>
              <a href={`#requirement-${pillar.id}`}>{pillarName(pillar)}</a>
            </li>
          ))}
        </ul>
      </nav>
      {guides.map((guide) => (
        <section
          key={guide.pillar.id}
          id={`requirement-${guide.pillar.id}`}
          aria-labelledby={`requirement-${guide.pillar.id}-title`}
          data-no-print
          className={styles.requirement}
        >
          <h4 id={`requirement-${guide.pillar.id}-title`}>{pillarName(guide.pillar)}</h4>
          <p>
            <strong>{copy.coversLabel}:</strong> {guide.pillar.definition}
          </p>
          <h5>{copy.capabilitiesLabel}</h5>
          <ul className={styles.capabilities}>
            {guide.capabilities.map((capability) => (
              <li key={capability.id}>
                <Link to={`/capabilities/${capability.id}`}>{capability.shortName}</Link>
                {capability.executiveValue !== undefined && (
                  <span> — {capability.executiveValue}</span>
                )}
                <span className={styles.badges}>
                  <Badge tone={licensingTier(capability) === 'foundational' ? 'outline' : 'info'}>
                    {licensingTier(capability) === 'foundational'
                      ? badges.foundational
                      : badges.premium}
                  </Badge>
                  <Badge tone="neutral">
                    {capability.source.gccAvailable ? badges.gccAvailable : badges.gccUnavailable}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
          <h5>{renderTemplate(copy.questionsLabel, { count: guide.questions.length })}</h5>
          <ul className={styles.questions}>
            {guide.questions.map(({ capability, question }) => (
              <li key={`${capability.id}-${question}`}>
                {question} <span className={styles.source}>({capability.shortName})</span>
              </li>
            ))}
          </ul>
          <h5>{copy.peopleLabel}</h5>
          <ul>
            {guide.people.map(({ team, productAreas }) => (
              <li key={team}>
                {team} — {productAreas.join(', ')}
              </li>
            ))}
          </ul>
          <h5>{copy.flagsLabel}</h5>
          <p>
            {renderTemplate(copy.flagsTemplate, {
              premium: guide.premium,
              total: guide.total,
              notInGcc: guide.notInGcc,
            })}
          </p>
          <Link to={`/capabilities?pillar=${guide.pillar.id}`}>
            {renderTemplate(copy.browse, { label: pillarName(guide.pillar) })}
          </Link>
        </section>
      ))}
      <h3 id="conversation-assumptions">{copy.assumptionsTitle}</h3>
      <p>
        {renderTemplate(pending === 0 ? copy.assumptionsClear : copy.assumptionsNote, {
          count: pending,
          total: content.faq.length,
        })}
      </p>
      <Link to="/learn#myths">{copy.assumptionsLink}</Link>
      <h3 id="conversation-next">{copy.nextTitle}</h3>
      <ul className={styles.next}>
        {copy.next.map((item) => (
          <li key={item.to}>
            <Link to={item.to}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
