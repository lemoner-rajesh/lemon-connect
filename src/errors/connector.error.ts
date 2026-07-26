import { AljError } from './base.error.js';

/**
 * Base class for failures raised by a `Connector` implementation. Specific
 * connectors (e.g. WordPress) should extend this rather than throwing it
 * directly, so callers can distinguish connectors by error type when needed.
 */
export class ConnectorError extends AljError {
  readonly code: string = 'CONNECTOR_ERROR';
}

/**
 * Raised when a connector could not find the requested content.
 */
export class ContentNotFoundError extends ConnectorError {
  override readonly code: string = 'CONTENT_NOT_FOUND';
}
