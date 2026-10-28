import { Navigate, useLocation } from 'react-router';

/**
 * The conversation guide now lives on the Pitch page. An old link keeps its query string and hash, and a link
 * without a hash lands on the guide.
 */
export function Component() {
  const { search, hash } = useLocation();
  return (
    <Navigate
      to={{ pathname: '/pitch', search, hash: hash === '' ? '#conversation' : hash }}
      replace
    />
  );
}
