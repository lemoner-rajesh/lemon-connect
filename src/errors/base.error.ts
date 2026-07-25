/**
 * Base class for every error raised by Lemon Connect.
 *
 * `code` is a stable, machine-readable identifier (used in logs and, where
 * appropriate, surfaced to MCP clients) that is independent of the human
 * readable `message`, which may change over time.
 */
export abstract class LemonConnectError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    Error.captureStackTrace(this, new.target);
  }
}
