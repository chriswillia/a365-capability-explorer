import { Navigate, useLocation } from 'react-router';
import { pitchDestination } from './legacy-pitch.ts';

/** The Pitch page is gone. An old link goes to where the part it pointed at moved. */
export function Component() {
  const { search, hash } = useLocation();
  return <Navigate to={pitchDestination(search, hash)} replace />;
}
