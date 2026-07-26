import { describe, expect, it, vi } from 'vitest';
import type { WpPost } from '../../../src/connectors/wordpress/client/types.js';
import type { ResolvedWpPost, WordPressClientPort } from '../../../src/connectors/wordpress/client/wordpress-client.js';
import { WordPressConnector } from '../../../src/connectors/wordpress/wordpress-connector.js';
import { ContentNotFoundError, ValidationError } from '../../../src/errors/index.js';

const BASE_URL = 'https://example.com';

function buildPost(overrides: Partial<WpPost> = {}): WpPost {
  return {
    id: 1,
    date_gmt: '2024-01-01T00:00:00',
    modified_gmt: '2024-01-02T00:00:00',
    slug: 'hello-world',
    status: 'publish',
    type: 'post',
    link: 'https://example.com/hello-world/',
    title: { rendered: 'Hello World' },
    content: { rendered: '<p>Hello.</p>' },
    excerpt: { rendered: '<p>Hello.</p>' },
    author: 1,
    featured_media: 0,
    ...overrides,
  };
}

function buildResolved(overrides: Partial<WpPost> = {}): ResolvedWpPost {
  return { post: buildPost(overrides), featuredImage: null };
}

function buildFakeClient(overrides: Partial<WordPressClientPort> = {}): WordPressClientPort {
  return {
    baseUrl: BASE_URL,
    search: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    recent: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('WordPressConnector.search', () => {
  it('delegates to the client and maps results', async () => {
    const client = buildFakeClient({ search: vi.fn().mockResolvedValue([buildResolved()]) });
    const connector = new WordPressConnector(client);

    const results = await connector.search('hello', 10);

    expect(client.search).toHaveBeenCalledWith('hello', 10);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: '1', title: 'Hello World' });
  });

  it('trims the query before delegating', async () => {
    const client = buildFakeClient();
    const connector = new WordPressConnector(client);

    await connector.search('  hello  ', 5);

    expect(client.search).toHaveBeenCalledWith('hello', 5);
  });

  it('rejects an empty query without calling the client', async () => {
    const client = buildFakeClient();
    const connector = new WordPressConnector(client);

    await expect(connector.search('   ', 5)).rejects.toThrow(ValidationError);
    expect(client.search).not.toHaveBeenCalled();
  });

  it('ranks the merged candidate pool by relevance and returns the top `limit`, discarding the rest', async () => {
    // An exact title match buried behind two weaker ones, exercising both re-ranking and truncation.
    const weakMatch1 = buildResolved({
      id: 1,
      title: { rendered: 'Unrelated Article' },
      content: { rendered: '<p>mentions widgets once</p>' },
    });
    const exactMatch = buildResolved({ id: 2, title: { rendered: 'Widgets' } });
    const weakMatch2 = buildResolved({
      id: 3,
      title: { rendered: 'Another Unrelated Post' },
      content: { rendered: '<p>also about widgets</p>' },
    });
    const client = buildFakeClient({ search: vi.fn().mockResolvedValue([weakMatch1, exactMatch, weakMatch2]) });
    const connector = new WordPressConnector(client);

    const results = await connector.search('widgets', 2);

    expect(results).toHaveLength(2);
    expect(results[0]?.id).toBe('2');
    expect(results[0]?.score).toBe(1);
    expect(results.every((r) => (r.score ?? 0) >= (results[1]?.score ?? 0))).toBe(true);
  });
});

describe('WordPressConnector.get', () => {
  it('returns mapped content detail for a valid numeric id', async () => {
    const client = buildFakeClient({ getById: vi.fn().mockResolvedValue(buildResolved({ id: 99 })) });
    const connector = new WordPressConnector(client);

    const detail = await connector.get('99');

    expect(client.getById).toHaveBeenCalledWith(99);
    expect(detail.id).toBe('99');
  });

  it('throws ContentNotFoundError when the client finds nothing', async () => {
    const client = buildFakeClient({ getById: vi.fn().mockResolvedValue(null) });
    const connector = new WordPressConnector(client);

    await expect(connector.get('404')).rejects.toThrow(ContentNotFoundError);
  });

  it('rejects a non-numeric id without calling the client', async () => {
    const client = buildFakeClient();
    const connector = new WordPressConnector(client);

    await expect(connector.get('not-a-number')).rejects.toThrow(ValidationError);
    expect(client.getById).not.toHaveBeenCalled();
  });
});

describe('WordPressConnector.recent', () => {
  it('delegates to the client and maps results', async () => {
    const client = buildFakeClient({ recent: vi.fn().mockResolvedValue([buildResolved(), buildResolved({ id: 2 })]) });
    const connector = new WordPressConnector(client);

    const results = await connector.recent(2);

    expect(client.recent).toHaveBeenCalledWith(2);
    expect(results).toHaveLength(2);
  });

  it('omits score, since recent content has no query to rank against', async () => {
    const client = buildFakeClient({ recent: vi.fn().mockResolvedValue([buildResolved()]) });
    const connector = new WordPressConnector(client);

    const [result] = await connector.recent(5);

    expect(result?.score).toBeUndefined();
    expect(result && 'score' in result).toBe(false);
  });
});
