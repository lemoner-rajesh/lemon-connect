import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { ConfigError } from '../errors/index.js';

// Populates process.env from a local .env file, if one exists. No-op on
// platforms like Railway where configuration is injected directly.
// `quiet: true` is required, not cosmetic: dotenv's startup banner is written
// to stdout, which is also the JSON-RPC message stream for the stdio
// transport — anything printed there corrupts it.
loadDotenv({ quiet: true });

const envSchema = z.object({
  WORDPRESS_URL: z
    .string({ message: 'WORDPRESS_URL is required' })
    .trim()
    .min(1, 'WORDPRESS_URL is required')
    .pipe(z.url('WORDPRESS_URL must be a valid URL, e.g. https://example.com')),
  PORT: z.coerce.number().int().positive().optional(),
  WORDPRESS_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  DEFAULT_SEARCH_LIMIT: z.coerce.number().int().positive().optional(),
  MAX_SEARCH_LIMIT: z.coerce.number().int().positive().optional(),
});

export interface AppConfig {
  /** Base URL of the WordPress site, with any trailing slash removed. */
  readonly wordpressUrl: string;
  /**
   * Port to listen on for the Streamable HTTP transport. `undefined` means
   * "no PORT was set", which is the signal to use the stdio transport instead.
   */
  readonly port: number | undefined;
  readonly wordpressTimeoutMs: number;
  readonly defaultSearchLimit: number;
  readonly maxSearchLimit: number;
}

const DEFAULT_WORDPRESS_TIMEOUT_MS = 10_000;
const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_MAX_SEARCH_LIMIT = 50;

/**
 * Loads and validates configuration from the process environment.
 *
 * Throws {@link ConfigError} if required settings are missing or malformed.
 * This is intended to run once, early in startup, so misconfiguration fails
 * fast with a clear message rather than surfacing later as a confusing
 * WordPress API error.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const details = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new ConfigError(`Invalid configuration:\n${details}`);
  }

  const parsed = result.data;

  return {
    wordpressUrl: parsed.WORDPRESS_URL.replace(/\/+$/, ''),
    port: parsed.PORT,
    wordpressTimeoutMs: parsed.WORDPRESS_TIMEOUT_MS ?? DEFAULT_WORDPRESS_TIMEOUT_MS,
    defaultSearchLimit: parsed.DEFAULT_SEARCH_LIMIT ?? DEFAULT_SEARCH_LIMIT,
    maxSearchLimit: parsed.MAX_SEARCH_LIMIT ?? DEFAULT_MAX_SEARCH_LIMIT,
  };
}
