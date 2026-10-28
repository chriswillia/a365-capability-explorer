import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { ExternalLink } from '../../components/ExternalLink.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content, sourceById } from '../../lib/content/index.ts';
import { describeCondition } from '../../lib/engine/conditions.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { Evidence } from './Evidence.tsx';
import { RuleExplanation } from './RuleExplanation.tsx';
import styles from './Mapping.module.css';

/** A link to a rule or risk can point inside a closed section, so open the sections around its target. */
function useOpenTarget() {
  const { hash } = useLocation();
  useEffect(() => {
    const target = hash === '' ? null : document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target === null) return;
    for (let node = target.closest('details'); node !== null;)
      node = ((node.open = true), node.parentElement?.closest('details') ?? null);
    target.scrollIntoView();
  }, [hash]);
}

export function Component() {
  usePageTitle('methodology');
  useOpenTarget();
  const copy = content.site.mapping;
  return (
    <PageContainer>
      <PageHeading>{content.site.routes.methodology.title}</PageHeading>
      <p className={styles.intro}>{copy.methodology}</p>
      <section aria-labelledby="methodology-quick">
        <h2 id="methodology-quick">{copy.quickTitle}</h2>
        <dl>
          {copy.quick.map((item) => (
            <div key={item.question}>
              <dt>
                <strong>{item.question}</strong>
              </dt>
              <dd>{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="methodology-levels">
        <h2 id="methodology-levels">{copy.levelsTitle}</h2>
        <dl>
          {Object.entries(copy.levels).map(([level, label]) => (
            <div key={level}>
              <dt>
                <strong>{label}</strong>
              </dt>
              <dd>{copy.levelDescriptions[level as keyof typeof copy.levels]}</dd>
            </div>
          ))}
        </dl>
        <p>{copy.readinessNote}</p>
        <p>{copy.intensityNote}</p>
        <p>{copy.neutralNote}</p>
      </section>
      <section id="risks">
        <h2>{copy.riskAssociations}</h2>
        <p>{copy.riskNote}</p>
        <ul className={styles.cards}>
          {content.risks.map((risk) => (
            <li className={styles.card} key={risk.id}>
              <h3>{risk.title}</h3>
              <p>{risk.summary}</p>
              <p>{describeCondition(risk.triggeredWhen, content.questions, copy.condition)}</p>
              <Evidence {...risk} />
              <ul className={styles.links}>
                {risk.mitigatedBy.map((id) => (
                  <li key={id}>
                    <Link to={`/capabilities/${id}`}>
                      {content.capabilities.find((c) => c.id === id)!.shortName}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link className={styles.cellLink} to={`/capabilities?lens=risk&group=${risk.id}`}>
                {content.site.capabilities.explorer.lenses.risk}: {risk.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <details id="engine" className={styles.engine}>
        <summary>{copy.engineTitle}</summary>
        <section>
          <h2>{copy.assumptions}</h2>
          <ul>
            {copy.methodologyNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2>{copy.rules}</h2>
          {content.rules.map((rule) => (
            <article key={rule.id} id={`rule-${rule.id}`}>
              <h3>
                <code>{rule.id}</code>
              </h3>
              <RuleExplanation rule={rule} />
            </article>
          ))}
        </section>
      </details>
      <section>
        <h2>{copy.hostingSources}</h2>
        <ul className={styles.links}>
          {copy.hostingSourceIds.map((id) => {
            const source = sourceById(id)!;
            return (
              <li key={id}>
                <ExternalLink href={source.url}>{source.title}</ExternalLink>
              </li>
            );
          })}
        </ul>
      </section>
    </PageContainer>
  );
}
