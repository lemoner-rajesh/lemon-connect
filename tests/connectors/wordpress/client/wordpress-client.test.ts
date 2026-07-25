import { describe, expect, it, vi } from 'vitest';
import { WordPressClient } from '../../../../src/connectors/wordpress/client/wordpress-client.js';
import { WordPressError } from '../../../../src/errors/index.js';

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** Normalizes fetch's `string | URL | Request` first argument to a `URL`, for inspecting requested URLs in tests. */
function toUrl(input: string | URL | Request): URL {
  if (typeof input === 'string' || input instanceof URL) {
    return new URL(input);
  }
  return new URL(input.url);
}

/** Standard `/wp-json/wp/v2/types` fixture: two searchable types, one excluded-by-default type, one non-viewable type. */
const TYPES_RESPONSE = {
  post: { slug: 'post', rest_base: 'posts', viewable: true },
  page: { slug: 'page', rest_base: 'pages', viewable: true },
  attachment: { slug: 'attachment', rest_base: 'media', viewable: true },
  nav_menu_item: { slug: 'nav_menu_item', rest_base: 'menu-items', viewable: false },
};

/** Responds to `/wp-json/wp/v2/types` with the standard fixture; returns `null` for any other path. */
function typesRoute(parsed: URL): Response | null {
  return parsed.pathname.endsWith('/types') ? jsonResponse(TYPES_RESPONSE) : null;
}

function post(id: number, date_gmt: string, type: 'post' | 'page' = 'post', overrides: Record<string, unknown> = {}) {
  return {
    id,
    date_gmt,
    slug: `post-${String(id)}`,
    status: 'publish',
    type,
    link: `https://example.com/post-${String(id)}/`,
    title: { rendered: `Post ${String(id)}` },
    content: { rendered: '<p>Body</p>' },
    excerpt: { rendered: '<p>Excerpt</p>' },
    author: 1,
    featured_media: 0,
    ...overrides,
  };
}

describe('WordPressClient.search', () => {
  it('discovers searchable post types, sends status=publish, and only requests the relevant types', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      const typesResponse = typesRoute(parsed);
      if (typesResponse) return typesResponse;
      if (parsed.pathname.endsWith('/posts')) {
        expect(parsed.searchParams.get('status')).toBe('publish');
        expect(parsed.searchParams.get('search')).toBe('health');
        return jsonResponse([post(1, '2024-01-01T00:00:00')]);
      }
      if (parsed.pathname.endsWith('/pages')) {
        return jsonResponse([post(2, '2024-06-01T00:00:00', 'page')]);
      }
      throw new Error(`unexpected url: ${parsed.toString()}`);
    });

    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    const results = await client.search('health', 10);

    expect(results.map((r) => r.post.id).sort()).toEqual([1, 2]);
    // /types, /posts, /pages — never /media (attachment) or /menu-items (not viewable).
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const urls = fetchImpl.mock.calls.map(([url]) => toUrl(url as string | URL).pathname);
    expect(urls.some((u) => u.includes('/media'))).toBe(false);
    expect(urls.some((u) => u.endsWith('/menu-items'))).toBe(false);
  });

  it('interleaves per-type results by relevance instead of re-sorting by date', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      const typesResponse = typesRoute(parsed);
      if (typesResponse) return typesResponse;
      if (parsed.pathname.endsWith('/posts')) {
        // Relevance order from WordPress: 10 first, then 20 — note this is NOT date order.
        return jsonResponse([post(10, '2024-01-01T00:00:00'), post(20, '2024-06-01T00:00:00')]);
      }
      return jsonResponse([post(30, '2024-12-01T00:00:00', 'page')]);
    });

    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    const results = await client.search('health', 10);

    // Round-robin: posts[0], pages[0], posts[1] — relevance order preserved within each type.
    expect(results.map((r) => r.post.id)).toEqual([10, 30, 20]);
  });

  it('caps merged results at the requested limit', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      const typesResponse = typesRoute(parsed);
      if (typesResponse) return typesResponse;
      if (parsed.pathname.endsWith('/posts')) {
        return jsonResponse([post(1, '2024-01-01T00:00:00'), post(2, '2024-01-02T00:00:00')]);
      }
      return jsonResponse([post(3, '2024-01-03T00:00:00', 'page')]);
    });

    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    const results = await client.search('health', 2);

    expect(results).toHaveLength(2);
  });

  it('caches post-type discovery across multiple calls', async () => {
    let typesRequests = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      if (parsed.pathname.endsWith('/types')) {
        typesRequests += 1;
        return jsonResponse(TYPES_RESPONSE);
      }
      return jsonResponse([]);
    });

    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    await client.search('a', 5);
    await client.search('b', 5);
    await client.recent(5);

    expect(typesRequests).toBe(1);
  });
});

describe('WordPressClient.getById', () => {
  it('returns the post when found under one of the discovered types', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      const typesResponse = typesRoute(parsed);
      if (typesResponse) return typesResponse;
      if (parsed.pathname.endsWith('/posts/5')) {
        return jsonResponse(post(5, '2024-01-01T00:00:00'));
      }
      return jsonResponse({ message: 'Not found' }, { status: 404 });
    });
    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    const result = await client.getById(5);

    expect(result?.post.id).toBe(5);
  });

  it('finds the post under a different type when the first type 404s', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      const typesResponse = typesRoute(parsed);
      if (typesResponse) return typesResponse;
      if (parsed.pathname.endsWith('/posts/9')) {
        return jsonResponse({ code: 'rest_post_invalid_id', message: 'Not found' }, { status: 404 });
      }
      if (parsed.pathname.endsWith('/pages/9')) {
        return jsonResponse(post(9, '2024-01-01T00:00:00', 'page'));
      }
      throw new Error(`unexpected url: ${parsed.toString()}`);
    });
    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    const result = await client.getById(9);

    expect(result?.post.type).toBe('page');
  });

  it('returns null when the id exists under no discovered type', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      const typesResponse = typesRoute(parsed);
      if (typesResponse) return typesResponse;
      return jsonResponse({ message: 'Not found' }, { status: 404 });
    });
    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    const result = await client.getById(123);

    expect(result).toBeNull();
  });

  it('throws WordPressError for a non-404 error response, even if another type 404s', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      const typesResponse = typesRoute(parsed);
      if (typesResponse) return typesResponse;
      if (parsed.pathname.endsWith('/posts/1')) {
        return jsonResponse({ message: 'Server exploded' }, { status: 500 });
      }
      return jsonResponse({ message: 'Not found' }, { status: 404 });
    });
    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    await expect(client.getById(1)).rejects.toThrow(WordPressError);
  });

  it('throws WordPressError when the network request fails', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      const typesResponse = typesRoute(parsed);
      if (typesResponse) return typesResponse;
      throw new TypeError('fetch failed');
    });
    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    await expect(client.getById(1)).rejects.toThrow(WordPressError);
  });

  it('populates statusCode and endpoint on the thrown error', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      const typesResponse = typesRoute(parsed);
      if (typesResponse) return typesResponse;
      if (parsed.pathname.endsWith('/posts/1')) {
        return jsonResponse({ message: 'Server exploded' }, { status: 500 });
      }
      return jsonResponse({ message: 'Not found' }, { status: 404 });
    });
    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    await expect(client.getById(1)).rejects.toMatchObject({
      statusCode: 500,
      endpoint: '/wp-json/wp/v2/posts/1',
    });
  });
});

describe('WordPressClient.recent', () => {
  it('requests every discovered type ordered by date descending and merges them', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      const typesResponse = typesRoute(parsed);
      if (typesResponse) return typesResponse;
      expect(parsed.searchParams.get('orderby')).toBe('date');
      expect(parsed.searchParams.get('order')).toBe('desc');
      expect(parsed.searchParams.get('status')).toBe('publish');
      if (parsed.pathname.endsWith('/posts')) {
        return jsonResponse([post(1, '2024-01-01T00:00:00')]);
      }
      return jsonResponse([post(2, '2024-02-01T00:00:00', 'page')]);
    });
    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    const results = await client.recent(5);

    expect(results.map((r) => r.post.id)).toEqual([2, 1]);
  });
});

describe('WordPressClient featured image resolution', () => {
  it('uses the embedded featured media without an extra request', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      const typesResponse = typesRoute(parsed);
      if (typesResponse) return typesResponse;
      if (parsed.pathname.endsWith('/posts')) {
        return jsonResponse([
          post(1, '2024-01-01T00:00:00', 'post', {
            featured_media: 7,
            _embedded: {
              'wp:featuredmedia': [{ id: 7, source_url: 'https://example.com/embedded.jpg', alt_text: 'Embedded' }],
            },
          }),
        ]);
      }
      return jsonResponse([]);
    });
    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    const [result] = await client.search('x', 5);

    expect(result?.featuredImage).toEqual({
      url: 'https://example.com/embedded.jpg',
      alt: 'Embedded',
      width: null,
      height: null,
    });
    expect(fetchImpl.mock.calls.some(([url]) => toUrl(url as string | URL).pathname.includes('/media/'))).toBe(false);
  });

  it('falls back to fetching /media/{id} directly when the embed is missing, deduping by media id', async () => {
    let mediaRequests = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      const typesResponse = typesRoute(parsed);
      if (typesResponse) return typesResponse;
      if (parsed.pathname.endsWith('/posts')) {
        return jsonResponse([
          post(1, '2024-01-01T00:00:00', 'post', { featured_media: 7 }),
          post(2, '2024-01-02T00:00:00', 'post', { featured_media: 7 }),
        ]);
      }
      if (parsed.pathname.endsWith('/media/7')) {
        mediaRequests += 1;
        return jsonResponse({
          id: 7,
          source_url: 'https://example.com/fallback.jpg',
          alt_text: '',
          media_details: { width: 400, height: 300 },
        });
      }
      return jsonResponse([]);
    });
    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    const results = await client.search('x', 5);

    expect(results.every((r) => r.featuredImage?.url === 'https://example.com/fallback.jpg')).toBe(true);
    expect(results[0]?.featuredImage?.alt).toBeNull();
    expect(results[0]?.featuredImage).toEqual({
      url: 'https://example.com/fallback.jpg',
      alt: null,
      width: 400,
      height: 300,
    });
    expect(mediaRequests).toBe(1);
  });

  it('returns null when there is no featured media at all', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = toUrl(url);
      const typesResponse = typesRoute(parsed);
      if (typesResponse) return typesResponse;
      if (parsed.pathname.endsWith('/posts')) {
        return jsonResponse([post(1, '2024-01-01T00:00:00', 'post', { featured_media: 0 })]);
      }
      return jsonResponse([]);
    });
    const client = new WordPressClient({ baseUrl: 'https://example.com', timeoutMs: 5000, fetchImpl });

    const [result] = await client.search('x', 5);

    expect(result?.featuredImage).toBeNull();
  });
});
