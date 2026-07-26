import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/errors/index.js';
import { runTool } from '../../src/tools/tool-error-handler.js';

describe('runTool', () => {
  it('returns the handler result unchanged on success', async () => {
    const result = await runTool('test_tool', async () => ({ content: [{ type: 'text', text: 'ok' }] }));
    expect(result).toEqual({ content: [{ type: 'text', text: 'ok' }] });
  });

  it('converts an AljError into an isError result with its message', async () => {
    const result = await runTool('test_tool', () => {
      throw new ValidationError('id must be a positive integer.');
    });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'id must be a positive integer.' }]);
  });

  it('converts an unexpected error into a generic isError result without leaking details', async () => {
    const result = await runTool('test_tool', () => {
      throw new Error('secret internal detail');
    });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: 'An unexpected error occurred while handling this request.' },
    ]);
  });
});
