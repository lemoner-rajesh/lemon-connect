import type { FeaturedImage } from '../../../types/content.js';
import { WordPressError } from '../../../errors/index.js';
import { createLogger } from '../../../utils/logger.js';
import { toFeaturedImage } from '../mappers/media-mapper.js';
import type { WpErrorBody, WpMedia, WpPost, WpPostTypeInfo, WpTypeRaw } from './types.js';

const logger = createLogger('wordpress-client');

export interface WordPressClientOptions {
  /** Base URL of the WordPress site, e.g. `https://example.com` (no trailing slash). */
  readonly baseUrl: string;
  /** Per-request timeout, in milliseconds. */
  readonly timeoutMs: number;
  /** Injectable fetch implementation, primarily for unit testing. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * Post types excluded from search/recent/get. These are WordPress core's own
 * internal/system types (site editor building blocks, navigation, font
 * assets, media attachments) rather than "content" a search should surface.
 *
 * WordPress's `/wp/v2/types` endpoint only reports a `viewable` flag under
 * an authenticated `edit` context — for the unauthenticated `view` context
 * this connector uses, it's simply absent on every type, so it can't be used
 * to distinguish "real" content types from internal ones. This curated list
 * is the reliable alternative; any other discovered type (built-in or a
 * site's custom post type) is treated as searchable.
 */
const EXCLUDED_POST_TYPES = new Set([
  'attachment',
  'nav_menu_item',
  'wp_block',
  'wp_template',
  'wp_template_part',
  'wp_global_styles',
  'wp_navigation',
  'wp_font_family',
  'wp_font_face',
]);

/** A REST base is only usable as a URL path segment — guards against templated ones like font-faces' `.../(?P<id>[\d]+)/...`. */
const CLEAN_REST_BASE_PATTERN = /^[\w-]+(\/[\w-]+)*$/;

/** A raw WordPress post/page/custom-type item, paired with its already-resolved featured image (if any). */
export interface ResolvedWpPost {
  readonly post: WpPost;
  readonly featuredImage: FeaturedImage | null;
}

/**
 * Public surface of {@link WordPressClient}. `WordPressConnector` depends on
 * this interface rather than the concrete class so it can be unit tested
 * with a fake/in-memory implementation instead of a real HTTP call.
 */
export interface WordPressClientPort {
  readonly baseUrl: string;
  search(query: string, limit: number): Promise<ResolvedWpPost[]>;
  getById(id: number): Promise<ResolvedWpPost | null>;
  recent(limit: number): Promise<ResolvedWpPost[]>;
}

/**
 * Thin, read-only wrapper around the public WordPress REST API
 * (`/wp-json/wp/v2`). This is the *only* place in the codebase that knows
 * about WordPress endpoints, query parameters, or response shapes — the
 * `WordPressConnector` and everything above it deals exclusively in
 * `ResolvedWpPost` values and never builds a WordPress URL itself.
 *
 * Every request uses `_embed=true` so author, featured media, and taxonomy
 * term details are available without extra round trips in the common case.
 * Registered public post types are discovered once (via `/wp/v2/types`) and
 * cached for the lifetime of the client, so search/recent/get automatically
 * cover custom post types without hardcoding them.
 */
export class WordPressClient implements WordPressClientPort {
  readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private postTypesCache: Promise<readonly WpPostTypeInfo[]> | null = null;

  constructor(options: WordPressClientOptions) {
    this.baseUrl = options.baseUrl;
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Searches every public post type for `query` (WordPress's own `search`
   * parameter matches title, excerpt, and content) and returns the merged
   * candidate pool — up to `limit` items per type, so up to
   * `types.length * limit` total. Deliberately unranked and untruncated:
   * WordPress's per-type ordering isn't comparable across types, so
   * `WordPressConnector` re-ranks the full pool by relevance against `query`
   * and picks the true top `limit` from it (see `computeRelevanceScore`).
   */
  async search(query: string, limit: number): Promise<ResolvedWpPost[]> {
    const types = await this.getSearchablePostTypes();
    const resultsByType = await Promise.all(
      types.map((type) =>
        this.fetchCollection(type.restBase, { search: query, status: 'publish', per_page: String(limit) }),
      ),
    );
    return resultsByType.flat();
  }

  /**
   * Fetches a single item by id across every public post type in parallel
   * (WordPress has no cross-type "get by id" endpoint, but post ids are
   * unique across types). Returns `null` if no type has a match; a genuine
   * non-404 failure from any type is still thrown.
   */
  async getById(id: number): Promise<ResolvedWpPost | null> {
    const types = await this.getSearchablePostTypes();
    const settled = await Promise.allSettled(types.map((type) => this.fetchSingle(type.restBase, id)));

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        return result.value;
      }
    }

    const realFailure = settled.find(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected' && !(result.reason instanceof WordPressError && result.reason.statusCode === 404),
    );
    if (realFailure) {
      throw realFailure.reason;
    }

    return null;
  }

  /** Returns the most recently published content across every public post type, up to `limit` items. */
  async recent(limit: number): Promise<ResolvedWpPost[]> {
    const types = await this.getSearchablePostTypes();
    const resultsByType = await Promise.all(
      types.map((type) =>
        this.fetchCollection(type.restBase, {
          orderby: 'date',
          order: 'desc',
          status: 'publish',
          per_page: String(limit),
        }),
      ),
    );
    return mergeSortedByDateDesc(resultsByType).slice(0, limit);
  }

  /**
   * Discovers registered public post types via `/wp/v2/types`, caching the
   * result for the client's lifetime (avoids re-discovering on every call).
   * A failed lookup is not cached, so a transient failure doesn't
   * permanently break the client.
   */
  private getSearchablePostTypes(): Promise<readonly WpPostTypeInfo[]> {
    this.postTypesCache ??= this.fetchPostTypes().catch((error: unknown) => {
      this.postTypesCache = null;
      throw error;
    });
    return this.postTypesCache;
  }

  private async fetchPostTypes(): Promise<readonly WpPostTypeInfo[]> {
    const url = this.buildUrl('types', {});
    const raw = await this.request<Record<string, WpTypeRaw>>(url, '/wp-json/wp/v2/types');
    return Object.values(raw)
      .filter((type) => type.viewable !== false && !EXCLUDED_POST_TYPES.has(type.slug))
      .map((type) => ({ slug: type.slug, restBase: type.rest_base || type.slug }))
      .filter((type) => CLEAN_REST_BASE_PATTERN.test(type.restBase));
  }

  private async fetchCollection(restBase: string, params: Record<string, string>): Promise<ResolvedWpPost[]> {
    const url = this.buildUrl(restBase, params);
    const posts = await this.request<WpPost[]>(url, `/wp-json/wp/v2/${restBase}`);
    return this.resolveFeaturedImages(posts);
  }

  private async fetchSingle(restBase: string, id: number): Promise<ResolvedWpPost> {
    const path = `${restBase}/${String(id)}`;
    const url = this.buildUrl(path, {});
    const post = await this.request<WpPost>(url, `/wp-json/wp/v2/${path}`);
    const embedded = post._embedded?.['wp:featuredmedia']?.[0];
    const media = embedded ?? (post.featured_media ? await this.fetchMedia(post.featured_media) : null);
    return { post, featuredImage: media ? toFeaturedImage(media, this.baseUrl) : null };
  }

  /**
   * Pairs each post with its featured image. Uses the `_embed`-provided
   * media object when present (the common case — no extra request); falls
   * back to a direct `/media/{id}` fetch only when it's missing, and dedupes
   * those fallback fetches by media id within the batch.
   */
  private async resolveFeaturedImages(posts: readonly WpPost[]): Promise<ResolvedWpPost[]> {
    const mediaFetches = new Map<number, Promise<WpMedia | null>>();

    const getMedia = (mediaId: number): Promise<WpMedia | null> => {
      let pending = mediaFetches.get(mediaId);
      if (!pending) {
        pending = this.fetchMedia(mediaId);
        mediaFetches.set(mediaId, pending);
      }
      return pending;
    };

    return Promise.all(
      posts.map(async (post) => {
        const embedded = post._embedded?.['wp:featuredmedia']?.[0];
        const media = embedded ?? (post.featured_media ? await getMedia(post.featured_media) : null);
        return { post, featuredImage: media ? toFeaturedImage(media, this.baseUrl) : null };
      }),
    );
  }

  private async fetchMedia(id: number): Promise<WpMedia | null> {
    try {
      return await this.request<WpMedia>(
        this.buildUrl(`media/${String(id)}`, {}),
        `/wp-json/wp/v2/media/${String(id)}`,
      );
    } catch (error) {
      if (error instanceof WordPressError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  private buildUrl(path: string, params: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}/wp-json/wp/v2/${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('_embed', 'true');
    return url.toString();
  }

  private async request<T>(url: string, endpoint: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, { signal: controller.signal });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      logger.error(
        { url, endpoint, err: error },
        isTimeout ? 'WordPress request timed out' : 'WordPress request failed',
      );
      throw new WordPressError(
        isTimeout
          ? `Request to WordPress timed out after ${String(this.timeoutMs)}ms.`
          : 'Could not reach the WordPress site.',
        { cause: error, endpoint },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await safeParseErrorBody(response);
      logger.warn({ url, endpoint, status: response.status, body }, 'WordPress API returned an error response');
      throw new WordPressError(
        body?.message ?? `WordPress API request failed with status ${String(response.status)}.`,
        { statusCode: response.status, endpoint },
      );
    }

    return (await response.json()) as T;
  }
}

function mergeSortedByDateDesc(resultsByType: readonly ResolvedWpPost[][]): ResolvedWpPost[] {
  return resultsByType.flat().sort((a, b) => b.post.date_gmt.localeCompare(a.post.date_gmt));
}

async function safeParseErrorBody(response: Response): Promise<WpErrorBody | null> {
  try {
    return (await response.json()) as WpErrorBody;
  } catch {
    return null;
  }
}
