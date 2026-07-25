import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../config/env.js';
import type { Connector } from '../connectors/connector.js';
import { registerTools } from '../tools/register-tools.js';

export const SERVER_NAME = 'Lemon Connect';
export const SERVER_VERSION = '0.1.0';

/**
 * Builds an `McpServer` exposing the Lemon Connect tools for `connector`.
 *
 * A fresh server instance is created per stdio process and per stateless
 * HTTP request (see `server/http-transport.ts`), so this factory takes the
 * connector and limits as plain arguments rather than reaching into globals.
 */
export function createMcpServer(
  connector: Connector,
  config: Pick<AppConfig, 'defaultSearchLimit' | 'maxSearchLimit'>,
): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions: `Lemon Connect exposes read-only search over the public content of a single WordPress site via the "${connector.name}" connector, covering every public content type the site registers (posts, pages, and any custom types). Use search_content to find content matching a topic, list_recent_content for the latest published content, and get_content to fetch full rich detail once you have an id. All results include rich metadata (author, featured image, categories, tags, published date) suitable for rendering rich cards.`,
    },
  );

  registerTools(server, connector, {
    defaultSearchLimit: config.defaultSearchLimit,
    maxSearchLimit: config.maxSearchLimit,
  });

  return server;
}
