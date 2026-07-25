import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Connector } from '../connectors/connector.js';
import { searchResultSchema } from './schemas.js';
import { runTool } from './tool-error-handler.js';

export interface ListRecentContentToolOptions {
  readonly defaultLimit: number;
  readonly maxLimit: number;
}

/** Registers the `list_recent_content` tool: the most recently published content across all public content types. */
export function registerListRecentContentTool(
  server: McpServer,
  connector: Connector,
  { defaultLimit, maxLimit }: ListRecentContentToolOptions,
): void {
  server.registerTool(
    'list_recent_content',
    {
      title: 'List Recent Content',
      description:
        'List the most recently published content across every public content type (posts, pages, and any ' +
        `custom types the site registers), newest first. Returns rich metadata suitable for AI assistants — up ` +
        `to ${String(maxLimit)} items.`,
      inputSchema: {
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
    async ({ limit }) =>
      runTool('list_recent_content', async () => {
        const results = await connector.recent(limit ?? defaultLimit);
        return {
          content: [{ type: 'text', text: JSON.stringify({ results }, null, 2) }],
          structuredContent: { results },
        };
      }),
  );
}
