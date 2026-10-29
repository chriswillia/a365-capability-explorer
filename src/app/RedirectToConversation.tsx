import { Navigate, useLocation } from 'react-router';
import { conversationDestination } from './legacy-pitch.ts';

/**
 * The conversation guide is a part of Scope an agent. An old link keeps its query string and hash, and a link
 * without a hash lands on the guide.
 */
export function Component() {
  const { search, hash } = useLocation();
  return <Navigate to={conversationDestination(search, hash)} replace />;
}
