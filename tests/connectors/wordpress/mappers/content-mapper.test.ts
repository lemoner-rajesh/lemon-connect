import { describe, expect, it } from 'vitest';
import { toContentDetails, toSearchResult } from '../../../../src/connectors/wordpress/mappers/content-mapper.js';
import type { WpPost } from '../../../../src/connectors/wordpress/client/types.js';
import type { ResolvedWpPost } from '../../../../src/connectors/wordpress/client/wordpress-client.js';
import type { FeaturedImage } from '../../../../src/types/content.js';

const BASE_URL = 'https://example.com';

const DEFAULT_FEATURED_IMAGE: FeaturedImage = {
  url: 'https://example.com/image.jpg',
  alt: 'A picture',
  width: 800,
  height: 600,
};

function buildPost(overrides: Partial<WpPost> = {}): WpPost {
  return {
    id: 42,
    date_gmt: '2024-03-15T09:30:00',
    slug: 'about-us',
    status: 'publish',
    type: 'page',
    link: 'https://example.com/about-us/',
    title: { rendered: 'About <em>Us</em>' },
    content: { rendered: '<p>We are a <strong>health</strong> company.</p>' },
    excerpt: { rendered: '<p>We are a health company.</p>' },
    author: 7,
    featured_media: 3,
    _embedded: {
      author: [{ id: 7, name: 'Jane Doe' }],
      'wp:term': [
        [
          { id: 1, name: 'Health', slug: 'health', taxonomy: 'category' },
          { id: 2, name: 'Insurance', slug: 'insurance', taxonomy: 'category' },
        ],
        [{ id: 5, name: 'leadership', slug: 'leadership', taxonomy: 'post_tag' }],
      ],
    },
    ...overrides,
  };
}

function buildResolved(
  postOverrides: Partial<WpPost> = {},
  featuredImage: FeaturedImage | null = DEFAULT_FEATURED_IMAGE,
): ResolvedWpPost {
  return { post: buildPost(postOverrides), featuredImage };
}

describe('toSearchResult', () => {
  it('maps a resolved post into a SearchResult with rich, flat metadata', () => {
    const result = toSearchResult(buildResolved(), BASE_URL);

    expect(result).toEqual({
      id: '42',
      title: 'About Us',
      excerpt: 'We are a health company.',
      slug: 'about-us',
      permalink: 'https://example.com/about-us/',
      featuredImage: DEFAULT_FEATURED_IMAGE,
      featuredImageAlt: 'A picture',
      author: { id: 7, name: 'Jane Doe' },
      publishedDate: '2024-03-15T09:30:00.000Z',
      contentType: 'page',
      categories: [
        { id: 1, name: 'Health', slug: 'health' },
        { id: 2, name: 'Insurance', slug: 'insurance' },
      ],
      tags: [{ id: 5, name: 'leadership', slug: 'leadership' }],
    });
  });

  it('returns null (not a placeholder) for missing author and featured image', () => {
    const result = toSearchResult(buildResolved({ _embedded: undefined }, null), BASE_URL);

    expect(result.author).toBeNull();
    expect(result.featuredImage).toBeNull();
    expect(result.featuredImageAlt).toBeNull();
    expect(result.categories).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it('does not throw when title/content/excerpt are entirely absent (a post type without that support)', () => {
    const result = toSearchResult(buildResolved({ title: undefined, content: undefined, excerpt: undefined }), BASE_URL);

    expect(result.title).toBe('');
    expect(result.excerpt).toBe('');
  });

  it('generates a truncated excerpt from the body when WordPress supplies an empty one', () => {
    const longSentence = Array.from({ length: 40 }, (_, i) => `word${String(i)}`).join(' ');
    const result = toSearchResult(
      buildResolved({ excerpt: { rendered: '' }, content: { rendered: `<p>${longSentence}</p>` } }),
      BASE_URL,
    );

    expect(result.excerpt.length).toBeLessThanOrEqual(201);
    expect(result.excerpt.endsWith('…')).toBe(true);
    expect(result.excerpt.startsWith('word0 word1')).toBe(true);
  });
});

describe('toContentDetails', () => {
  it('maps a resolved post into a ContentDetails with HTML and paragraph-preserving text', () => {
    const details = toContentDetails(
      buildResolved({ content: { rendered: '<p>First paragraph.</p><p>Second paragraph.</p>' } }),
      BASE_URL,
    );

    expect(details.contentHtml).toBe('<p>First paragraph.</p><p>Second paragraph.</p>');
    expect(details.contentText).toBe('First paragraph.\n\nSecond paragraph.');
    expect(details.id).toBe('42');
    expect(details.slug).toBe('about-us');
    expect(details.permalink).toBe('https://example.com/about-us/');
    expect(details.featuredImage).toEqual(DEFAULT_FEATURED_IMAGE);
    expect(details.categories).toHaveLength(2);
    expect(details.tags).toHaveLength(1);
    expect(details.seo).toBeUndefined();
  });

  it('absolutizes site-relative URLs found inside the content body', () => {
    const details = toContentDetails(
      buildResolved({ content: { rendered: '<p>See <a href="/pricing">pricing</a> and <img src="/img/a.png"></p>' } }),
      BASE_URL,
    );

    expect(details.contentHtml).toContain('href="https://example.com/pricing"');
    expect(details.contentHtml).toContain('src="https://example.com/img/a.png"');
  });

  it('includes seo metadata only when yoast_head_json is present', () => {
    const details = toContentDetails(
      buildResolved({
        yoast_head_json: {
          title: 'SEO Title',
          description: 'Meta description.',
          canonical: 'https://example.com/about-us/',
          og_image: [{ url: 'https://example.com/og.jpg' }],
        },
      }),
      BASE_URL,
    );

    expect(details.seo).toEqual({
      seoTitle: 'SEO Title',
      metaDescription: 'Meta description.',
      canonicalUrl: 'https://example.com/about-us/',
      openGraphImage: 'https://example.com/og.jpg',
    });
  });

  it('falls back gracefully when embedded data is missing', () => {
    const details = toContentDetails(buildResolved({ _embedded: undefined }, null), BASE_URL);

    expect(details.author).toBeNull();
    expect(details.featuredImage).toBeNull();
    expect(details.featuredImageAlt).toBeNull();
    expect(details.categories).toEqual([]);
    expect(details.tags).toEqual([]);
  });

  it('does not throw when title/content/excerpt are entirely absent (a post type without that support)', () => {
    const details = toContentDetails(
      buildResolved({ title: undefined, content: undefined, excerpt: undefined }),
      BASE_URL,
    );

    expect(details.title).toBe('');
    expect(details.contentHtml).toBe('');
    expect(details.contentText).toBe('');
    expect(details.excerpt).toBe('');
  });
});
