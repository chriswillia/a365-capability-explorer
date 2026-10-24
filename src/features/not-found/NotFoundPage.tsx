import { Link } from 'react-router';
import { PageContainer } from '../../components/PageContainer.tsx';
import { PageHeading } from '../../components/PageHeading.tsx';
import { content } from '../../lib/content/index.ts';
import { usePageTitle } from '../../lib/usePageTitle.ts';

export function Component() {
  usePageTitle('notFound');
  const { routes, ui } = content.site;

  return (
    <PageContainer narrow>
      <PageHeading>{routes.notFound.title}</PageHeading>
      <p>{ui.notFound.body}</p>
      <p>
        <Link to="/">{ui.notFound.back}</Link>
      </p>
    </PageContainer>
  );
}
