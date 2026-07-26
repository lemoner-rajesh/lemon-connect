import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Connector } from '../../src/connectors/connector.js';
import { createMcpServer } from '../../src/server/create-mcp-server.js';
import type { ContentDetails, SearchResult } from '../../src/types/content.js';

const RESULT: SearchResult = {
  id: '1',
  title: 'Latest Health Article',
  excerpt: 'An article about health.',
  slug: 'health-article',
  permalink: 'https://example.com/health-article/',
  featuredImage: { url: 'https://example.com/image.jpg', alt: 'A picture', width: 800, height: 600 },
  featuredImageAlt: 'A picture',
  author: { id: 1, name: 'Jane Doe', slug: 'jane-doe' },
  publishedDate: '2024-01-01T00:00:00.000Z',
  modifiedDate: '2024-01-02T00:00:00.000Z',
  contentType: 'post',
  categories: [{ id: 1, name: 'Health', slug: 'health' }],
  tags: [],
  score: 0.85,
};

const { score: _searchOnlyScore, ...RESULT_FIELDS } = RESULT;

const DETAILS: ContentDetails = {
  ...RESULT_FIELDS,
  contentHtml: '<p>The full article body.</p>',
  contentText: 'The full article body.',
  wordCount: 4,
  estimatedReadingTime: 1,
  seo: {
    seoTitle: 'SEO Title',
    metaDescription: 'Meta description.',
    canonicalUrl: 'https://example.com/health-article/',
    openGraphImage: 'https://example.com/og.jpg',
  },
};

class FakeConnector implements Connector {
  readonly name = 'Fake Connector';

  search(): Promise<SearchResult[]> {
    return Promise.resolve([RESULT]);
  }

  get(id: string): Promise<ContentDetails> {
    if (id !== RESULT.id) {
      return Promise.reject(new Error(`no content with id ${id}`));
    }
    return Promise.resolve(DETAILS);
  }

  recent(): Promise<SearchResult[]> {
    return Promise.resolve([RESULT]);
  }
}

describe('MCP server (end-to-end over an in-memory transport)', () => {
  let client: Client;

  beforeEach(async () => {
    const server = createMcpServer(new FakeConnector(), { defaultSearchLimit: 10, maxSearchLimit: 50 });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
  });

  it('lists exactly the three alj tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(['get_content', 'list_recent_content', 'search_content']);
  });

  it('calls search_content and returns rich structured results', async () => {
    const result = await client.callTool({ name: 'search_content', arguments: { query: 'health' } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ results: [RESULT] });
  });

  it('calls get_content and returns structured detail, including seo metadata when present', async () => {
    const result = await client.callTool({ name: 'get_content', arguments: { id: '1' } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(DETAILS);
  });

  it('calls list_recent_content and returns structured results', async () => {
    const result = await client.callTool({ name: 'list_recent_content', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ results: [RESULT] });
  });

  it('rejects an empty search query as an invalid tool argument', async () => {
    const result = await client.callTool({ name: 'search_content', arguments: { query: '' } });
    expect(result.isError).toBe(true);
  });

  it('returns isError when get_content fails inside the connector', async () => {
    const result = await client.callTool({ name: 'get_content', arguments: { id: '999' } });
    expect(result.isError).toBe(true);
  });
});
