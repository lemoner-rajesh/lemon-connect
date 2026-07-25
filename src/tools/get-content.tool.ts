import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Connector } from '../connectors/connector.js';
import { contentDetailsSchema } from './schemas.js';
import { runTool } from './tool-error-handler.js';

/** Registers the `get_content` tool: fetch full detail for a single piece of content by id. */
export function registerGetContentTool(server: McpServer, connector: Connector): void {
  server.registerTool(
    'get_content',
    {
      title: 'Get Content',
      description:
        'Retrieve a complete content item including rich metadata and cleaned text: full body (as both HTML and ' +
        'plain text), excerpt, author, featured image, published date, categories, tags, and — when the site has ' +
        'an SEO plugin like Yoast SEO installed — SEO title, meta description, canonical URL, and Open Graph image.',
      inputSchema: {
        id: z.string().min(1).describe('The content id, as returned by search_content or list_recent_content.'),
      },
      outputSchema: contentDetailsSchema.shape,
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ id }) =>
      runTool('get_content', async () => {
        const detail = await connector.get(id);
        return {
          content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }],
          structuredContent: { ...detail },
        };
      }),
  );
}
