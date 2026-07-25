import { ContentNotFoundError, ValidationError } from '../../errors/index.js';
import type { ContentDetails, SearchResult } from '../../types/content.js';
import type { Connector } from '../connector.js';
import type { WordPressClientPort } from './client/wordpress-client.js';
import { toContentDetails, toSearchResult } from './mappers/content-mapper.js';

/**
 * Connector implementation backing the "WordPress Search" MCP connector.
 *
 * This class contains the connector's business logic (input validation,
 * translating raw WordPress responses to domain types, deciding what "not
 * found" means) and is deliberately independent of both the WordPress REST
 * API details (owned by `WordPressClient`) and the MCP protocol (owned by
 * the `tools` layer). It depends on `WordPressClientPort` through the
 * constructor, so it can be unit tested with a fake/mock client.
 */
export class WordPressConnector implements Connector {
  readonly name = 'WordPress Search';

  constructor(private readonly client: WordPressClientPort) {}

  async search(query: string, limit: number): Promise<SearchResult[]> {
    if (query.trim().length === 0) {
      throw new ValidationError('query must not be empty.');
    }

    const resolved = await this.client.search(query.trim(), limit);
    return resolved.map((post) => toSearchResult(post, this.client.baseUrl));
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
    return resolved.map((post) => toSearchResult(post, this.client.baseUrl));
  }
}

function parsePositiveInteger(id: string): number {
  const trimmed = id.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new ValidationError(`id must be a positive integer, received "${id}".`);
  }
  return Number.parseInt(trimmed, 10);
}
