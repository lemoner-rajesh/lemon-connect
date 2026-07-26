import { AljError } from './base.error.js';

/**
 * Raised when caller-supplied input (e.g. MCP tool arguments) fails
 * domain-level validation that a schema alone cannot express.
 */
export class ValidationError extends AljError {
  readonly code: string = 'VALIDATION_ERROR';
}
