import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateResponse, callWizardLLM } from '../llm.js';
import { ANTHROPIC_API_ENDPOINT, COVAL_WIZARD_ENDPOINT } from '../constants.js';

const VALID_LLM_RESPONSE = {
  coval_tracing_py: '# tracing code',
  modified_entry_point: '# modified code',
  explanation: 'Added tracing',
};

const CALL_OPTS = {
  apiKey: 'test-api-key',
  framework: 'pipecat' as const,
  entryPointPath: 'bot.py',
  entryPointContent: 'from pipecat import Pipeline\n',
  additionalFiles: {},
};

describe('callWizardLLM', () => {
  let savedKey: string | undefined;

  beforeEach(() => {
    savedKey = process.env.WIZARD_LLM_KEY;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (savedKey !== undefined) {
      process.env.WIZARD_LLM_KEY = savedKey;
    } else {
      delete process.env.WIZARD_LLM_KEY;
    }
  });

  it('routes to Anthropic when WIZARD_LLM_KEY is set', async () => {
    process.env.WIZARD_LLM_KEY = 'sk-ant-test';

    const anthropicResponse = {
      content: [{ type: 'text', text: JSON.stringify(VALID_LLM_RESPONSE) }],
    };
    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(anthropicResponse)));

    await callWizardLLM(CALL_OPTS);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(ANTHROPIC_API_ENDPOINT);
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('routes to Coval proxy when WIZARD_LLM_KEY is not set', async () => {
    delete process.env.WIZARD_LLM_KEY;

    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(VALID_LLM_RESPONSE)));

    await callWizardLLM(CALL_OPTS);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(COVAL_WIZARD_ENDPOINT);
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-api-key');
  });

  it('throws on non-OK HTTP response', async () => {
    delete process.env.WIZARD_LLM_KEY;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    await expect(callWizardLLM(CALL_OPTS)).rejects.toThrow('LLM API error (401)');
  });

  it('throws when Anthropic response has no text block', async () => {
    process.env.WIZARD_LLM_KEY = 'sk-ant-test';

    const badResponse = { content: [{ type: 'image', source: {} }] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(badResponse)));

    await expect(callWizardLLM(CALL_OPTS)).rejects.toThrow('No text response from Claude');
  });

  it('extracts JSON from fenced code blocks in Anthropic response', async () => {
    process.env.WIZARD_LLM_KEY = 'sk-ant-test';

    const fencedJson = '```json\n' + JSON.stringify(VALID_LLM_RESPONSE) + '\n```';
    const anthropicResponse = {
      content: [{ type: 'text', text: fencedJson }],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(anthropicResponse)),
    );

    const result = await callWizardLLM(CALL_OPTS);
    expect(result).toEqual(VALID_LLM_RESPONSE);
  });

  it('throws on invalid JSON in Anthropic response', async () => {
    process.env.WIZARD_LLM_KEY = 'sk-ant-test';

    const anthropicResponse = {
      content: [{ type: 'text', text: 'not valid json {{{' }],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(anthropicResponse)),
    );

    await expect(callWizardLLM(CALL_OPTS)).rejects.toThrow();
  });

  it('throws when proxy returns response missing required fields', async () => {
    delete process.env.WIZARD_LLM_KEY;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ some: 'other data' })),
    );

    await expect(callWizardLLM(CALL_OPTS)).rejects.toThrow('missing required fields');
  });
});

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
