import { ConnectorError } from './connector.error.js';

/**
 * Raised when a request to the WordPress REST API fails: network failure,
 * timeout, or a non-2xx response that isn't a plain "not found".
 *
 * Carries structured diagnostic fields (`statusCode`, `endpoint`, `cause`)
 * for logging, in addition to the human-readable `message`. `message` is
 * always a clean, client-safe summary — WordPress response bodies and stack
 * traces are logged server-side (see `WordPressClient`), never surfaced
 * through this error's `message`.
 */
export class WordPressError extends ConnectorError {
  override readonly code: string = 'WORDPRESS_ERROR';

  readonly statusCode: number | undefined;
  /** The WordPress REST API path that was requested, e.g. `/wp-json/wp/v2/posts/42`. */
  readonly endpoint: string | undefined;

  constructor(message: string, options?: { cause?: unknown; statusCode?: number; endpoint?: string }) {
    super(message, { cause: options?.cause });
    this.statusCode = options?.statusCode;
    this.endpoint = options?.endpoint;
  }
}
