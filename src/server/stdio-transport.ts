import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { AppConfig } from '../config/env.js';
import type { Connector } from '../connectors/connector.js';
import { createLogger } from '../utils/logger.js';
import { createMcpServer } from './create-mcp-server.js';

const logger = createLogger('stdio-transport');

/**
 * Runs Lemon Connect over the stdio MCP transport, for local clients like
 * Claude Desktop. There is exactly one server/session per process lifetime.
 */
export async function startStdioServer(connector: Connector, config: AppConfig): Promise<void> {
  const server = createMcpServer(connector, config);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info({ connector: connector.name }, 'Lemon Connect is running over stdio');
}
