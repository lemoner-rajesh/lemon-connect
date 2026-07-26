import { describe, expect, it } from 'vitest';
import { computeRelevanceScore } from '../../src/utils/relevance.js';

const FIELDS = {
  title: 'The Rise of Electric Vehicles',
  slug: 'the-rise-of-electric-vehicles',
  excerpt: 'A look at why EVs are gaining traction and what the future holds.',
  content: 'Electric vehicles are becoming mainstream. Battery technology keeps improving every year.',
};

describe('computeRelevanceScore', () => {
  it('scores an exact title match highest', () => {
    const score = computeRelevanceScore('The Rise of Electric Vehicles', FIELDS);
    expect(score).toBe(1);
  });

  it('is case-insensitive for an exact title match', () => {
    const score = computeRelevanceScore('the rise of electric vehicles', FIELDS);
    expect(score).toBe(1);
  });

  it('scores a title-starts-with match below an exact match', () => {
    const score = computeRelevanceScore('The Rise of', FIELDS);
    expect(score).toBeLessThan(1);
    expect(score).toBeGreaterThan(0.7);
  });

  it('scores a title-contains match below starts-with', () => {
    const startsWith = computeRelevanceScore('The Rise of', FIELDS);
    const contains = computeRelevanceScore('Electric Vehicles', FIELDS);
    expect(contains).toBeLessThan(startsWith);
    expect(contains).toBeGreaterThan(0.55);
  });

  it('scores a slug match below a title match but above excerpt/content matches', () => {
    const titleContains = computeRelevanceScore('Electric Vehicles', FIELDS);
    const slugScore = computeRelevanceScore('rise-of', FIELDS);
    expect(slugScore).toBeLessThan(titleContains);
    expect(slugScore).toBeGreaterThan(0.4);
  });

  it('scores an excerpt match below a slug match but above a content-only match', () => {
    const excerptScore = computeRelevanceScore('gaining traction', FIELDS);
    const contentScore = computeRelevanceScore('battery technology', FIELDS);
    expect(excerptScore).toBeGreaterThan(contentScore);
  });

  it('scores a content-only match lowest among direct matches, but above no match', () => {
    const contentScore = computeRelevanceScore('battery technology', FIELDS);
    const noMatch = computeRelevanceScore('quantum computing', FIELDS);
    expect(contentScore).toBeGreaterThan(noMatch);
  });

  it('returns the lowest score when nothing matches directly', () => {
    const score = computeRelevanceScore('quantum computing', FIELDS);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.25);
  });

  it('always returns a score within [0, 1]', () => {
    for (const query of ['', '   ', 'The Rise of Electric Vehicles', 'nonsense', 'rise']) {
      const score = computeRelevanceScore(query, FIELDS);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
