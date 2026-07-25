import { describe, expect, it } from 'vitest';
import { truncate } from '../../src/utils/text.js';

describe('truncate', () => {
  it('returns the text unchanged when it is within the limit', () => {
    expect(truncate('short text', 200)).toBe('short text');
  });

  it('truncates at the last word boundary and appends an ellipsis', () => {
    const text = 'one two three four five six seven eight nine ten';
    const result = truncate(text, 20);

    expect(result.length).toBeLessThanOrEqual(21);
    expect(result.endsWith('…')).toBe(true);
    expect(text.startsWith(result.slice(0, -1).trimEnd())).toBe(true);
  });

  it('hard-cuts when there is no word boundary within the limit', () => {
    expect(truncate('supercalifragilisticexpialidocious', 10)).toBe('supercalif…');
  });

  it('treats exact-length text as not needing truncation', () => {
    expect(truncate('12345', 5)).toBe('12345');
  });
});
