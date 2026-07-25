import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import { ConfigError } from '../../src/errors/index.js';

describe('loadConfig', () => {
  it('throws ConfigError when WORDPRESS_URL is missing', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });

  it('throws ConfigError when WORDPRESS_URL is not a valid URL', () => {
    expect(() => loadConfig({ WORDPRESS_URL: 'not-a-url' })).toThrow(ConfigError);
  });

  it('strips a trailing slash from WORDPRESS_URL', () => {
    const config = loadConfig({ WORDPRESS_URL: 'https://example.com/' });
    expect(config.wordpressUrl).toBe('https://example.com');
  });

  it('leaves port undefined when PORT is not set, signalling stdio mode', () => {
    const config = loadConfig({ WORDPRESS_URL: 'https://example.com' });
    expect(config.port).toBeUndefined();
  });

  it('parses PORT as a number when set', () => {
    const config = loadConfig({ WORDPRESS_URL: 'https://example.com', PORT: '4000' });
    expect(config.port).toBe(4000);
  });

  it('applies defaults for optional numeric settings', () => {
    const config = loadConfig({ WORDPRESS_URL: 'https://example.com' });
    expect(config.wordpressTimeoutMs).toBe(10_000);
    expect(config.defaultSearchLimit).toBe(10);
    expect(config.maxSearchLimit).toBe(50);
  });

  it('honors overrides for optional numeric settings', () => {
    const config = loadConfig({
      WORDPRESS_URL: 'https://example.com',
      WORDPRESS_TIMEOUT_MS: '2000',
      DEFAULT_SEARCH_LIMIT: '5',
      MAX_SEARCH_LIMIT: '20',
    });
    expect(config.wordpressTimeoutMs).toBe(2000);
    expect(config.defaultSearchLimit).toBe(5);
    expect(config.maxSearchLimit).toBe(20);
  });
});
