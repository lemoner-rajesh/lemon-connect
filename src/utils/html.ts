import { toAbsoluteUrl } from './url.js';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

/**
 * Converts a WordPress "rendered" HTML fragment (title, excerpt, content)
 * into plain text: strips tags, decodes entities, and collapses whitespace.
 */
export function stripHtml(html: string): string {
  const withoutTags = html.replace(/<[^>]*>/g, ' ');
  const decoded = decodeEntities(withoutTags);
  return decoded.replace(/\s+/g, ' ').trim();
}

const BLOCK_BREAK_PATTERN = /<\/(p|div|h[1-6]|li|blockquote|tr|section|article|header|footer)>|<br\s*\/?>/gi;

/**
 * Like {@link stripHtml}, but preserves paragraph spacing: block-level
 * element boundaries (`</p>`, `<br>`, `</li>`, ...) become blank lines
 * instead of being collapsed away. Used for full article bodies, where
 * structure matters; single-line fields (titles, excerpts) should keep
 * using {@link stripHtml}.
 */
export function stripHtmlPreservingParagraphs(html: string): string {
  const withParagraphBreaks = html.replace(BLOCK_BREAK_PATTERN, '\n\n');
  const withoutTags = withParagraphBreaks.replace(/<[^>]*>/g, ' ');
  const decoded = decodeEntities(withoutTags);

  return decoded
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const URL_ATTRIBUTE_PATTERN = /\s(href|src)="([^"]*)"/gi;

/**
 * Rewrites `href`/`src` attribute values in `html` to absolute URLs against
 * `baseUrl`. WordPress core always emits absolute URLs for the fields we map
 * directly (permalinks, media `source_url`, ...), but free-form article
 * body HTML can occasionally contain a site-relative link or image an
 * editor typed by hand — this is a defensive pass over that HTML only.
 */
export function absolutizeHtmlUrls(html: string, baseUrl: string): string {
  return html.replace(URL_ATTRIBUTE_PATTERN, (match, attribute: string, value: string) => {
    if (value.length === 0 || value.startsWith('data:')) {
      return match;
    }
    return ` ${attribute}="${toAbsoluteUrl(value, baseUrl)}"`;
  });
}
