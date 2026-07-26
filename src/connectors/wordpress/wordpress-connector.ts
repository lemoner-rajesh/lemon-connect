import { ContentNotFoundError, ValidationError } from '../../errors/index.js';
import type { ContentDetails, SearchResult } from '../../types/content.js';
import type { Connector } from '../connector.js';
import type { WordPressClientPort } from './client/wordpress-client.js';
import { toContentDetails, toSearchResult } from './mappers/content-mapper.js';

/**
 * Connector implementation backing the "WordPress Search" MCP connector.
 *
 * This class contains the connector's business logic (input validation,
 * translating raw WordPress responses to domain types, ranking search
 * results, deciding what "not found" means) and is deliberately independent
 * of both the WordPress REST API details (owned by `WordPressClient`) and
 * the MCP protocol (owned by the `tools` layer). It depends on
 * `WordPressClientPort` through the constructor, so it can be unit tested
 * with a fake/mock client.
 */
export class WordPressConnector implements Connector {
  readonly name = 'WordPress Search';

  constructor(private readonly client: WordPressClientPort) {}

  /**
   * `WordPressClient.search` returns an unranked candidate pool spanning
   * every post type; ranking against `query` (via `computeRelevanceScore`)
   * and picking the true top `limit` results happens here, since relevance
   * is a property of the mapped domain result, not the raw WordPress
   * response.
   */
  async search(query: string, limit: number): Promise<SearchResult[]> {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      throw new ValidationError('query must not be empty.');
    }

    const resolved = await this.client.search(trimmedQuery, limit);
    const results = resolved.map((post) => toSearchResult(post, this.client.baseUrl, trimmedQuery));

    return results
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.publishedDate.localeCompare(a.publishedDate))
      .slice(0, limit);
  }

  async get(id: string): Promise<ContentDetails> {
    const numericId = parsePositiveInteger(id);
    const resolved = await this.client.getById(numericId);

    if (!resolved) {
      throw new ContentNotFoundError(`No content found with id "${id}".`);
    }

    return toContentDetails(resolved, this.client.baseUrl);
  }

  async recent(limit: number): Promise<SearchResult[]> {
    const resolved = await this.client.recent(limit);
    // No query to rank against — recent() is already date-ordered by the client.
    return resolved.map((post) => toSearchResult(post, this.client.baseUrl, null));
  }
}

function parsePositiveInteger(id: string): number {
  const trimmed = id.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new ValidationError(`id must be a positive integer, received "${id}".`);
  }
  return Number.parseInt(trimmed, 10);
}
