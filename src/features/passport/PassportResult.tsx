import { Link } from 'react-router';
import { AccessFitBadge } from '../../components/AccessFitBadge.tsx';
import { Badge, type BadgeTone } from '../../components/Badge.tsx';
import { RequirementLine } from '../../components/RequirementLine.tsx';
import { SampleChip } from '../../components/SampleChip.tsx';
import { content, pillarName } from '../../lib/content/index.ts';
import type { Level } from '../../lib/content/schemas.ts';
import { renderTemplate } from '../../lib/content/template.ts';
import type { Passport } from '../../lib/engine/passport.ts';
import styles from './PassportPage.module.css';

const LEVEL_TONE: Record<Level, BadgeTone> = {
  essential: 'info',
  recommended: 'outline',
  consider: 'neutral',
};
const NEED_TONE = {
  required: 'info',
  recommended: 'outline',
  'not-licensed': 'neutral',
  'not-stated': 'amber',
} as const satisfies Record<string, BadgeTone>;
// How many things to confirm show before the rest fold away.
const SHOWN_REQUIREMENTS = 6;

/**
 * The one-page result for an agent: how it acts, the controls that matter most, what must be in place, who to
 * license, where it is built and the risks to cover. Everything comes from buildPassport, which uses the same
 * engine as the readout.
 */
export function PassportResult({
  passport,
  assessmentId,
  customer,
  agent,
  sample = false,
}: {
  passport: Passport;
  assessmentId: string;
  customer: string;
  agent: string;
  /** True for the fictional sample customer, which is marked as sample data. */
  sample?: boolean;
}) {
  const copy = content.passport.result;
  const { mapping } = content.site;
  const { licensing, fit } = content;
  const { requirements } = passport;
  const first = requirements.slice(0, SHOWN_REQUIREMENTS);
  const rest = requirements.slice(SHOWN_REQUIREMENTS);
  const helper = content.passport.helper.outcomes;
  const accessLine =
    passport.access !== null && passport.access in helper
      ? helper[passport.access as keyof typeof helper]
      : null;
  const toConfirm = passport.requirementCounts.unknown;

  return (
    <section aria-labelledby="passport-heading" className={styles.passport}>
      <div>
        <h2 id="passport-heading">{copy.heading}</h2>
        <p className={styles.subtitle}>
          {renderTemplate(copy.title, { agent, customer })} {sample && <SampleChip />}
        </p>
        <p className={styles.hint}>{copy.saved}</p>
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <h3>{copy.accessHeading}</h3>
          {passport.accessLabel === null ? (
            <p>{copy.accessUnknown}</p>
          ) : (
            <>
              <p className={styles.badges}>
                <Badge tone="info">{passport.accessLabel}</Badge>
              </p>
              {accessLine !== null && <p>{accessLine}</p>}
            </>
          )}
        </div>

        <div className={styles.card}>
          <h3>{copy.platformHeading}</h3>
          {passport.platform === null ? (
            <p>{copy.platformUnknown}</p>
          ) : (
            <>
              <p className={styles.badges}>
                <strong>{passport.platform.label}</strong>
                <Badge tone="outline">{fit.platforms.routeLabels[passport.platform.route]}</Badge>
              </p>
              <p>{passport.platform.summary}</p>
            </>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <h3>{copy.controlsHeading}</h3>
        {passport.areas.length === 0 ? (
          <p>{copy.controlsNone}</p>
        ) : (
          <>
            <p className={styles.hint}>
              {renderTemplate(copy.controlsIntro, {
                essential: passport.counts.essential,
                recommended: passport.counts.recommended,
              })}
            </p>
            <div className={styles.controls}>
              {passport.areas.map((area) => (
                <div key={area.pillar.id} className={styles.area}>
                  <h4>{pillarName(area.pillar)}</h4>
                  <ul className={styles.list}>
                    {[...area.essential, ...area.recommended].map((entry) => (
                      <li key={entry.capability.id}>
                        <span className={styles.badges}>
                          <Link to={`/capabilities/${entry.capability.id}`}>
                            {entry.capability.shortName}
                          </Link>
                          <Badge tone={LEVEL_TONE[entry.level]}>
                            {mapping.levels[entry.level]}
                          </Badge>
                          <AccessFitBadge capabilityId={entry.capability.id} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={styles.card}>
        <h3>{copy.mustHaveHeading}</h3>
        {requirements.length === 0 ? (
          <p>{copy.mustHaveNone}</p>
        ) : (
          <>
            <p className={styles.hint}>
              {renderTemplate(copy.mustHaveIntro, { count: toConfirm })}
            </p>
            <ul className={styles.list}>
              {first.map((view) => (
                <RequirementLine key={view.item.id} view={view} showStatus />
              ))}
            </ul>
            {rest.length > 0 && (
              <details>
                <summary>
                  {renderTemplate(copy.mustHaveMore, { count: requirements.length })}
                </summary>
                <ul className={styles.list}>
                  {rest.map((view) => (
                    <RequirementLine key={view.item.id} view={view} showStatus />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <h3>{copy.licenseHeading}</h3>
          {passport.access === null ? (
            <p>{copy.licenseUnknown}</p>
          ) : (
            <>
              <p className={styles.hint}>{copy.licenseIntro}</p>
              <ul className={styles.list}>
                {passport.populations.map(({ population }) => (
                  <li key={population.id}>
                    <span className={styles.badges}>
                      <strong>{population.label}</strong>
                      <Badge tone={NEED_TONE[population.need]}>
                        {licensing.needs[population.need]}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p>
            <Link to={`/licensing?assessment=${assessmentId}#calculator`}>
              {licensing.calculator.heading}
            </Link>
          </p>
        </div>

        <div className={styles.card}>
          <h3>{copy.risksHeading}</h3>
          {passport.risks.length === 0 ? (
            <p>{copy.risksNone}</p>
          ) : (
            <>
              <p className={styles.hint}>{copy.risksIntro}</p>
              <ul className={styles.list}>
                {passport.risks.map(({ risk, certain, controls }) => (
                  <li key={risk.id}>
                    <strong>{risk.title}</strong>
                    <span>{risk.summary}</span>
                    <span className={styles.hint}>
                      {certain
                        ? renderTemplate(copy.riskControls, { count: controls })
                        : copy.riskPossible}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div>
        <h3>{copy.actionsHeading}</h3>
        <p className={styles.actions}>
          <Link to={`/leave-behind/${assessmentId}`}>{copy.actions.leaveBehind}</Link>
          <Link to={`/licensing?assessment=${assessmentId}`}>{copy.actions.licensing}</Link>
          <Link to={`/deploy?assessment=${assessmentId}`}>{copy.actions.deploy}</Link>
          <Link to={`/diagnostic/${assessmentId}/readout`}>{copy.actions.readout}</Link>
          <Link to={`/diagnostic/${assessmentId}`}>{copy.actions.discovery}</Link>
        </p>
      </div>
    </section>
  );
}
