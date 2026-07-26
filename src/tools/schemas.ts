import { z } from 'zod';

/**
 * Zod schemas mirroring `src/types/content.ts`, used to validate and
 * describe MCP tool inputs/outputs. Kept separate from the domain types
 * because those types must stay free of any MCP or validation-library
 * concerns.
 */

export const featuredImageSchema = z.object({
  url: z.string(),
  alt: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
});

export const authorSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

export const tagSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

export const seoMetadataSchema = z.object({
  seoTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  canonicalUrl: z.string().nullable(),
  openGraphImage: z.string().nullable(),
});

export const searchResultSchema = z.object({
  id: z.string().describe('Connector-specific content id, e.g. the WordPress post/page id.'),
  title: z.string(),
  excerpt: z.string(),
  slug: z.string(),
  permalink: z.string().describe('Absolute public URL of the content.'),
  featuredImage: featuredImageSchema.nullable(),
  featuredImageAlt: z.string().nullable(),
  author: authorSchema.nullable(),
  publishedDate: z.string().describe('ISO 8601 publish date/time.'),
  modifiedDate: z.string().describe('ISO 8601 last-modified date/time.'),
  contentType: z.string().describe('The content\'s post type, e.g. "post", "page", or a custom type like "news".'),
  categories: z.array(categorySchema),
  tags: z.array(tagSchema),
  score: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      'Relevance score in [0, 1], highest first (exact title match ranks highest, down through title/slug/excerpt/content matches). Only present on search_content results.',
    ),
});

export const contentDetailsSchema = z.object({
  id: z.string(),
  title: z.string(),
  contentHtml: z.string().describe('Full content body as HTML.'),
  contentText: z
    .string()
    .describe('Full content body as plain text, with paragraph breaks preserved. Prefer this field.'),
  excerpt: z.string(),
  featuredImage: featuredImageSchema.nullable(),
  featuredImageAlt: z.string().nullable(),
  author: authorSchema.nullable(),
  publishedDate: z.string().describe('ISO 8601 publish date/time.'),
  modifiedDate: z.string().describe('ISO 8601 last-modified date/time.'),
  permalink: z.string().describe('Absolute public URL of the content.'),
  slug: z.string(),
  contentType: z.string().describe('The content\'s post type, e.g. "post", "page", or a custom type like "news".'),
  categories: z.array(categorySchema),
  tags: z.array(tagSchema),
  wordCount: z.number().describe('Word count of contentText.'),
  estimatedReadingTime: z.number().describe('Estimated reading time in whole minutes, assuming ~200 words/minute.'),
  seo: seoMetadataSchema.optional().describe('Present only when an SEO plugin (e.g. Yoast SEO) is installed.'),
});
