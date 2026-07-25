import { describe, expect, it } from 'vitest';
import { toFeaturedImage } from '../../../../src/connectors/wordpress/mappers/media-mapper.js';

const BASE_URL = 'https://example.com';

describe('toFeaturedImage', () => {
  it('maps a full media object', () => {
    const image = toFeaturedImage(
      {
        id: 1,
        source_url: 'https://example.com/x.jpg',
        alt_text: 'A photo',
        media_details: { width: 100, height: 200 },
      },
      BASE_URL,
    );

    expect(image).toEqual({ url: 'https://example.com/x.jpg', alt: 'A photo', width: 100, height: 200 });
  });

  it('normalizes an empty alt_text to null', () => {
    const image = toFeaturedImage({ id: 1, source_url: 'https://example.com/x.jpg', alt_text: '' }, BASE_URL);
    expect(image.alt).toBeNull();
  });

  it('normalizes missing width/height to null', () => {
    const image = toFeaturedImage({ id: 1, source_url: 'https://example.com/x.jpg' }, BASE_URL);
    expect(image.width).toBeNull();
    expect(image.height).toBeNull();
  });

  it('absolutizes a site-relative source_url', () => {
    const image = toFeaturedImage({ id: 1, source_url: '/uploads/x.jpg' }, BASE_URL);
    expect(image.url).toBe('https://example.com/uploads/x.jpg');
  });
});
