import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Connector } from '../connectors/connector.js';
import { registerGetContentTool } from './get-content.tool.js';
import { registerListRecentContentTool } from './list-recent-content.tool.js';
import { registerSearchContentTool } from './search-content.tool.js';

export interface RegisterToolsOptions {
  readonly defaultSearchLimit: number;
  readonly maxSearchLimit: number;
}

/** Registers all Lemon Connect MCP tools against `server`, backed by `connector`. */
export function registerTools(server: McpServer, connector: Connector, options: RegisterToolsOptions): void {
  registerSearchContentTool(server, connector, {
    defaultLimit: options.defaultSearchLimit,
    maxLimit: options.maxSearchLimit,
  });
  registerGetContentTool(server, connector);
  registerListRecentContentTool(server, connector, {
    defaultLimit: options.defaultSearchLimit,
    maxLimit: options.maxSearchLimit,
  });
}
