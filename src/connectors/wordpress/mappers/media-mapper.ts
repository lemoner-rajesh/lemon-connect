import type { FeaturedImage } from '../../../types/content.js';
import { toAbsoluteUrl } from '../../../utils/url.js';
import type { WpMedia } from '../client/types.js';

/** Maps a raw WordPress media (attachment) object into the domain `FeaturedImage` shape. */
export function toFeaturedImage(media: WpMedia, baseUrl: string): FeaturedImage {
  return {
    url: toAbsoluteUrl(media.source_url ?? '', baseUrl),
    alt: media.alt_text && media.alt_text.length > 0 ? media.alt_text : null,
    width: media.media_details?.width ?? null,
    height: media.media_details?.height ?? null,
  };
}
