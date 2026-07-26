import { describe, expect, it } from 'vitest';
import { countWords, estimateReadingTimeMinutes, truncate } from '../../src/utils/text.js';

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

describe('countWords', () => {
  it('counts space-separated words', () => {
    expect(countWords('one two three')).toBe(3);
  });

  it('treats paragraph breaks and repeated whitespace as separators', () => {
    expect(countWords('one\n\ntwo   three')).toBe(3);
  });

  it('returns 0 for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });
});

describe('estimateReadingTimeMinutes', () => {
  it('returns 0 for no words', () => {
    expect(estimateReadingTimeMinutes(0)).toBe(0);
  });

  it('rounds up to the nearest whole minute at ~200 words/minute', () => {
    expect(estimateReadingTimeMinutes(200)).toBe(1);
    expect(estimateReadingTimeMinutes(201)).toBe(2);
    expect(estimateReadingTimeMinutes(450)).toBe(3);
  });

  it('returns a minimum of 1 minute for any non-empty content', () => {
    expect(estimateReadingTimeMinutes(1)).toBe(1);
    expect(estimateReadingTimeMinutes(50)).toBe(1);
  });
});
