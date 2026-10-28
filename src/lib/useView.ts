import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

/** One part of a long page: what it is called, and which sections a link can point at inside it. */
export interface PageView {
  id: string;
  label: string;
  /** The ids of the sections this view shows. */
  sections: readonly string[];
  /** Prefixes for ids made from data, such as one card per theme. */
  prefixes?: readonly string[];
}

const anchorOf = (hash: string) => {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
};

const holds = (view: PageView, anchor: string) =>
  anchor !== '' &&
  (view.sections.includes(anchor) || (view.prefixes ?? []).some((p) => anchor.startsWith(p)));

/**
 * The view a page is showing: the one that holds the section a link points at, otherwise the one named in the
 * address, otherwise the first. A link to a section therefore still lands on that section.
 *
 * The address is then made to say which view it is (the first view needs no name), keeping the section, so a page
 * that rewrites its own query string, such as the value brief, stays on the view the seller is on.
 */
export function useView(views: readonly PageView[]): PageView {
  const [params] = useSearchParams();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const anchor = anchorOf(hash);
  const view =
    views.find((candidate) => holds(candidate, anchor)) ??
    views.find((candidate) => candidate.id === params.get('view')) ??
    views[0]!;
  const named = params.get('view');
  const wanted = view.id === views[0]!.id ? null : view.id;

  useEffect(() => {
    if (named === wanted) return;
    const next = new URLSearchParams(params);
    if (wanted === null) next.delete('view');
    else next.set('view', wanted);
    const search = next.toString();
    navigate(
      { pathname, search: search === '' ? '' : `?${search}`, hash },
      { replace: true, preventScrollReset: true },
    );
  }, [named, wanted, params, pathname, hash, navigate]);

  return view;
}

/** The address of a view: the rest of the address stays, the first view needs no name, and no section is named. */
export function useViewAddress(views: readonly PageView[]) {
  const [params] = useSearchParams();
  return (view: PageView) => {
    const next = new URLSearchParams(params);
    if (view.id === views[0]!.id) next.delete('view');
    else next.set('view', view.id);
    const search = next.toString();
    return { search: search === '' ? '' : `?${search}`, hash: '' };
  };
}
