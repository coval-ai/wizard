import { describe, it, expect } from 'vitest';
import { validateResponse } from '../llm.js';

describe('validateResponse', () => {
  it('accepts a valid response', () => {
    const data = {
      coval_tracing_py: '# tracing code',
      modified_entry_point: '# modified code',
      explanation: 'Added tracing',
    };
    expect(validateResponse(data)).toEqual(data);
  });

  it('rejects null', () => {
    expect(() => validateResponse(null)).toThrow('missing required fields');
  });

  it('rejects missing fields', () => {
    expect(() => validateResponse({ coval_tracing_py: 'x' })).toThrow('missing required fields');
  });

  it('rejects non-objects', () => {
    expect(() => validateResponse('string')).toThrow('missing required fields');
  });

  it('rejects empty object', () => {
    expect(() => validateResponse({})).toThrow('missing required fields');
  });
});
