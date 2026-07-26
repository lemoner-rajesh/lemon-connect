/**
 * Connector-agnostic content model. Every connector (WordPress today; Drupal,
 * Contentful, Sanity, etc. later) maps its own data shape onto these types so
 * that MCP tools never need to know which backend produced them.
 *
 * Every field that WordPress (or a future connector) might not be able to
 * supply is typed as `T | null` rather than optional, and mappers always
 * populate it (with `null` when unavailable) rather than omitting it — so
 * callers get a stable, predictable shape.
 */

/** A resolved image, e.g. a piece of content's featured image. */
export interface FeaturedImage {
  readonly url: string;
  readonly alt: string | null;
  readonly width: number | null;
  readonly height: number | null;
}

/** The author of a piece of content. */
export interface Author {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
}

/** A taxonomy term classifying content as a category. */
export interface Category {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
}

/** A taxonomy term classifying content as a tag. */
export interface Tag {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
}

/** SEO metadata sourced from an SEO plugin (e.g. Yoast SEO), when installed. */
export interface SeoMetadata {
  readonly seoTitle: string | null;
  readonly metaDescription: string | null;
  readonly canonicalUrl: string | null;
  readonly openGraphImage: string | null;
}

/**
 * A lightweight, list-friendly view of a piece of content, as returned by
 * search and "recent content" queries. Carries enough metadata for an AI
 * client to render a rich result card, not just a text snippet.
 */
export interface SearchResult {
  readonly id: string;
  readonly title: string;
  readonly excerpt: string;
  readonly slug: string;
  readonly permalink: string;
  readonly featuredImage: FeaturedImage | null;
  readonly featuredImageAlt: string | null;
  readonly author: Author | null;
  readonly publishedDate: string;
  readonly modifiedDate: string;
  /** The content's post type slug, e.g. "post", "page", or a custom type like "news". */
  readonly contentType: string;
  readonly categories: readonly Category[];
  readonly tags: readonly Tag[];
  /**
   * Relevance score in `[0, 1]`, highest first. Present only on results from
   * `search_content` (ranked against the search query); absent from
   * `list_recent_content` results, which have no query to score against.
   */
  readonly score?: number;
}

/**
 * The full view of a single piece of content, as returned when fetching by id.
 */
export interface ContentDetails {
  readonly id: string;
  readonly title: string;
  /** Full content body, as (site-relative-URL-free) HTML. */
  readonly contentHtml: string;
  /** Full content body as plain text, with paragraph breaks preserved. Prefer this over `contentHtml`. */
  readonly contentText: string;
  readonly excerpt: string;
  readonly featuredImage: FeaturedImage | null;
  readonly featuredImageAlt: string | null;
  readonly author: Author | null;
  readonly publishedDate: string;
  readonly modifiedDate: string;
  readonly permalink: string;
  readonly slug: string;
  readonly contentType: string;
  readonly categories: readonly Category[];
  readonly tags: readonly Tag[];
  readonly wordCount: number;
  /** Estimated reading time in whole minutes (minimum 1 for any non-empty content), assuming ~200 words/minute. */
  readonly estimatedReadingTime: number;
  /** Present only when an SEO plugin (e.g. Yoast SEO) exposes this data. */
  readonly seo?: SeoMetadata;
}
