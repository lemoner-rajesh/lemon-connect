/**
 * Resolves `url` to an absolute URL against `baseUrl`. Already-absolute URLs
 * (including `mailto:`, `tel:`, protocol-relative `//...`, etc.) pass through
 * unchanged. Falls back to returning `url` as-is if it can't be parsed.
 */
export function toAbsoluteUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}
