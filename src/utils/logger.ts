import pino from 'pino';

/**
 * All logging goes to stderr, never stdout.
 *
 * This is not a style preference: when alj runs over the stdio MCP
 * transport, stdout *is* the JSON-RPC message stream. Anything else written
 * there corrupts the protocol. Keeping every logger on stderr means the same
 * logging code is safe under both stdio and HTTP transports.
 */
const destination = pino.destination({ fd: 2, sync: true });

const VALID_LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

function resolveLevel(): string {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  return configured && VALID_LEVELS.has(configured) ? configured : 'info';
}

const rootLogger = pino({ level: resolveLevel(), base: { service: 'alj' } }, destination);

/**
 * Creates a namespaced child logger, e.g. `createLogger('wordpress-client')`.
 */
export function createLogger(component: string): pino.Logger {
  return rootLogger.child({ component });
}
