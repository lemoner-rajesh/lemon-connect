import { describe, expect, it } from 'vitest';
import { toAbsoluteUrl } from '../../src/utils/url.js';

describe('toAbsoluteUrl', () => {
  const baseUrl = 'https://example.com';

  it('resolves a root-relative path against the base URL', () => {
    expect(toAbsoluteUrl('/pricing', baseUrl)).toBe('https://example.com/pricing');
  });

  it('leaves an already-absolute URL unchanged', () => {
    expect(toAbsoluteUrl('https://other.com/x', baseUrl)).toBe('https://other.com/x');
  });

  it('leaves a mailto URI unchanged', () => {
    expect(toAbsoluteUrl('mailto:a@b.com', baseUrl)).toBe('mailto:a@b.com');
  });

  it('falls back to the original value when it cannot be parsed', () => {
    expect(toAbsoluteUrl('', '')).toBe('');
  });
});
