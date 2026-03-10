import { jest } from '@jest/globals'
import { validateResponse, extractJson, callWizardLLM } from '../llm.js'
import { LLM_DEFAULTS, LLM_PROVIDERS } from '../constants.js'
import type { LLMConfig } from '../llm.js'

const VALID_LLM_RESPONSE = {
  coval_tracing_py: '# tracing code',
  modified_entry_point: '# modified code',
  explanation: 'Added tracing',
}

const BASE_CALL_OPTS = {
  framework: 'pipecat' as const,
  entryPointPath: 'bot.py',
  entryPointContent: 'from pipecat import Pipeline\n',
  additionalFiles: {},
}

const anthropicConfig: LLMConfig = {
  key: 'sk-ant-test',
  provider: LLM_PROVIDERS.ANTHROPIC,
  model: LLM_DEFAULTS.anthropic.model,
  endpoint: LLM_DEFAULTS.anthropic.endpoint,
}

const openaiConfig: LLMConfig = {
  key: 'sk-openai-test',
  provider: LLM_PROVIDERS.OPENAI,
  model: LLM_DEFAULTS.openai.model,
  endpoint: LLM_DEFAULTS.openai.endpoint,
}

const geminiConfig: LLMConfig = {
  key: 'gemini-key',
  provider: LLM_PROVIDERS.GEMINI,
  model: LLM_DEFAULTS.gemini.model,
  endpoint: LLM_DEFAULTS.gemini.endpoint,
}

const mockFetchOk = (responseBody: unknown) =>
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(responseBody)))

describe('callWizardLLM provider routing', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('routes to Anthropic and sets correct headers', async () => {
    const mock = mockFetchOk({
      content: [{ type: 'text', text: JSON.stringify(VALID_LLM_RESPONSE) }],
    })

    await callWizardLLM({ llmConfig: anthropicConfig, ...BASE_CALL_OPTS })

    const [url, init] = mock.mock.calls[0]
    expect(url).toBe(LLM_DEFAULTS.anthropic.endpoint)
    const headers = init?.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-test')
    expect(headers['anthropic-version']).toBe('2023-06-01')
  })

  it('routes to OpenAI and sets correct headers', async () => {
    const mock = mockFetchOk({
      choices: [{ message: { content: JSON.stringify(VALID_LLM_RESPONSE) } }],
    })

    await callWizardLLM({ llmConfig: openaiConfig, ...BASE_CALL_OPTS })

    const [url, init] = mock.mock.calls[0]
    expect(url).toBe(LLM_DEFAULTS.openai.endpoint)
    const headers = init?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer sk-openai-test')
  })

  it('routes to Gemini and includes key in URL', async () => {
    const mock = mockFetchOk({
      candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_LLM_RESPONSE) }] } }],
    })

    await callWizardLLM({ llmConfig: geminiConfig, ...BASE_CALL_OPTS })

    const url = mock.mock.calls[0][0] as string
    expect(url).toContain('generativelanguage.googleapis.com')
    expect(url).toContain('gemini-2.5-flash')
    expect(url).toContain('key=gemini-key')
  })

  it('uses model from llmConfig', async () => {
    const customConfig: LLMConfig = {
      ...anthropicConfig,
      model: 'claude-opus-4-20250514',
    }
    const mock = mockFetchOk({
      content: [{ type: 'text', text: JSON.stringify(VALID_LLM_RESPONSE) }],
    })

    await callWizardLLM({ llmConfig: customConfig, ...BASE_CALL_OPTS })

    const body = JSON.parse(mock.mock.calls[0][1]?.body as string)
    expect(body.model).toBe('claude-opus-4-20250514')
  })

  it('throws on non-OK HTTP response', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Unauthorized', { status: 401 }))

    await expect(callWizardLLM({ llmConfig: anthropicConfig, ...BASE_CALL_OPTS })).rejects.toThrow(
      'LLM API error (401)',
    )
  })

  it('throws when Anthropic response has no text block', async () => {
    mockFetchOk({ content: [{ type: 'image', source: {} }] })

    await expect(callWizardLLM({ llmConfig: anthropicConfig, ...BASE_CALL_OPTS })).rejects.toThrow(
      'No text in Anthropic response',
    )
  })

  it('throws when OpenAI response has no choices', async () => {
    mockFetchOk({ choices: [] })

    await expect(callWizardLLM({ llmConfig: openaiConfig, ...BASE_CALL_OPTS })).rejects.toThrow(
      'No text in OpenAI response',
    )
  })

  it('throws when Gemini response has no candidates', async () => {
    mockFetchOk({ candidates: [] })

    await expect(callWizardLLM({ llmConfig: geminiConfig, ...BASE_CALL_OPTS })).rejects.toThrow(
      'No text in Gemini response',
    )
  })
})

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"key": "value"}')).toEqual({ key: 'value' })
  })

  it('extracts from fenced code block', () => {
    expect(extractJson('```json\n{"key": "value"}\n```')).toEqual({ key: 'value' })
  })

  it('extracts from fence without language tag', () => {
    expect(extractJson('```\n{"key": "value"}\n```')).toEqual({ key: 'value' })
  })

  it('throws on invalid JSON with helpful message', () => {
    expect(() => extractJson('not json {{')).toThrow('Failed to parse LLM response as JSON')
  })
})

describe('validateResponse', () => {
  it('accepts a valid response', () => {
    expect(validateResponse(VALID_LLM_RESPONSE)).toEqual(VALID_LLM_RESPONSE)
  })

  it('rejects null', () => {
    expect(() => validateResponse(null)).toThrow('missing required fields')
  })

  it('rejects missing fields', () => {
    expect(() => validateResponse({ coval_tracing_py: 'x' })).toThrow('missing required fields')
  })

  it('rejects non-objects', () => {
    expect(() => validateResponse('string')).toThrow('missing required fields')
  })

  it('rejects empty object', () => {
    expect(() => validateResponse({})).toThrow('missing required fields')
  })

  it('rejects non-string fields', () => {
    expect(() =>
      validateResponse({
        coval_tracing_py: {},
        modified_entry_point: 1,
        explanation: null,
      }),
    ).toThrow('expected string fields')
  })
})
