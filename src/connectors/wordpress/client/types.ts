/**
 * Raw shapes returned by the WordPress REST API (`/wp-json/wp/v2/...`).
 *
 * These types stay inside the `client` package on purpose: nothing outside
 * `connectors/wordpress` should ever import from this file. The mappers in
 * `connectors/wordpress/mappers` are the only code that translates these
 * into the connector-agnostic domain types in `src/types`.
 */

/** A post type slug, e.g. `"post"`, `"page"`, or a custom type like `"news"`. */
export type WpPostType = string;

export interface WpRenderedField {
  readonly rendered: string;
  readonly protected?: boolean;
}

export interface WpEmbeddedAuthor {
  readonly id: number;
  readonly name: string;
}

/** A WordPress media (attachment) object, whether embedded or fetched directly from `/media/{id}`. */
export interface WpMedia {
  readonly id: number;
  readonly source_url?: string;
  readonly alt_text?: string;
  readonly media_details?: {
    readonly width?: number;
    readonly height?: number;
  };
}

export interface WpEmbeddedTerm {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly taxonomy: string;
}

export interface WpEmbedded {
  readonly author?: readonly WpEmbeddedAuthor[];
  readonly 'wp:featuredmedia'?: readonly WpMedia[];
  readonly 'wp:term'?: readonly (readonly WpEmbeddedTerm[])[];
}

/** Open Graph image entry inside Yoast SEO's `yoast_head_json`. */
export interface WpYoastOgImage {
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
}

/**
 * Subset of the `yoast_head_json` field Yoast SEO adds to post/page REST
 * responses when installed and active. Absent entirely when Yoast isn't
 * installed, or when a site disables this REST field.
 */
export interface WpYoastHeadJson {
  readonly title?: string;
  readonly description?: string;
  readonly canonical?: string;
  readonly og_image?: readonly WpYoastOgImage[];
}

/**
 * A WordPress post, page, or custom post type item, as returned by a
 * `/wp-json/wp/v2/{restBase}` collection or single-item endpoint, requested
 * with `_embed=true`.
 */
export interface WpPost {
  readonly id: number;
  readonly date_gmt: string;
  readonly slug: string;
  readonly status: string;
  readonly type: WpPostType;
  readonly link: string;
  // title/content/excerpt are omitted entirely by WordPress (not sent as empty
  // objects) for post types that don't declare that feature in their `supports`.
  readonly title?: WpRenderedField;
  readonly content?: WpRenderedField;
  readonly excerpt?: WpRenderedField;
  readonly author: number;
  readonly featured_media: number;
  readonly yoast_head_json?: WpYoastHeadJson;
  readonly _embedded?: WpEmbedded;
}

/**
 * A registered post type, as returned by `/wp-json/wp/v2/types` (a
 * dictionary keyed by post type slug, not an array).
 */
export interface WpTypeRaw {
  readonly slug: string;
  /** The REST API collection path segment for this type, e.g. `"posts"` for the `post` type. */
  readonly rest_base: string;
  /** Whether this type has a public-facing single view. Excludes internal/system types. */
  readonly viewable?: boolean;
}

/** A searchable post type, resolved from `/wp-json/wp/v2/types`. */
export interface WpPostTypeInfo {
  readonly slug: string;
  readonly restBase: string;
}

/** Shape of a WordPress REST API error response body. */
export interface WpErrorBody {
  readonly code?: string;
  readonly message?: string;
  readonly data?: {
    readonly status?: number;
  };
}
