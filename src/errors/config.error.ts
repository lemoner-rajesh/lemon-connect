import { AljError } from './base.error.js';

/**
 * Raised when the process environment is missing or contains an invalid
 * value for a required configuration setting. Always fatal at startup.
 */
export class ConfigError extends AljError {
  readonly code: string = 'CONFIG_ERROR';
}
