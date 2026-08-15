/** Prepends https:// to a bare domain/URL if no protocol was given — connection
 *  config comes from free-text user input, so this can't be relied on to be well-formed. */
export function normalizeUrl(url: string): string {
  const trimmed = (url || '').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
