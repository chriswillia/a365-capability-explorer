import type { AnchorHTMLAttributes } from 'react';

/** A link to another site. It sends no referrer, in keeping with the site's privacy stance. */
export function ExternalLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  // eslint-disable-next-line jsx-a11y/anchor-has-content -- children are passed through props
  return <a rel="noreferrer" {...props} />;
}
