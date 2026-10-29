import { Badge } from '../../components/Badge.tsx';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { PageIntro } from '../../components/PageIntro.tsx';
import { content } from '../../lib/content/index.ts';
import { useDepth } from '../../lib/state/depth.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';
import { ValueBrief } from './ValueBrief.tsx';
import styles from './BriefPage.module.css';

/** The value brief: one page for a customer meeting, built from the outcomes the customer cares about. */
export function Component() {
  usePageTitle('brief');
  const { depth } = useDepth();
  const { site, value } = content;

  return (
    <PageContainer>
      <div data-no-print className={styles.top}>
        <PageHeading>{site.routes.brief.title}</PageHeading>
        <PageIntro
          notice={
            <p>
              {depth === 'technical' && value.reviewStatus === 'draft' && (
                <Badge tone="draft">{site.ui.badges.draft}</Badge>
              )}{' '}
              {value.notice}
            </p>
          }
        >
          {site.routes.brief.description}
        </PageIntro>
      </div>
      <ValueBrief />
    </PageContainer>
  );
}
