import { Link } from 'react-router';
import { Badge } from '../../components/Badge.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content, pillarName } from '../../lib/content/index.ts';
import { requirementGuides } from '../../lib/content/conversation.ts';
import { licensingTier } from '../../lib/content/derive.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import styles from './ConversationPage.module.css';

const guides = requirementGuides(content);

export function Component() {
  usePageTitle('conversation');
  const copy = content.conversation;
  const { badges } = content.site.ui;
  const pending = content.faq.filter((item) => item.fact === null).length;
  return (
    <PageContainer>
      <PageHeading>{content.site.routes.conversation.title}</PageHeading>
      <p className={styles.intro}>{copy.introduction}</p>
      {copy.reviewStatus === 'draft' && <Badge tone="draft">{badges.draft}</Badge>}
      <section aria-labelledby="conversation-steps" className={styles.section}>
        <h2 id="conversation-steps">{copy.stepsTitle}</h2>
        <ol className={styles.steps}>
          {copy.steps.map((step) => (
            <li key={step.id} className={styles.step}>
              <h3>{step.title}</h3>
              <p>{step.instruction}</p>
              {step.action && <Link to={step.action.to}>{step.action.label}</Link>}
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="conversation-requirements" className={styles.section}>
        <h2 id="conversation-requirements">{copy.requirementsTitle}</h2>
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
            className={styles.requirement}
          >
            <h3 id={`requirement-${guide.pillar.id}-title`}>{pillarName(guide.pillar)}</h3>
            <p>
              <strong>{copy.coversLabel}:</strong> {guide.pillar.definition}
            </p>
            <h4>{copy.capabilitiesLabel}</h4>
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
            <h4>{renderTemplate(copy.questionsLabel, { count: guide.questions.length })}</h4>
            <ul className={styles.questions}>
              {guide.questions.map(({ capability, question }) => (
                <li key={`${capability.id}-${question}`}>
                  {question} <span className={styles.source}>({capability.shortName})</span>
                </li>
              ))}
            </ul>
            <h4>{copy.peopleLabel}</h4>
            <ul>
              {guide.people.map(({ team, productAreas }) => (
                <li key={team}>
                  {team} — {productAreas.join(', ')}
                </li>
              ))}
            </ul>
            <h4>{copy.flagsLabel}</h4>
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
      </section>
      <section aria-labelledby="conversation-assumptions" className={styles.section}>
        <h2 id="conversation-assumptions">{copy.assumptionsTitle}</h2>
        <p>{renderTemplate(copy.assumptionsNote, { count: pending, total: content.faq.length })}</p>
        <Link to="/learn#myths">{copy.assumptionsLink}</Link>
      </section>
      <section aria-labelledby="conversation-next" className={styles.section}>
        <h2 id="conversation-next">{copy.nextTitle}</h2>
        <ul className={styles.next}>
          {copy.next.map((item) => (
            <li key={item.to}>
              <Link to={item.to}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
