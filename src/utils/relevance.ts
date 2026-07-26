/** Plain-text fields a search result is ranked against. All are compared case-insensitively. */
export interface RelevanceFields {
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string;
  readonly content: string;
}

/**
 * Score bands for each match tier, highest-priority first. Values are
 * deliberately spread out (not evenly split) so a strong match always
 * outranks a weaker one regardless of tie-breaking elsewhere.
 */
const SCORE_EXACT_TITLE = 1;
const SCORE_TITLE_STARTS_WITH = 0.85;
const SCORE_TITLE_CONTAINS = 0.7;
const SCORE_SLUG_MATCH = 0.55;
const SCORE_EXCERPT_MATCH = 0.4;
const SCORE_CONTENT_MATCH = 0.25;
/** WordPress's own search returned this result, but it doesn't match any of our facets directly (e.g. a stemmed/fuzzy match). */
const SCORE_NO_DIRECT_MATCH = 0.1;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Scores how relevant `fields` are to `query`, in `[0, 1]`. Ranking priority,
 * highest first: exact title match, title starts with query, title contains
 * query, slug match, excerpt match, content match — matching the priority
 * WordPress search results should be presented in.
 */
export function computeRelevanceScore(query: string, fields: RelevanceFields): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return SCORE_NO_DIRECT_MATCH;
  }

  const title = fields.title.trim().toLowerCase();

  if (title === normalizedQuery) {
    return SCORE_EXACT_TITLE;
  }
  if (title.startsWith(normalizedQuery)) {
    return SCORE_TITLE_STARTS_WITH;
  }
  if (title.includes(normalizedQuery)) {
    return SCORE_TITLE_CONTAINS;
  }
  if (fields.slug.toLowerCase().includes(slugify(normalizedQuery))) {
    return SCORE_SLUG_MATCH;
  }
  if (fields.excerpt.toLowerCase().includes(normalizedQuery)) {
    return SCORE_EXCERPT_MATCH;
  }
  if (fields.content.toLowerCase().includes(normalizedQuery)) {
    return SCORE_CONTENT_MATCH;
  }
  return SCORE_NO_DIRECT_MATCH;
}
