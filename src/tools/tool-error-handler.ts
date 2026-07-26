import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AljError } from '../errors/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('tools');

/**
 * Runs a tool handler and converts any thrown error into an `isError`
 * `CallToolResult` instead of letting it propagate as a protocol-level
 * failure. This lets the LLM see *why* a tool call failed (bad input,
 * content not found, upstream WordPress failure) and react accordingly,
 * rather than the client just seeing an opaque JSON-RPC error.
 */
export async function runTool(toolName: string, handler: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof AljError) {
      logger.warn({ tool: toolName, code: error.code, err: error }, 'Tool call failed');
      return errorResult(error.message);
    }

    logger.error({ tool: toolName, err: error }, 'Tool call failed with an unexpected error');
    return errorResult('An unexpected error occurred while handling this request.');
  }
}

function errorResult(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}
