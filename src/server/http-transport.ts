import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { AppConfig } from '../config/env.js';
import type { Connector } from '../connectors/connector.js';
import { createLogger } from '../utils/logger.js';
import { createMcpServer, SERVER_NAME, SERVER_VERSION } from './create-mcp-server.js';

const logger = createLogger('http-transport');

const JSON_RPC_METHOD_NOT_ALLOWED = {
  jsonrpc: '2.0' as const,
  error: { code: -32000, message: 'Method not allowed. Send MCP requests as POST /mcp.' },
  id: null,
};

const JSON_RPC_INTERNAL_ERROR = {
  jsonrpc: '2.0' as const,
  error: { code: -32603, message: 'Internal server error.' },
  id: null,
};

/**
 * Runs alj over the Streamable HTTP MCP transport, for remote
 * clients (e.g. deployed on Railway).
 *
 * The `/mcp` endpoint is stateless: every request gets a fresh `McpServer`
 * and transport (`sessionIdGenerator: undefined`), which is closed once the
 * response completes. Phase 1 only exposes public WordPress content, so no
 * authentication is applied — that's introduced in a later phase.
 */
export function startHttpServer(connector: Connector, config: AppConfig): void {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors);
  app.use(express.json());
  app.use(handleJsonParseErrors);

  app.get('/', (_req, res) => {
    res.json({ name: SERVER_NAME, connector: connector.name, status: 'running', version: SERVER_VERSION });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/mcp', (req, res) => {
    void handleMcpRequest(req, res, connector, config);
  });

  app.get('/mcp', (_req, res) => {
    res.status(405).json(JSON_RPC_METHOD_NOT_ALLOWED);
  });

  app.delete('/mcp', (_req, res) => {
    res.status(405).json(JSON_RPC_METHOD_NOT_ALLOWED);
  });

  const port = config.port;
  if (port === undefined) {
    throw new Error('startHttpServer requires config.port to be set.');
  }

  app.listen(port, () => {
    logger.info({ port, connector: connector.name }, 'alj is running over Streamable HTTP');
  });
}

async function handleMcpRequest(req: Request, res: Response, connector: Connector, config: AppConfig): Promise<void> {
  const server = createMcpServer(connector, config);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error({ err: error }, 'Error handling MCP request');
    if (!res.headersSent) {
      res.status(500).json(JSON_RPC_INTERNAL_ERROR);
    }
  }
}

/**
 * Public, no-authentication read access means any origin can call this API,
 * matching how a public WordPress REST API already behaves.
 */
function cors(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
}

function handleJsonParseErrors(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error.' }, id: null });
    return;
  }
  next(err);
}
