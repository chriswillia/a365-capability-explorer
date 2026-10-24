/**
 * Normalizes a base path to "/" or "/<repo>/", always with a leading and a trailing slash.
 * The base path is never hard-coded: it comes from the BASE_PATH environment variable, which the deploy
 * workflow fills from actions/configure-pages.
 */
export function normalizeBase(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? '/' : `/${trimmed}/`;
}
