import type { ContentDetails, SearchResult } from '../types/content.js';

/**
 * Contract every content connector must implement.
 *
 * MCP tools depend only on this interface, never on a specific backend
 * (WordPress, Drupal, Contentful, ...). Adding a new connector means writing
 * a new implementation of this interface and wiring it up at startup — the
 * tools layer does not change.
 */
export interface Connector {
  /** Human-readable name of the backend this connector talks to, e.g. "WordPress Search". */
  readonly name: string;

  /** Searches published content for `query`, returning up to `limit` results. */
  search(query: string, limit: number): Promise<SearchResult[]>;

  /** Fetches full detail for a single piece of content by its connector-specific id. */
  get(id: string): Promise<ContentDetails>;

  /** Returns the most recently published content, up to `limit` items. */
  recent(limit: number): Promise<SearchResult[]>;
}
