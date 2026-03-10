import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateResponse, extractJson, callWizardLLM } from '../llm.js';
import { COVAL_WIZARD_ENDPOINT, LLM_DEFAULTS } from '../constants.js';

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

function mockFetchOk(responseBody: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(responseBody)));
}

describe('callWizardLLM provider routing', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.WIZARD_LLM_KEY = process.env.WIZARD_LLM_KEY;
    savedEnv.WIZARD_LLM_PROVIDER = process.env.WIZARD_LLM_PROVIDER;
    savedEnv.WIZARD_LLM_MODEL = process.env.WIZARD_LLM_MODEL;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v !== undefined) process.env[k] = v;
      else delete process.env[k];
    }
  });

  it('routes to Coval proxy when WIZARD_LLM_KEY is not set', async () => {
    delete process.env.WIZARD_LLM_KEY;
    const mock = mockFetchOk(VALID_LLM_RESPONSE);

    await callWizardLLM(CALL_OPTS);

    expect(mock.mock.calls[0][0]).toBe(COVAL_WIZARD_ENDPOINT);
  });

  it('routes to Anthropic by default when WIZARD_LLM_KEY is set', async () => {
    process.env.WIZARD_LLM_KEY = 'sk-ant-test';
    delete process.env.WIZARD_LLM_PROVIDER;

    const mock = mockFetchOk({
      content: [{ type: 'text', text: JSON.stringify(VALID_LLM_RESPONSE) }],
    });

    await callWizardLLM(CALL_OPTS);

    const [url, init] = mock.mock.calls[0];
    expect(url).toBe(LLM_DEFAULTS.anthropic.endpoint);
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('routes to OpenAI when WIZARD_LLM_PROVIDER=openai', async () => {
    process.env.WIZARD_LLM_KEY = 'sk-openai-test';
    process.env.WIZARD_LLM_PROVIDER = 'openai';

    const mock = mockFetchOk({
      choices: [{ message: { content: JSON.stringify(VALID_LLM_RESPONSE) } }],
    });

    await callWizardLLM(CALL_OPTS);

    const [url, init] = mock.mock.calls[0];
    expect(url).toBe(LLM_DEFAULTS.openai.endpoint);
    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-openai-test');
  });

  it('routes to Gemini when WIZARD_LLM_PROVIDER=gemini', async () => {
    process.env.WIZARD_LLM_KEY = 'gemini-key';
    process.env.WIZARD_LLM_PROVIDER = 'gemini';

    const mock = mockFetchOk({
      candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_LLM_RESPONSE) }] } }],
    });

    await callWizardLLM(CALL_OPTS);

    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('gemini-2.5-flash');
    expect(url).toContain('key=gemini-key');
  });

  it('respects WIZARD_LLM_MODEL override', async () => {
    process.env.WIZARD_LLM_KEY = 'sk-ant-test';
    process.env.WIZARD_LLM_PROVIDER = 'anthropic';
    process.env.WIZARD_LLM_MODEL = 'claude-opus-4-20250514';

    const mock = mockFetchOk({
      content: [{ type: 'text', text: JSON.stringify(VALID_LLM_RESPONSE) }],
    });

    await callWizardLLM(CALL_OPTS);

    const body = JSON.parse(mock.mock.calls[0][1]?.body as string);
    expect(body.model).toBe('claude-opus-4-20250514');
  });

  it('throws on unknown provider', async () => {
    process.env.WIZARD_LLM_KEY = 'test';
    process.env.WIZARD_LLM_PROVIDER = 'llama';

    await expect(callWizardLLM(CALL_OPTS)).rejects.toThrow('Unknown WIZARD_LLM_PROVIDER');
  });

  it('throws on non-OK HTTP response', async () => {
    delete process.env.WIZARD_LLM_KEY;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    await expect(callWizardLLM(CALL_OPTS)).rejects.toThrow('LLM API error (401)');
  });

  it('throws when Anthropic response has no text block', async () => {
    process.env.WIZARD_LLM_KEY = 'sk-ant-test';
    delete process.env.WIZARD_LLM_PROVIDER;
    mockFetchOk({ content: [{ type: 'image', source: {} }] });

    await expect(callWizardLLM(CALL_OPTS)).rejects.toThrow('No text in Anthropic response');
  });

  it('throws when OpenAI response has no choices', async () => {
    process.env.WIZARD_LLM_KEY = 'sk-test';
    process.env.WIZARD_LLM_PROVIDER = 'openai';
    mockFetchOk({ choices: [] });

    await expect(callWizardLLM(CALL_OPTS)).rejects.toThrow('No text in OpenAI response');
  });

  it('throws when Gemini response has no candidates', async () => {
    process.env.WIZARD_LLM_KEY = 'test';
    process.env.WIZARD_LLM_PROVIDER = 'gemini';
    mockFetchOk({ candidates: [] });

    await expect(callWizardLLM(CALL_OPTS)).rejects.toThrow('No text in Gemini response');
  });
});

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"key": "value"}')).toEqual({ key: 'value' });
  });

  it('extracts from fenced code block', () => {
    expect(extractJson('```json\n{"key": "value"}\n```')).toEqual({ key: 'value' });
  });

  it('extracts from fence without language tag', () => {
    expect(extractJson('```\n{"key": "value"}\n```')).toEqual({ key: 'value' });
  });

  it('throws on invalid JSON with helpful message', () => {
    expect(() => extractJson('not json {{')).toThrow('Failed to parse LLM response as JSON');
  });
});

describe('validateResponse', () => {
  it('accepts a valid response', () => {
    expect(validateResponse(VALID_LLM_RESPONSE)).toEqual(VALID_LLM_RESPONSE);
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

  it('rejects non-string fields', () => {
    expect(() =>
      validateResponse({
        coval_tracing_py: {},
        modified_entry_point: 1,
        explanation: null,
      }),
    ).toThrow('expected string fields');
  });
});
