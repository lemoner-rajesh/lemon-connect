import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Connector } from '../connectors/connector.js';
import { searchResultSchema } from './schemas.js';
import { runTool } from './tool-error-handler.js';

export interface SearchContentToolOptions {
  readonly defaultLimit: number;
  readonly maxLimit: number;
}

/** Registers the `search_content` tool: full-text search over published content. */
export function registerSearchContentTool(
  server: McpServer,
  connector: Connector,
  { defaultLimit, maxLimit }: SearchContentToolOptions,
): void {
  server.registerTool(
    'search_content',
    {
      title: 'Search Content',
      description:
        'Search all published website content using natural language and return rich metadata optimized for AI ' +
        'assistants. Matches against title, excerpt, and body text across every public content type (posts, pages, ' +
        'and any custom types the site registers), ranked by relevance — exact title matches first, then title ' +
        `starts-with, slug, excerpt, and content matches (each result's \`score\` reflects this) — up to ${String(maxLimit)} results.`,
      inputSchema: {
        query: z.string().min(1).describe('Search terms, e.g. "insurance news" or "leadership team".'),
        limit: z
          .number()
          .int()
          .positive()
          .max(maxLimit)
          .optional()
          .describe(`Maximum number of results to return (default ${String(defaultLimit)}, max ${String(maxLimit)}).`),
      },
      outputSchema: {
        results: z.array(searchResultSchema),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, limit }) =>
      runTool('search_content', async () => {
        const results = await connector.search(query, limit ?? defaultLimit);
        return {
          content: [{ type: 'text', text: JSON.stringify({ results }, null, 2) }],
          structuredContent: { results },
        };
      }),
  );
}
