import type { Author, Category, ContentDetails, SearchResult, SeoMetadata, Tag } from '../../../types/content.js';
import { absolutizeHtmlUrls, stripHtml, stripHtmlPreservingParagraphs } from '../../../utils/html.js';
import { truncate } from '../../../utils/text.js';
import { toAbsoluteUrl } from '../../../utils/url.js';
import type { WpPost } from '../client/types.js';
import type { ResolvedWpPost } from '../client/wordpress-client.js';

const CATEGORY_TAXONOMY = 'category';
const TAG_TAXONOMY = 'post_tag';
const GENERATED_EXCERPT_MAX_LENGTH = 200;

function toPublishedDate(post: WpPost): string {
  return new Date(`${post.date_gmt}Z`).toISOString();
}

function mapAuthor(post: WpPost): Author | null {
  const author = post._embedded?.author?.[0];
  return author ? { id: author.id, name: author.name } : null;
}

function mapTerms(post: WpPost, taxonomy: string): (Category | Tag)[] {
  const terms = (post._embedded?.['wp:term'] ?? []).flat();
  return terms
    .filter((term) => term.taxonomy === taxonomy)
    .map((term) => ({ id: term.id, name: term.name, slug: term.slug }));
}

/** Falls back to a truncated excerpt generated from the article body when WordPress's own excerpt is empty. */
function resolveExcerpt(post: WpPost, plainContent: string): string {
  const rendered = stripHtml(post.excerpt.rendered);
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
  const plainContent = stripHtml(post.content.rendered);

  return {
    id: String(post.id),
    title: stripHtml(post.title.rendered),
    slug: post.slug,
    permalink: toAbsoluteUrl(post.link, baseUrl),
    featuredImage,
    featuredImageAlt: featuredImage?.alt ?? null,
    author: mapAuthor(post),
    publishedDate: toPublishedDate(post),
    contentType: post.type,
    categories: mapTerms(post, CATEGORY_TAXONOMY) as Category[],
    tags: mapTerms(post, TAG_TAXONOMY) as Tag[],
    excerpt: resolveExcerpt(post, plainContent),
  };
}

/** Maps a resolved WordPress post/page/custom-type item into the connector-agnostic search result shape. */
export function toSearchResult(resolved: ResolvedWpPost, baseUrl: string): SearchResult {
  const common = mapCommonFields(resolved, baseUrl);
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
    contentType: common.contentType,
    categories: common.categories,
    tags: common.tags,
  };
}

/** Maps a resolved WordPress post/page/custom-type item into the connector-agnostic content detail shape. */
export function toContentDetails(resolved: ResolvedWpPost, baseUrl: string): ContentDetails {
  const common = mapCommonFields(resolved, baseUrl);
  const contentHtml = absolutizeHtmlUrls(resolved.post.content.rendered, baseUrl);
  const seo = mapSeo(resolved.post);

  return {
    id: common.id,
    title: common.title,
    contentHtml,
    contentText: stripHtmlPreservingParagraphs(contentHtml),
    excerpt: common.excerpt,
    featuredImage: common.featuredImage,
    featuredImageAlt: common.featuredImageAlt,
    author: common.author,
    publishedDate: common.publishedDate,
    permalink: common.permalink,
    slug: common.slug,
    contentType: common.contentType,
    categories: common.categories,
    tags: common.tags,
    ...(seo ? { seo } : {}),
  };
}
