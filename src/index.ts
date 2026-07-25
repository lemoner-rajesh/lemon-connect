import { WordPressClient } from './connectors/wordpress/client/wordpress-client.js';
import { WordPressConnector } from './connectors/wordpress/wordpress-connector.js';
import { loadConfig } from './config/env.js';
import { LemonConnectError } from './errors/index.js';
import { startHttpServer } from './server/http-transport.js';
import { startStdioServer } from './server/stdio-transport.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('bootstrap');

async function main(): Promise<void> {
  const config = loadConfig();

  const client = new WordPressClient({
    baseUrl: config.wordpressUrl,
    timeoutMs: config.wordpressTimeoutMs,
  });
  const connector = new WordPressConnector(client);

  // Presence of PORT is the deploy signal: Railway (and most PaaS targets)
  // inject it automatically, so this is enough to auto-detect transport
  // without a separate "mode" setting to keep in sync.
  if (config.port !== undefined) {
    startHttpServer(connector, config);
  } else {
    await startStdioServer(connector, config);
  }
}

main().catch((error: unknown) => {
  if (error instanceof LemonConnectError) {
    logger.fatal({ code: error.code, err: error }, 'Lemon Connect failed to start');
  } else {
    logger.fatal({ err: error }, 'Lemon Connect failed to start with an unexpected error');
  }
  process.exitCode = 1;
});
