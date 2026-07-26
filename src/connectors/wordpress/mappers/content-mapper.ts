import type { Author, Category, ContentDetails, SearchResult, SeoMetadata, Tag } from '../../../types/content.js';
import { absolutizeHtmlUrls, stripHtml, stripHtmlPreservingParagraphs } from '../../../utils/html.js';
import { computeRelevanceScore } from '../../../utils/relevance.js';
import { countWords, estimateReadingTimeMinutes, truncate } from '../../../utils/text.js';
import { toAbsoluteUrl } from '../../../utils/url.js';
import type { WpPost } from '../client/types.js';
import type { ResolvedWpPost } from '../client/wordpress-client.js';

const CATEGORY_TAXONOMY = 'category';
const TAG_TAXONOMY = 'post_tag';
const GENERATED_EXCERPT_MAX_LENGTH = 200;

function toIsoDate(gmtDate: string): string {
  return new Date(`${gmtDate}Z`).toISOString();
}

function mapAuthor(post: WpPost): Author | null {
  const author = post._embedded?.author?.[0];
  return author ? { id: author.id, name: author.name, slug: author.slug } : null;
}

function mapTerms(post: WpPost, taxonomy: string): (Category | Tag)[] {
  const terms = (post._embedded?.['wp:term'] ?? []).flat();
  return terms
    .filter((term) => term.taxonomy === taxonomy)
    .map((term) => ({ id: term.id, name: term.name, slug: term.slug }));
}

/**
 * Falls back to a truncated excerpt generated from the article body when
 * WordPress's own excerpt is empty — or entirely absent, which happens for
 * post types that don't declare `excerpt` support (WordPress omits the
 * field from the REST response rather than sending an empty one).
 */
function resolveExcerpt(post: WpPost, plainContent: string): string {
  const rendered = post.excerpt ? stripHtml(post.excerpt.rendered) : '';
  return rendered.length > 0 ? rendered : truncate(plainContent, GENERATED_EXCERPT_MAX_LENGTH);
}

function mapSeo(post: WpPost): SeoMetadata | undefined {
  const yoast = post.yoast_head_json;
  if (!yoast) {
    return undefined;
  }

  return {
    seoTitle: yoast.title ?? null,
    metaDescription: yoast.description ?? null,
    canonicalUrl: yoast.canonical ?? null,
    openGraphImage: yoast.og_image?.[0]?.url ?? null,
  };
}

function mapCommonFields(resolved: ResolvedWpPost, baseUrl: string) {
  const { post, featuredImage } = resolved;
  const plainContent = post.content ? stripHtml(post.content.rendered) : '';

  return {
    id: String(post.id),
    title: post.title ? stripHtml(post.title.rendered) : '',
    slug: post.slug,
    permalink: toAbsoluteUrl(post.link, baseUrl),
    featuredImage,
    featuredImageAlt: featuredImage?.alt ?? null,
    author: mapAuthor(post),
    publishedDate: toIsoDate(post.date_gmt),
    modifiedDate: toIsoDate(post.modified_gmt),
    contentType: post.type,
    categories: mapTerms(post, CATEGORY_TAXONOMY) as Category[],
    tags: mapTerms(post, TAG_TAXONOMY) as Tag[],
    excerpt: resolveExcerpt(post, plainContent),
    plainContent,
  };
}

/**
 * Maps a resolved WordPress post/page/custom-type item into the
 * connector-agnostic search result shape.
 *
 * `query` is the search term to rank this result against (see
 * `computeRelevanceScore`), producing the `score` field — or `null` when
 * there's no query to rank against (e.g. `list_recent_content`), in which
 * case `score` is omitted entirely rather than filled with a fake value.
 */
export function toSearchResult(resolved: ResolvedWpPost, baseUrl: string, query: string | null): SearchResult {
  const common = mapCommonFields(resolved, baseUrl);
  const score =
    query === null
      ? undefined
      : computeRelevanceScore(query, {
          title: common.title,
          slug: common.slug,
          excerpt: common.excerpt,
          content: common.plainContent,
        });

  return {
    id: common.id,
    title: common.title,
    excerpt: common.excerpt,
    slug: common.slug,
    permalink: common.permalink,
    featuredImage: common.featuredImage,
    featuredImageAlt: common.featuredImageAlt,
    author: common.author,
    publishedDate: common.publishedDate,
    modifiedDate: common.modifiedDate,
    contentType: common.contentType,
    categories: common.categories,
    tags: common.tags,
    ...(score === undefined ? {} : { score }),
  };
}

/** Maps a resolved WordPress post/page/custom-type item into the connector-agnostic content detail shape. */
export function toContentDetails(resolved: ResolvedWpPost, baseUrl: string): ContentDetails {
  const common = mapCommonFields(resolved, baseUrl);
  const contentHtml = absolutizeHtmlUrls(resolved.post.content?.rendered ?? '', baseUrl);
  const contentText = stripHtmlPreservingParagraphs(contentHtml);
  const wordCount = countWords(contentText);
  const seo = mapSeo(resolved.post);

  return {
    id: common.id,
    title: common.title,
    contentHtml,
    contentText,
    excerpt: common.excerpt,
    featuredImage: common.featuredImage,
    featuredImageAlt: common.featuredImageAlt,
    author: common.author,
    publishedDate: common.publishedDate,
    modifiedDate: common.modifiedDate,
    permalink: common.permalink,
    slug: common.slug,
    contentType: common.contentType,
    categories: common.categories,
    tags: common.tags,
    wordCount,
    estimatedReadingTime: estimateReadingTimeMinutes(wordCount),
    ...(seo ? { seo } : {}),
  };
}
